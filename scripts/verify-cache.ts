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
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const reader = res.body.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
  await new Promise((r) => setTimeout(r, 250));
}

async function main() {
  const convA = randomUUID();
  const convB = randomUUID();
  console.log(`conv A: ${convA}`);
  console.log(`conv B: ${convB}\n`);

  const prompt = "What providers do you have available? List them by name in one short sentence each. Do not call any tools.";

  for (let i = 1; i <= 3; i++) {
    const t0 = Date.now();
    await postOneTurn(convA, `[turn ${i}] ${prompt}`);
    console.log(`conv A turn ${i} done in ${Date.now() - t0}ms`);
  }

  const t0 = Date.now();
  await postOneTurn(convB, `[turn 1] ${prompt}`);
  console.log(`conv B turn 1 done in ${Date.now() - t0}ms`);

  const pool = getPool();
  const rows = await pool.query(
    `select c.id as conv_id, m.created_at, m.role, m.input_tokens, m.output_tokens, m.cache_read_tokens, m.cache_write_tokens, m.cost_cents
     from messages m join conversations c on c.id = m.conversation_id
     where c.id = any($1::uuid[]) and m.role = 'assistant'
     order by c.id, m.created_at`,
    [[convA, convB]],
  );

  console.log("\n--- assistant message token usage ---\n");
  const convLabel = (id: string) => (id === convA ? "A" : "B");
  for (const r of rows.rows) {
    console.log(
      `conv ${convLabel(r.conv_id)}  ${new Date(r.created_at).toISOString().slice(11, 19)}  ` +
        `in=${r.input_tokens}  out=${r.output_tokens}  ` +
        `cache_read=${r.cache_read_tokens ?? 0}  cache_write=${r.cache_write_tokens ?? 0}  ` +
        `cost=${r.cost_cents}c`,
    );
  }

  await closePool();
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
