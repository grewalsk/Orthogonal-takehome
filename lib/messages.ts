import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { UIMessage } from "ai";
import { getPool } from "@/lib/db";
import { conversations, messages } from "@/drizzle/schema";

let activeDb: ReturnType<typeof drizzle> | null = null;
function getDb(): ReturnType<typeof drizzle> {
  if (!activeDb) activeDb = drizzle(getPool());
  return activeDb;
}

export async function ensureConversation(id: string): Promise<void> {
  await getDb().insert(conversations).values({ id }).onConflictDoNothing();
}

export async function saveUserMessage(conversationId: string, uiMessage: UIMessage): Promise<string> {
  const parts = uiMessage.parts ?? [];
  const [row] = await getDb()
    .insert(messages)
    .values({
      conversationId,
      role: "user",
      parts: parts as unknown as object,
    })
    .returning({ id: messages.id });
  await touchConversation(conversationId);
  return row.id;
}

export async function createPendingAssistantMessage(
  conversationId: string,
  modelId: string,
): Promise<string> {
  const [row] = await getDb()
    .insert(messages)
    .values({
      conversationId,
      role: "assistant",
      parts: [] as unknown as object,
      modelId,
    })
    .returning({ id: messages.id });
  return row.id;
}

interface FinalizeInput {
  messageId: string;
  conversationId: string;
  parts: unknown;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cachedInputTokens?: number;
    cacheCreationInputTokens?: number;
  };
}

export async function finalizeAssistantMessage(input: FinalizeInput): Promise<void> {
  const inputTokens = input.usage?.inputTokens ?? null;
  const outputTokens = input.usage?.outputTokens ?? null;
  const cacheReadTokens = input.usage?.cachedInputTokens ?? null;
  const cacheWriteTokens = input.usage?.cacheCreationInputTokens ?? null;
  const costCents = estimateMessageCostCents({
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
  });

  await getDb()
    .update(messages)
    .set({
      parts: input.parts as unknown as object,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      costCents,
    })
    .where(eq(messages.id, input.messageId));

  await getDb()
    .update(conversations)
    .set({
      totalCostCents: sql`${conversations.totalCostCents} + ${costCents}`,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, input.conversationId));
}

async function touchConversation(conversationId: string): Promise<void> {
  await getDb()
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

// Claude Sonnet 4.6 pricing per million tokens, in USD.
// SPEC.md section 8 locks Sonnet 4.6 as the main model.
const SONNET_4_6_PRICING = {
  inputPerMillion: 3.0,
  cacheReadPerMillion: 0.30,
  cacheWritePerMillion: 3.75,
  outputPerMillion: 15.0,
};

function estimateMessageCostCents(usage: {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
}): number {
  const p = SONNET_4_6_PRICING;
  const inputCost =
    (usage.inputTokens ?? 0) * p.inputPerMillion +
    (usage.cacheReadTokens ?? 0) * p.cacheReadPerMillion +
    (usage.cacheWriteTokens ?? 0) * p.cacheWritePerMillion;
  const outputCost = (usage.outputTokens ?? 0) * p.outputPerMillion;
  const cents = Math.round(((inputCost + outputCost) / 1_000_000) * 100);
  return cents;
}
