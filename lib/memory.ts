import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { getPool } from "@/lib/db";
import { conversations } from "@/drizzle/schema";

export type MemoryValue =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | unknown[];

let activeDb: ReturnType<typeof drizzle> | null = null;
function getDb(): ReturnType<typeof drizzle> {
  if (!activeDb) activeDb = drizzle(getPool());
  return activeDb;
}

export async function readMemory(conversationId: string, key: string): Promise<MemoryValue | null> {
  const rows = await getDb()
    .select({ memory: conversations.memory })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (rows.length === 0) return null;
  const memory = (rows[0].memory as Record<string, MemoryValue>) ?? {};
  const value = memory[key];
  return value === undefined ? null : value;
}

export async function readMemorySnapshot(conversationId: string): Promise<Record<string, MemoryValue>> {
  const rows = await getDb()
    .select({ memory: conversations.memory })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (rows.length === 0) return {};
  return (rows[0].memory as Record<string, MemoryValue>) ?? {};
}

export async function writeMemory(conversationId: string, key: string, value: MemoryValue): Promise<void> {
  const current = await readMemorySnapshot(conversationId);
  const next = { ...current, [key]: value };
  await getDb()
    .update(conversations)
    .set({ memory: next })
    .where(eq(conversations.id, conversationId));
}
