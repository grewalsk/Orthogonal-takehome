import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { randomUUID } from "node:crypto";
import { getPool, closePool } from "@/lib/db";

const HOST = "http://localhost:3000";

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
    throw new Error(`HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
  await new Promise((r) => setTimeout(r, 300));
}

async function main() {
  const convX = randomUUID();
  const convY = randomUUID();
  console.log(`conv X: ${convX}`);
  console.log(`conv Y: ${convY}\n`);

  const prompt =
    "Use the tomba_email_verifier tool to verify the email support@vercel.com. Reply with one short sentence stating whether it is deliverable. Do not call any other tools.";

  const t0 = Date.now();
  await postOneTurn(convX, prompt);
  console.log(`conv X done in ${Date.now() - t0}ms`);

  const t1 = Date.now();
  await postOneTurn(convY, prompt);
  console.log(`conv Y done in ${Date.now() - t1}ms`);

  const pool = getPool();
  const rows = await pool.query(
    `select t.conversation_id, t.id as result_id, t.tool_name, t.status, t.price_cents, t.cache_hit, t.coalesced
     from tool_calls t
     where t.conversation_id = any($1::uuid[])
     order by t.started_at`,
    [[convX, convY]],
  );

  console.log("\n--- tool_calls rows ---\n");
  const label = (id: string) => (id === convX ? "X" : "Y");
  for (const r of rows.rows) {
    console.log(
      `conv ${label(r.conversation_id)}  ${r.result_id}  ${r.tool_name}  ` +
        `status=${r.status}  cache_hit=${r.cache_hit}  coalesced=${r.coalesced}  ` +
        `price_cents=${r.price_cents}`,
    );
  }

  const allHit = rows.rows.every((r) => r.cache_hit === true);
  const anyHit = rows.rows.some((r) => r.cache_hit === true);
  console.log("\n--- verdict ---");
  if (anyHit) {
    console.log(`PASS: cross-conversation Redis cache hit on at least one call (allHit=${allHit}).`);
  } else {
    console.log("FAIL: no cache hits across both conversations.");
  }

  await closePool();
  process.exit(anyHit ? 0 : 1);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
