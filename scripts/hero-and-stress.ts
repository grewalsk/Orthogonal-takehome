import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { getPool, closePool } from "@/lib/db";
import { messages as messagesTable } from "@/drizzle/schema";
import { maybeTriggerEviction } from "@/lib/eviction";
import { readMemorySnapshot } from "@/lib/memory";
import { loadManifest } from "@/lib/manifest";

const HOST = "http://localhost:3000";

interface UIMsg {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Array<{ type: string; text?: string; [k: string]: unknown }>;
}

let activeDb: ReturnType<typeof drizzle> | null = null;
function getDb(): ReturnType<typeof drizzle> {
  if (!activeDb) activeDb = drizzle(getPool());
  return activeDb;
}

async function loadHistory(convId: string): Promise<UIMsg[]> {
  const rows = await getDb()
    .select({
      id: messagesTable.id,
      role: messagesTable.role,
      parts: messagesTable.parts,
      evicted: messagesTable.evicted,
    })
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, convId))
    .orderBy(asc(messagesTable.createdAt));
  return rows
    .filter((r) => !r.evicted)
    .map((r) => ({
      id: r.id,
      role: r.role as UIMsg["role"],
      parts: (r.parts as UIMsg["parts"]) ?? [],
    }));
}

async function postTurn(convId: string, text: string): Promise<void> {
  const userMsg: UIMsg = {
    id: randomUUID(),
    role: "user",
    parts: [{ type: "text", text }],
  };
  const history = await loadHistory(convId);
  history.push(userMsg);

  const res = await fetch(`${HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: convId, messages: history }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} for "${text.slice(0, 30)}..."`);
  }
  const reader = res.body.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
  await new Promise((r) => setTimeout(r, 300));
}

interface CostBreakdown {
  llmCents: number;
  orthCents: number;
  totalCents: number;
  breakdown: unknown;
}

async function fetchCost(convId: string): Promise<CostBreakdown> {
  const res = await fetch(`${HOST}/api/conversation/${convId}/cost`);
  return (await res.json()) as CostBreakdown;
}

async function fetchTurnRows(convId: string) {
  const pool = getPool();
  const r = await pool.query<{
    role: string;
    created_at: Date;
    input_tokens: number | null;
    output_tokens: number | null;
    cache_read_tokens: number | null;
    cache_write_tokens: number | null;
    cost_cents: number;
    evicted: boolean;
  }>(
    `select role, created_at, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_cents, evicted
     from messages where conversation_id = $1 order by created_at`,
    [convId],
  );
  return r.rows;
}

async function fetchToolCalls(convId: string) {
  const pool = getPool();
  const r = await pool.query<{
    id: string;
    tool_name: string;
    status: string;
    price_cents: number | null;
    cache_hit: boolean;
  }>(
    `select id, tool_name, status, price_cents, cache_hit
     from tool_calls where conversation_id = $1 order by started_at`,
    [convId],
  );
  return r.rows;
}

interface RunReport {
  conversationId: string;
  label: string;
  turnCount: number;
  cost: CostBreakdown;
  turns: Array<{
    n: number;
    role: string;
    inputTokens: number | null;
    outputTokens: number | null;
    cacheReadTokens: number | null;
    cacheWriteTokens: number | null;
    costCents: number;
    evicted: boolean;
  }>;
  toolCalls: Array<{
    id: string;
    tool: string;
    status: string;
    priceCents: number | null;
    cacheHit: boolean;
  }>;
  manifestEntries: number;
  memoryKeys: string[];
}

async function buildReport(convId: string, label: string, turnCount: number): Promise<RunReport> {
  const [cost, rows, toolRows, manifest, memory] = await Promise.all([
    fetchCost(convId),
    fetchTurnRows(convId),
    fetchToolCalls(convId),
    loadManifest(convId),
    readMemorySnapshot(convId),
  ]);
  let i = 0;
  return {
    conversationId: convId,
    label,
    turnCount,
    cost,
    turns: rows.map((r) => ({
      n: i++,
      role: r.role,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      cacheReadTokens: r.cache_read_tokens,
      cacheWriteTokens: r.cache_write_tokens,
      costCents: r.cost_cents,
      evicted: r.evicted,
    })),
    toolCalls: toolRows.map((t) => ({
      id: t.id,
      tool: t.tool_name,
      status: t.status,
      priceCents: t.price_cents,
      cacheHit: t.cache_hit,
    })),
    manifestEntries: manifest.length,
    memoryKeys: Object.keys(memory),
  };
}

async function main() {
  const t0 = Date.now();
  console.log("=== HERO conversation ===");
  const heroId = randomUUID();
  console.log(`conv: ${heroId}`);
  const heroPrompt =
    "Research Stripe for me: give me the company info (industry, employees, founded), find the CEO's email, and find the top 5 sales hires from the last year at Stripe. Use the available tools efficiently and summarize at the end.";
  await postTurn(heroId, heroPrompt);
  const heroReport = await buildReport(heroId, "hero-single-turn", 1);
  console.log(`hero done in ${Date.now() - t0}ms`);
  console.log(`hero cost: $${(heroReport.cost.totalCents / 100).toFixed(2)} total, ${heroReport.toolCalls.length} tool calls`);

  console.log("\n=== STRESS conversation (5 follow-up turns) ===");
  const stressId = randomUUID();
  console.log(`conv: ${stressId}`);
  const stressPrompts = [
    "Research the company anthropic.com using your tools. Give me a one-paragraph summary.",
    "What domain is Stripe on? Find their company info using one tool call.",
    "Verify that support@vercel.com is deliverable using the tomba tool.",
    "Find emails on the domain stripe.com using the hunter domain search tool.",
    "Summarize everything we have discussed across this conversation in 3 sentences.",
  ];
  const stressT0 = Date.now();
  for (const p of stressPrompts) {
    const tt0 = Date.now();
    await postTurn(stressId, p);
    console.log(`  turn done in ${Date.now() - tt0}ms`);
  }
  console.log(`stress total: ${Date.now() - stressT0}ms`);

  console.log("\n=== forced eviction (budget=2000 tokens, demonstrates Haiku extraction) ===");
  const evictionResult = await maybeTriggerEviction(stressId, {
    tokenBudget: 2000,
    triggerRatio: 0.6,
    targetRatio: 0.4,
  });
  console.log(JSON.stringify(evictionResult, null, 2));

  const stressReport = await buildReport(stressId, "stress-six-turn-with-eviction", stressPrompts.length);
  console.log(`stress cost: $${(stressReport.cost.totalCents / 100).toFixed(2)} total, ${stressReport.toolCalls.length} tool calls`);

  mkdirSync("notes", { recursive: true });
  const out = resolve("notes/measurements.json");
  writeFileSync(
    out,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        elapsedMs: Date.now() - t0,
        hero: heroReport,
        stress: stressReport,
        evictionResult,
      },
      null,
      2,
    ),
  );
  console.log(`\nmeasurements written to ${out}`);
  console.log(`combined cost: $${((heroReport.cost.totalCents + stressReport.cost.totalCents) / 100).toFixed(2)}`);

  await closePool();
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
