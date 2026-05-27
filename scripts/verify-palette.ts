// E2E sanity check for the dynamic tool palette.
// Hits localhost:3000/api/chat with prompts that should each trigger a
// different specialist, then reads tool_calls rows from Postgres to
// confirm the router picked the right endpoint.
//
// Pre-req: pnpm dev running in another terminal.
// Run: pnpm exec tsx scripts/verify-palette.ts

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { randomUUID } from "node:crypto";
import { getPool, closePool } from "@/lib/db";

const HOST = "http://localhost:3000";

interface TestCase {
  label: string;
  prompt: string;
  expectAnyOf: string[];
}

const TESTS: TestCase[] = [
  {
    label: "brand colors -> branddev",
    prompt: "What are Stripe's official brand colors? Use the brand.dev endpoint, not search.",
    expectAnyOf: ["branddev_retrieve", "branddev_retrieve_by_name"],
  },
  {
    label: "recent funding -> predictleads",
    prompt: "Show me the most recent venture financing events from the last week. Use the funding-events feed, not regular search.",
    expectAnyOf: ["predictleads_discover_financing_events", "fundable_company_search"],
  },
  {
    label: "google news -> serper",
    prompt: "Get fresh Google News headlines about OpenAI from today. Use the Google News search endpoint specifically.",
    expectAnyOf: ["serper_news", "serper_search"],
  },
];

async function postOneTurn(convId: string, text: string): Promise<void> {
  const userMsg = {
    id: randomUUID(),
    role: "user" as const,
    parts: [{ type: "text" as const, text }],
  };
  const res = await fetch(`${HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: convId, messages: [userMsg] }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const reader = res.body.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
  await new Promise((r) => setTimeout(r, 500));
}

async function main() {
  const pool = getPool();
  let pass = 0;
  for (const tc of TESTS) {
    const convId = randomUUID();
    console.log(`\n[${tc.label}] conv=${convId.slice(0, 8)}`);
    const t0 = Date.now();
    try {
      await postOneTurn(convId, tc.prompt);
    } catch (e) {
      console.log(`  FAIL (HTTP): ${e instanceof Error ? e.message : e}`);
      continue;
    }
    const ms = Date.now() - t0;
    const rows = await pool.query(
      `select tool_name, cache_hit from tool_calls where conversation_id = $1 order by started_at`,
      [convId],
    );
    const slugs = rows.rows.map((r: { tool_name: string }) => r.tool_name);
    const hit = tc.expectAnyOf.some((s) => slugs.includes(s));
    pass += hit ? 1 : 0;
    console.log(`  ${hit ? "PASS" : "FAIL"}  (${ms}ms, ${slugs.length} tool calls)`);
    console.log(`  expected: ${tc.expectAnyOf.join(" OR ")}`);
    console.log(`  actual:   ${slugs.join(", ") || "(none)"}`);
  }
  console.log(`\nSummary: ${pass}/${TESTS.length} passes`);
  await closePool();
  process.exit(pass === TESTS.length ? 0 : 1);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
