import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { convertToModelMessages, type ModelMessage, type UIMessage } from "ai";
import { getPool } from "@/lib/db";
import { conversations, messages } from "@/drizzle/schema";
import { loadManifest, renderManifest } from "@/lib/manifest";
import { readMemorySnapshot, type MemoryValue } from "@/lib/memory";

let activeDb: ReturnType<typeof drizzle> | null = null;
function getDb(): ReturnType<typeof drizzle> {
  if (!activeDb) activeDb = drizzle(getPool());
  return activeDb;
}

export async function buildModelMessages(
  conversationId: string,
  uiMessages: UIMessage[],
): Promise<ModelMessage[]> {
  const hot = await filterHotWindow(conversationId, uiMessages);
  const [manifest, memory, baseMessages] = await Promise.all([
    loadManifest(conversationId),
    readMemorySnapshot(conversationId),
    convertToModelMessages(hot),
  ]);

  const systemBlocks: ModelMessage[] = [];

  const manifestText = renderManifest(manifest);
  if (manifestText) {
    systemBlocks.push({ role: "system", content: manifestText });
  }

  const memoryText = renderMemorySnapshot(memory);
  if (memoryText) {
    systemBlocks.push({ role: "system", content: memoryText });
  }

  return [...systemBlocks, ...baseMessages];
}

async function filterHotWindow(
  conversationId: string,
  uiMessages: UIMessage[],
): Promise<UIMessage[]> {
  if (uiMessages.length === 0) return uiMessages;
  const evictedAt = await loadEvictionCursor(conversationId);
  if (!evictedAt) return uiMessages;

  const firstUserIdx = uiMessages.findIndex((m) => m.role === "user");
  const pinnedId = firstUserIdx >= 0 ? uiMessages[firstUserIdx].id : null;

  const timestamps = await loadMessageTimestamps(uiMessages.map((m) => m.id));
  return uiMessages.filter((m) => {
    if (m.id === pinnedId) return true;
    const ts = timestamps.get(m.id);
    if (!ts) return true;
    return ts > evictedAt;
  });
}

async function loadEvictionCursor(conversationId: string): Promise<Date | null> {
  const rows = await getDb()
    .select({ windowEvictedThroughAt: conversations.windowEvictedThroughAt })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return rows[0]?.windowEvictedThroughAt ?? null;
}

async function loadMessageTimestamps(ids: string[]): Promise<Map<string, Date>> {
  if (ids.length === 0) return new Map();
  const rows = await getDb()
    .select({ id: messages.id, createdAt: messages.createdAt })
    .from(messages)
    .where(inArray(messages.id, ids));
  return new Map(rows.map((r) => [r.id, r.createdAt]));
}

function renderMemorySnapshot(memory: Record<string, MemoryValue>): string {
  const entries = Object.entries(memory);
  if (entries.length === 0) return "";
  const lines = entries.map(([k, v]) => `${k} = ${JSON.stringify(v)}`);
  return [
    "# Structured memory",
    "",
    "Facts persisted across conversation compactions. Each line is key = value. Use memory_read to verify before quoting a value (these may be stale).",
    "",
    ...lines,
  ].join("\n");
}
