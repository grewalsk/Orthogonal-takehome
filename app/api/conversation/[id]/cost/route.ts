import { getPool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "invalid conversation id" }, { status: 400 });
  }
  const pool = getPool();
  const llm = await pool.query<{ llm_cents: number; cache_read: number; cache_write: number; input: number; output: number }>(
    `select
       coalesce(sum(cost_cents), 0)::int as llm_cents,
       coalesce(sum(cache_read_tokens), 0)::int as cache_read,
       coalesce(sum(cache_write_tokens), 0)::int as cache_write,
       coalesce(sum(input_tokens), 0)::int as input,
       coalesce(sum(output_tokens), 0)::int as output
     from messages
     where conversation_id = $1 and role = 'assistant'`,
    [id],
  );
  const orth = await pool.query<{
    orth_cents_billed: number;
    orth_cents_total: number;
    tool_calls: number;
    cache_hits: number;
  }>(
    `select
       coalesce(sum(case when cache_hit then 0 else price_cents end), 0)::int as orth_cents_billed,
       coalesce(sum(price_cents), 0)::int as orth_cents_total,
       count(*)::int as tool_calls,
       count(*) filter (where cache_hit)::int as cache_hits
     from tool_calls
     where conversation_id = $1`,
    [id],
  );

  const llmRow = llm.rows[0];
  const orthRow = orth.rows[0];
  const llmCents = llmRow?.llm_cents ?? 0;
  const orthCents = orthRow?.orth_cents_billed ?? 0;
  return Response.json({
    conversationId: id,
    llmCents,
    orthCents,
    totalCents: llmCents + orthCents,
    breakdown: {
      llm: {
        cents: llmCents,
        inputTokens: llmRow?.input ?? 0,
        outputTokens: llmRow?.output ?? 0,
        cacheReadTokens: llmRow?.cache_read ?? 0,
        cacheWriteTokens: llmRow?.cache_write ?? 0,
      },
      orthogonal: {
        billedCents: orthCents,
        wouldHaveBilledCents: orthRow?.orth_cents_total ?? 0,
        savingsCents: (orthRow?.orth_cents_total ?? 0) - orthCents,
        toolCalls: orthRow?.tool_calls ?? 0,
        cacheHits: orthRow?.cache_hits ?? 0,
      },
    },
  });
}
