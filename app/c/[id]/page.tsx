import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { UIMessage } from "ai";
import { getPool } from "@/lib/db";
import { messages } from "@/drizzle/schema";
import { ChatClient } from "./chat-client";

let activeDb: ReturnType<typeof drizzle> | null = null;
function getDb(): ReturnType<typeof drizzle> {
  if (!activeDb) activeDb = drizzle(getPool());
  return activeDb;
}

async function loadConversation(conversationId: string): Promise<UIMessage[]> {
  const rows = await getDb()
    .select({
      id: messages.id,
      role: messages.role,
      parts: messages.parts,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  return rows.map((r) => ({
    id: r.id,
    role: r.role as UIMessage["role"],
    parts: (r.parts as UIMessage["parts"]) ?? [],
  }));
}

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initialMessages = await loadConversation(id);
  return <ChatClient conversationId={id} initialMessages={initialMessages} />;
}
