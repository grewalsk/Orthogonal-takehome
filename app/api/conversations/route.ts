import { desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { getPool } from "@/lib/db";
import { conversations, messages, toolCalls } from "@/drizzle/schema";

// Sidebar data source: lists recent conversations with a derived title
// (the first user message text, truncated) and optionally the tool slugs
// used in a currently-open conversation so the sidebar's "Tools in use"
// section can light up matching categories.
//
// GET /api/conversations
//   ?currentId=<uuid>   optional, includes that conv's tool slug list

export const runtime = "nodejs";

let activeDb: ReturnType<typeof drizzle> | null = null;
function getDb(): ReturnType<typeof drizzle> {
  if (!activeDb) activeDb = drizzle(getPool());
  return activeDb;
}

interface ConvSummary {
  id: string;
  title: string;
  updatedAt: string;
}

interface MessagePartLike {
  type?: string;
  text?: string;
}

const MAX_RECENT = 20;
const TITLE_LIMIT = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const currentId = url.searchParams.get("currentId");

  const db = getDb();
  const convRows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .orderBy(desc(conversations.updatedAt))
    .limit(MAX_RECENT);

  const idList = convRows.map((c) => c.id);
  const titleOverrides = idList.length > 0 ? await loadFirstUserText(idList) : new Map<string, string>();

  const recent: ConvSummary[] = convRows.map((c) => ({
    id: c.id,
    title: titleOverrides.get(c.id) ?? deriveTitle(c.title),
    updatedAt: c.updatedAt.toISOString(),
  }));

  let currentToolNames: string[] = [];
  if (currentId) {
    const toolRows = await db
      .select({ toolName: toolCalls.toolName })
      .from(toolCalls)
      .where(eq(toolCalls.conversationId, currentId));
    currentToolNames = Array.from(new Set(toolRows.map((r) => r.toolName)));
  }

  return Response.json({ recent, currentToolNames });
}

async function loadFirstUserText(convIds: string[]): Promise<Map<string, string>> {
  // One query pulls all user messages for the requested convs, then we
  // pick the earliest per conv client-side. Avoids N+1 without needing
  // raw DISTINCT ON.
  const db = getDb();
  const rows = await db
    .select({
      conversationId: messages.conversationId,
      parts: messages.parts,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(inArrayUserFilter(convIds));

  const earliest = new Map<string, { parts: unknown; createdAt: Date }>();
  for (const r of rows) {
    const prev = earliest.get(r.conversationId);
    if (!prev || r.createdAt < prev.createdAt) {
      earliest.set(r.conversationId, { parts: r.parts, createdAt: r.createdAt });
    }
  }

  const out = new Map<string, string>();
  for (const [cid, row] of earliest) {
    const text = firstTextOf(row.parts);
    if (text) out.set(cid, truncate(text, TITLE_LIMIT));
  }
  return out;
}

function inArrayUserFilter(convIds: string[]) {
  // Drizzle parameterizes a JS array as a record tuple by default
  // (ANY(($1,$2,...)::uuid[])), which Postgres rejects with "cannot cast
  // type record to uuid[]". Forcing the array through sql.param (single
  // parameter, sent as a real PG array) makes the cast work.
  const idArray = sql`${sql.param(convIds)}::uuid[]`;
  return sql`${messages.conversationId} = ANY(${idArray}) AND ${messages.role} = 'user'`;
}

function firstTextOf(parts: unknown): string | null {
  if (!Array.isArray(parts)) return null;
  for (const p of parts as MessagePartLike[]) {
    if (p && p.type === "text" && typeof p.text === "string" && p.text.trim()) {
      return p.text.trim();
    }
  }
  return null;
}

function deriveTitle(stored: string): string {
  if (stored && stored !== "New chat") return truncate(stored, TITLE_LIMIT);
  return "New chat";
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}
