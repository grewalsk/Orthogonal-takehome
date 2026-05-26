import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { z } from "zod";
import { generateObject } from "ai";
import { getPool } from "@/lib/db";
import { conversations, messages } from "@/drizzle/schema";
import { writeMemory, readMemorySnapshot, type MemoryValue } from "@/lib/memory";
import { extractionModel } from "@/lib/llm";

const TOKEN_BUDGET = Number(process.env.CONTEXT_WINDOW_TOKEN_BUDGET ?? 16_384);
const COMPACTION_TRIGGER_RATIO = 0.6;
const COMPACTION_TARGET_RATIO = 0.5;

let activeDb: ReturnType<typeof drizzle> | null = null;
function getDb(): ReturnType<typeof drizzle> {
  if (!activeDb) activeDb = drizzle(getPool());
  return activeDb;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function tokensFor(parts: unknown): number {
  return estimateTokens(JSON.stringify(parts));
}

const memoryValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

const extractedFactsSchema = z.object({
  facts: z.array(
    z.object({
      key: z.string().min(1).max(100),
      value: memoryValueSchema,
    }),
  ),
});

async function extractFacts(
  messageText: string,
  currentMemoryKeys: string[],
): Promise<Array<{ key: string; value: MemoryValue }>> {
  try {
    const { object } = await generateObject({
      model: extractionModel,
      schema: extractedFactsSchema,
      system: `You are extracting facts from a conversation message that is about to be dropped from the context window. Pull out anything worth remembering: entities (names, companies), identifiers (emails, URLs, IDs), conclusions, decisions, user-stated preferences.

Use hierarchical dotted keys like 'stripe.ceo.name' or 'user.pref.location'. Be conservative: better to capture one unnecessary fact than to lose a useful one. Return facts: [] only if the message is purely conversational filler with nothing concrete.

Already in memory (skip exact-key duplicates): ${currentMemoryKeys.length === 0 ? "(none)" : currentMemoryKeys.join(", ")}`,
      prompt: messageText,
    });
    return object.facts as Array<{ key: string; value: MemoryValue }>;
  } catch (err) {
    console.error("extractFacts failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

function extractMessageText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) => {
      const part = p as { type?: string; text?: string; output?: unknown };
      if (part.type === "text" && typeof part.text === "string") return part.text;
      if (part.type?.startsWith("tool-") && part.output) {
        return `[tool ${part.type}: ${JSON.stringify(part.output).slice(0, 500)}]`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export interface MaybeEvictOptions {
  tokenBudget?: number;
  triggerRatio?: number;
  targetRatio?: number;
}

export interface MaybeEvictResult {
  evicted: number;
  factsExtracted: number;
  cursorAt: Date | null;
  totalTokensBefore: number;
  totalTokensAfter: number;
}

export async function maybeTriggerEviction(
  conversationId: string,
  opts: MaybeEvictOptions = {},
): Promise<MaybeEvictResult> {
  const budget = opts.tokenBudget ?? TOKEN_BUDGET;
  const trigger = (opts.triggerRatio ?? COMPACTION_TRIGGER_RATIO) * budget;
  const target = (opts.targetRatio ?? COMPACTION_TARGET_RATIO) * budget;

  const rows = await getDb()
    .select({
      id: messages.id,
      role: messages.role,
      parts: messages.parts,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.evicted, false)))
    .orderBy(messages.createdAt);

  if (rows.length === 0) {
    return { evicted: 0, factsExtracted: 0, cursorAt: null, totalTokensBefore: 0, totalTokensAfter: 0 };
  }

  const firstUserIdx = rows.findIndex((r) => r.role === "user");
  const pinnedId = firstUserIdx >= 0 ? rows[firstUserIdx].id : null;

  const tokenCounts = rows.map((r) => tokensFor(r.parts));
  const totalTokensBefore = tokenCounts.reduce((s, n) => s + n, 0);

  if (totalTokensBefore < trigger) {
    return {
      evicted: 0,
      factsExtracted: 0,
      cursorAt: null,
      totalTokensBefore,
      totalTokensAfter: totalTokensBefore,
    };
  }

  let remainingTokens = totalTokensBefore;
  const toEvict: typeof rows = [];
  for (let i = 0; i < rows.length && remainingTokens > target; i++) {
    const r = rows[i];
    if (r.id === pinnedId) continue;
    toEvict.push(r);
    remainingTokens -= tokenCounts[i];
  }

  if (toEvict.length === 0) {
    return {
      evicted: 0,
      factsExtracted: 0,
      cursorAt: null,
      totalTokensBefore,
      totalTokensAfter: totalTokensBefore,
    };
  }

  let totalFacts = 0;
  const currentMemory = await readMemorySnapshot(conversationId);
  const existingKeys = Object.keys(currentMemory);

  for (const r of toEvict) {
    const text = extractMessageText(r.parts);
    if (!text.trim()) continue;
    const facts = await extractFacts(text, existingKeys);
    for (const f of facts) {
      await writeMemory(conversationId, f.key, f.value);
      existingKeys.push(f.key);
      totalFacts++;
    }
  }

  await getDb()
    .update(messages)
    .set({ evicted: true })
    .where(inArray(messages.id, toEvict.map((r) => r.id)));

  const cursorAt = toEvict[toEvict.length - 1].createdAt;
  await getDb()
    .update(conversations)
    .set({ windowEvictedThroughAt: cursorAt })
    .where(eq(conversations.id, conversationId));

  return {
    evicted: toEvict.length,
    factsExtracted: totalFacts,
    cursorAt,
    totalTokensBefore,
    totalTokensAfter: remainingTokens,
  };
}
