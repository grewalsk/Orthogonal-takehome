// Sanity check for [src:tr_X] provenance citations.
// Sends a hero-style query, captures the assistant's reply from the DB,
// and confirms the text contains at least one citation that matches a
// real tool_call result_id from this conversation.
//
// Pre-req: pnpm dev running on localhost:3000.
// Run: pnpm exec tsx scripts/verify-citations.ts

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { randomUUID } from "node:crypto";
import { getPool, closePool } from "@/lib/db";

const HOST = "http://localhost:3000";
const CITATION_RE = /\[src:(tr_[0-9a-f]{6,16})\]/g;

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
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
  await new Promise((r) => setTimeout(r, 600));
}

async function main() {
  const convId = randomUUID();
  console.log(`conv: ${convId}\n`);

  const prompt =
    "Give me a 2-3 sentence overview of Stripe (Apollo company enrichment is the right tool). Cite each fact with [src:tr_X] as instructed.";
  const t0 = Date.now();
  await postOneTurn(convId, prompt);
  console.log(`turn 1 done in ${Date.now() - t0}ms`);

  const pool = getPool();
  const mrows = await pool.query(
    `select parts::text as parts from messages where conversation_id = $1 and role = 'assistant' order by created_at`,
    [convId],
  );
  const trows = await pool.query(
    `select id, tool_name from tool_calls where conversation_id = $1`,
    [convId],
  );

  const validIds = new Set<string>(trows.rows.map((r: { id: string }) => r.id));
  console.log(`\ntool_call result_ids: ${[...validIds].join(", ") || "(none)"}`);

  let foundCitations = 0;
  let validCitations = 0;
  for (const row of mrows.rows) {
    const parts = JSON.parse(row.parts) as Array<{ type: string; text?: string }>;
    const assistantText = parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text!)
      .join("");
    console.log("\n--- assistant text ---");
    console.log(assistantText);

    const matches = [...assistantText.matchAll(CITATION_RE)];
    foundCitations += matches.length;
    for (const m of matches) {
      if (validIds.has(m[1])) validCitations++;
    }
  }

  console.log(
    `\nsummary: found ${foundCitations} citations, ${validCitations} valid (matching a real tr_ id)`,
  );
  await closePool();
  process.exit(foundCitations > 0 && validCitations === foundCitations ? 0 : 1);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
