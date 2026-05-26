import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { UIMessage } from "ai";
import { getPool } from "@/lib/db";
import { conversations, messages } from "@/drizzle/schema";
import { ChatClient } from "./chat-client";

let activeDb: ReturnType<typeof drizzle> | null = null;
function getDb(): ReturnType<typeof drizzle> {
  if (!activeDb) activeDb = drizzle(getPool());
  return activeDb;
}

interface MessageRow {
  id: string;
  role: string;
  parts: unknown;
  createdAt: Date;
  evicted: boolean;
}

interface ChatPageData {
  initialMessages: UIMessage[];
  evictedCount: number;
  memory: Record<string, unknown>;
}

async function loadConversation(conversationId: string): Promise<ChatPageData> {
  const db = getDb();
  const convRows = await db
    .select({ memory: conversations.memory })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  const memory = (convRows[0]?.memory as Record<string, unknown>) ?? {};

  const rows: MessageRow[] = await db
    .select({
      id: messages.id,
      role: messages.role,
      parts: messages.parts,
      createdAt: messages.createdAt,
      evicted: messages.evicted,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  const live = rows.filter((r) => !r.evicted);
  const evictedCount = rows.length - live.length;

  const initialMessages: UIMessage[] = live.map((r) => ({
    id: r.id,
    role: r.role as UIMessage["role"],
    parts: (r.parts as UIMessage["parts"]) ?? [],
  }));

  return { initialMessages, evictedCount, memory };
}

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadConversation(id);
  return (
    <ChatClient
      conversationId={id}
      initialMessages={data.initialMessages}
      evictedCount={data.evictedCount}
      memory={data.memory}
    />
  );
}
