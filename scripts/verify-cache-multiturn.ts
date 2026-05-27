// Multi-turn cache verification - measures the SECOND anchor benefit.
// Unlike verify-cache.ts (which sends just the latest user message each
// turn and thus cannot exercise anchor 2), this script accumulates the
// full UIMessage array client-side between turns so the model receives
// growing conversation history. The Phase 9.4 second anchor should
// cache the historical tail and push cache_read above the ~3848 baseline.
//
// Pre-req: pnpm dev running on localhost:3000.
// Run: pnpm exec tsx scripts/verify-cache-multiturn.ts

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { randomUUID } from "node:crypto";
import { getPool, closePool } from "@/lib/db";

const HOST = "http://localhost:3000";

interface UIMessagePart {
  type: string;
  text?: string;
  [k: string]: unknown;
}
interface UIMsg {
  id: string;
  role: "user" | "assistant" | "system";
  parts: UIMessagePart[];
}

async function postAndAccumulate(convId: string, history: UIMsg[], text: string): Promise<UIMsg[]> {
  const userMsg: UIMsg = {
    id: randomUUID(),
    role: "user",
    parts: [{ type: "text", text }],
  };
  const messages = [...history, userMsg];
  const res = await fetch(`${HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: convId, messages }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  // Drain the SSE stream.
  const reader = res.body.getReader();
  let raw = "";
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }
  // Parse the SSE stream for the assistant text parts. AI SDK 6 emits
  // text-delta events with the streamed tokens.
  const lines = raw.split("\n");
  let assistantText = "";
  let assistantId = "";
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const evt = JSON.parse(payload) as { type?: string; delta?: string; messageId?: string };
      if (evt.type === "text-delta" && typeof evt.delta === "string") {
        assistantText += evt.delta;
      }
      if (evt.messageId) assistantId = evt.messageId;
    } catch {
      // ignore
    }
  }
  // Settle a moment for the onFinish callback to persist.
  await new Promise((r) => setTimeout(r, 600));
  const assistantMsg: UIMsg = {
    id: assistantId || randomUUID(),
    role: "assistant",
    parts: [{ type: "text", text: assistantText || "(empty)" }],
  };
  return [...messages, assistantMsg];
}

async function main() {
  const convId = randomUUID();
  console.log(`conv: ${convId}\n`);
  const PROMPTS = [
    "Briefly, in one paragraph, what are the three biggest payment processors? Do not call any tools.",
    "Of those three, which has the largest market cap? Do not call any tools.",
    "Compare their founders in one sentence each. Do not call any tools.",
    "Which founder is the youngest? Do not call any tools.",
  ];
  let history: UIMsg[] = [];
  for (let i = 0; i < PROMPTS.length; i++) {
    const t0 = Date.now();
    history = await postAndAccumulate(convId, history, PROMPTS[i]);
    console.log(`turn ${i + 1}: ${Date.now() - t0}ms, history now ${history.length} msgs`);
  }

  const pool = getPool();
  const rows = await pool.query(
    `select created_at, role, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_cents
     from messages where conversation_id = $1 and role = 'assistant'
     order by created_at`,
    [convId],
  );

  console.log("\n--- assistant token usage ---\n");
  let totalIn = 0;
  let totalCacheRead = 0;
  for (let i = 0; i < rows.rows.length; i++) {
    const r = rows.rows[i];
    const inT = r.input_tokens ?? 0;
    const outT = r.output_tokens ?? 0;
    const cr = r.cache_read_tokens ?? 0;
    const cw = r.cache_write_tokens ?? 0;
    const ratio = inT > 0 ? `${((cr / inT) * 100).toFixed(1)}%` : "-";
    console.log(
      `turn ${i + 1}  in=${inT.toString().padStart(6)}  out=${outT.toString().padStart(4)}  ` +
        `cache_read=${cr.toString().padStart(6)}  cache_write=${cw.toString().padStart(5)}  ` +
        `ratio=${ratio.padStart(6)}  cost=${r.cost_cents}c`,
    );
    totalIn += inT;
    totalCacheRead += cr;
  }
  const overallRatio = totalIn > 0 ? `${((totalCacheRead / totalIn) * 100).toFixed(1)}%` : "-";
  console.log(`\noverall: ${totalCacheRead} cached of ${totalIn} input tokens = ${overallRatio}`);

  await closePool();
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
