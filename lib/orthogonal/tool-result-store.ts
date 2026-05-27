import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { getPool } from "@/lib/db";
import { canonicalJSON } from "@/lib/cache";
import { requireRequestContext } from "@/lib/orthogonal/context";
import { appendManifestEntry } from "@/lib/manifest";
import { toolCalls } from "@/drizzle/schema";

export interface ToolResultInput {
  slug: string;
  api: string;
  path: string;
  input: unknown;
  output: unknown;
  priceCents: number;
  upstreamRequestId?: string;
  cacheHit: boolean;
}

export interface ToolResultRecord {
  id: string;
  conversationId: string;
  messageId: string;
  toolName: string;
  input: unknown;
  output: unknown;
  outputProjection: unknown;
  inputHash: string;
  priceCents: number;
  upstreamRequestId: string | null;
  status: string;
  errorCode: string | null;
  cacheHit: boolean;
  coalesced: boolean;
  startedAt: Date;
  finishedAt: Date | null;
}

let activeDb: ReturnType<typeof drizzle> | null = null;
function getDb(): ReturnType<typeof drizzle> {
  if (!activeDb) activeDb = drizzle(getPool());
  return activeDb;
}

function mintResultId(): string {
  return `tr_${randomBytes(4).toString("hex")}`;
}

function hashInput(input: unknown): string {
  return createHash("sha256").update(canonicalJSON(input)).digest("hex");
}

export async function storeToolResult(record: ToolResultInput): Promise<string> {
  const ctx = requireRequestContext();
  const id = mintResultId();
  const inputHash = hashInput(record.input);
  const now = new Date();

  await getDb().insert(toolCalls).values({
    id,
    conversationId: ctx.conversationId,
    messageId: ctx.messageId,
    toolName: record.slug,
    input: record.input as object,
    inputHash,
    output: record.output as object,
    // The price_cents column is integer. Some upstreams (serper) return
    // fractional cents (0.2c) and any cached value predating the
    // client-layer round still carries the float. Round at the persistence
    // boundary as defense-in-depth.
    priceCents: Math.round(record.priceCents),
    upstreamRequestId: record.upstreamRequestId,
    status: record.cacheHit ? "cache_hit" : "success",
    cacheHit: record.cacheHit,
    startedAt: now,
    finishedAt: now,
  });

  await appendManifestEntry(ctx.conversationId, {
    tool: record.slug,
    input: record.input,
    result_id: id,
    price_cents: record.priceCents,
    at: now.toISOString(),
  });

  return id;
}

export async function loadToolResult(id: string): Promise<ToolResultRecord | null> {
  const rows = await getDb().select().from(toolCalls).where(eq(toolCalls.id, id)).limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    conversationId: r.conversationId,
    messageId: r.messageId,
    toolName: r.toolName,
    input: r.input,
    output: r.output,
    outputProjection: r.outputProjection,
    inputHash: r.inputHash,
    priceCents: r.priceCents ?? 0,
    upstreamRequestId: r.upstreamRequestId,
    status: r.status,
    errorCode: r.errorCode,
    cacheHit: r.cacheHit,
    coalesced: r.coalesced,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
  };
}
