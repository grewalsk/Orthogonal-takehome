import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { getPool } from "@/lib/db";
import { conversations } from "@/drizzle/schema";

export interface ManifestEntry {
  tool: string;
  input: unknown;
  result_id: string;
  price_cents: number;
  at: string;
}

let activeDb: ReturnType<typeof drizzle> | null = null;
function getDb(): ReturnType<typeof drizzle> {
  if (!activeDb) activeDb = drizzle(getPool());
  return activeDb;
}

export async function loadManifest(conversationId: string): Promise<ManifestEntry[]> {
  const rows = await getDb()
    .select({ manifest: conversations.manifest })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (rows.length === 0) return [];
  const m = rows[0].manifest;
  return Array.isArray(m) ? (m as ManifestEntry[]) : [];
}

export async function appendManifestEntry(
  conversationId: string,
  entry: ManifestEntry,
): Promise<void> {
  const payload = JSON.stringify([entry]);
  await getDb()
    .update(conversations)
    .set({
      manifest: sql`COALESCE(${conversations.manifest}, '[]'::jsonb) || ${payload}::jsonb`,
    })
    .where(eq(conversations.id, conversationId));
}

export function renderManifest(entries: ManifestEntry[]): string {
  if (!entries || entries.length === 0) return "";
  const lines = entries.map((e, i) => {
    const idx = i + 1;
    const summary = summarizeInput(e.input);
    const dollars = `$${(e.price_cents / 100).toFixed(2)}`;
    return `[${idx}] ${e.tool}(${summary}) -> ${e.result_id} (${dollars})`;
  });
  return [
    "# Tool call manifest",
    "",
    "Tool calls made earlier in this conversation. Each line shows: index, tool, brief input, result_id, and cost. To drill into a past result without re-calling the upstream provider (which costs money), use read_tool_result with the result_id and a JSONPath expression.",
    "",
    ...lines,
  ].join("\n");
}

export function summarizeInput(input: unknown): string {
  if (input === null || input === undefined) return "";
  if (typeof input !== "object") return String(input);
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length === 0) return "";
  const rendered = entries
    .map(([k, v]) => {
      let str: string;
      if (typeof v === "string") {
        str = v.length > 30 ? `${v.slice(0, 30)}...` : v;
      } else if (Array.isArray(v)) {
        str = `[${v.length}]`;
      } else if (typeof v === "object" && v !== null) {
        str = `{...}`;
      } else {
        str = String(v);
      }
      return `${k}=${str}`;
    })
    .join(", ");
  return rendered.length > 100 ? `${rendered.slice(0, 100)}...` : rendered;
}
