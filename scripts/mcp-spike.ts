import dotenv from "dotenv";
import { createMCPClient } from "@ai-sdk/mcp";

dotenv.config({ path: ".env.local" });

const MCP_URL = "https://mcp.orth.sh/sse";
const KEY = process.env.ORTHOGONAL_API_KEY;
if (!KEY) {
  console.error("ORTHOGONAL_API_KEY missing in .env.local");
  process.exit(1);
}

interface SpikeResult {
  step: string;
  ok: boolean;
  ms: number;
  detail: unknown;
}

const results: SpikeResult[] = [];

async function timed<T>(step: string, fn: () => Promise<T>, timeoutMs = 15000): Promise<T | null> {
  const t0 = Date.now();
  process.stdout.write(`[...]  ${step.padEnd(28)} starting\n`);
  try {
    const out = await Promise.race([
      fn(),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
    const ms = Date.now() - t0;
    results.push({ step, ok: true, ms, detail: summarize(out) });
    process.stdout.write(`[OK  ] ${step.padEnd(28)} ${String(ms).padStart(5)}ms\n`);
    return out;
  } catch (err) {
    const ms = Date.now() - t0;
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    results.push({ step, ok: false, ms, detail: message });
    process.stdout.write(`[FAIL] ${step.padEnd(28)} ${String(ms).padStart(5)}ms  ${message}\n`);
    return null;
  }
}

function summarize(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v !== "object") return v;
  if (Array.isArray(v)) return { kind: "array", length: v.length, sample: v.slice(0, 2) };
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj);
  return { kind: "object", keys };
}

async function main() {
  console.log(`MCP spike against ${MCP_URL}\n`);

  const client = await timed("createMCPClient", async () =>
    createMCPClient({
      transport: {
        type: "sse",
        url: MCP_URL,
        headers: { Authorization: `Bearer ${KEY}` },
      },
      clientName: "orthogonal-chat-spike",
      version: "0.0.1",
    }),
  );

  if (!client) {
    summary(false, "createMCPClient failed; cannot proceed.");
    return;
  }

  const tools = await timed("client.tools()", async () => client.tools());
  if (tools) {
    const keys = Object.keys(tools as Record<string, unknown>);
    console.log(`  Discovered ${keys.length} tool(s).`);
    if (keys.length > 0) {
      console.log(`  Sample: ${keys.slice(0, 5).join(", ")}${keys.length > 5 ? " ..." : ""}`);
    }
    results.push({ step: "tools-listed", ok: true, ms: 0, detail: { count: keys.length, sample: keys.slice(0, 10) } });
  }

  let tombaToolName: string | null = null;
  if (tools) {
    const keys = Object.keys(tools as Record<string, unknown>);
    tombaToolName = keys.find((k) => k.toLowerCase().includes("tomba") && k.toLowerCase().includes("verifier"))
      ?? keys.find((k) => k.toLowerCase().includes("tomba"))
      ?? null;
  }

  if (tombaToolName && tools) {
    const toolEntry = (tools as unknown as Record<string, { execute?: (input: unknown, opts: unknown) => unknown }>)[tombaToolName];
    console.log(`  Picked tool: ${tombaToolName}`);
    await timed(`execute ${tombaToolName}`, async () => {
      if (typeof toolEntry?.execute !== "function") {
        throw new Error("tool.execute missing");
      }
      return await toolEntry.execute(
        { email: "support@vercel.com" },
        { toolCallId: "spike-1", messages: [] },
      );
    });
  } else {
    console.log("  No Tomba tool found in listing; skipping execute.");
  }

  await timed("client.close()", async () => {
    const c = client as { close?: () => Promise<void> };
    if (c.close) await c.close();
    return null;
  });

  const allOk = results.every((r) => r.ok);
  summary(allOk, allOk ? "MCP spike succeeded end to end." : "MCP spike had failures; see records.");
}

function summary(ok: boolean, msg: string) {
  console.log(`\n${ok ? "PASS" : "FAIL"}: ${msg}`);
  console.log("Records:");
  for (const r of results) {
    console.log(`  ${r.ok ? "OK  " : "FAIL"}  ${r.step.padEnd(28)} ${String(r.ms).padStart(5)}ms`);
  }
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
