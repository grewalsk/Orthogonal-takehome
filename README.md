# Orthogonal Chat

A web chat where Claude Sonnet 4.6 has typed access to Orthogonal's universal API gateway. Users ask for real-world data (companies, people, emails, web results) and the assistant fetches it through Orthogonal, persists every byte for audit, and renders the result inline as structured cards.

**Live:** [orthogonal-chat.vercel.app](https://orthogonal-chat.vercel.app)
**Spec:** [`SPEC.md`](./SPEC.md) (1080 lines, the source of truth for every technical decision)

---

## Context engineering (the central technical contribution)

The hard problem in this build is not "call an API and render a card." It is keeping per-turn input cost roughly flat as the conversation grows, while preserving the ability to recall arbitrary facts from earlier turns. A naive sliding window degrades past 20 turns; running-text summarization is lossy and re-runs on every compaction trigger. This build decomposes the problem into four orthogonal primitives, each addressing a different shape of context pressure.

### Primitive 1: content-addressed tool results

Every `/v1/run` response is treated like a database row. Full raw payload to Postgres keyed by a `tr_<8hex>` UUID; model context receives a typed projection plus the `result_id`. When the model needs a field it did not get in the summary, it calls `read_tool_result(result_id, json_path)` instead of re-running the upstream provider.

A Tomba email-verifier response is **4603 bytes** of raw JSON. The projection the model sees is **~300 bytes**: name, status, score, smtp_provider, plus 5 `available_paths` for drill-in. **Compression ratio: 15x** on Tomba, similar order on Apollo.

### Primitive 2: structured memory with pre-eviction Haiku extraction

Hot tier of the conversation is a token-budgeted sliding window (default 16K tokens). Cold tier is a `jsonb` blob on the conversation row, keyed by hierarchical dotted strings (`stripe.ceo.email`, `user.preferences.location`). The boundary is the eviction job.

Eviction triggers when active tokens exceed 60% of budget. The oldest non-pinned messages are passed to Claude Haiku 4.5, which extracts named facts via a Zod-validated `{key, value}[]` schema. Facts merge into memory. Messages get marked `evicted=true` and a cursor advances on the conversation row. The sliding-window filter reads this cursor on the next turn.

Forced-eviction sanity check (budget=2000 tokens, conversation about Stripe): **7 messages compacted into 48 hierarchical facts**, tokens dropped from **3189 to 251** (92% reduction). Spec design intent: "better to over-extract than under". Haiku is instructed to be conservative.

The first user message is pinned. Turn 0 sets the conversation's intent and never enters eviction. The cost is negligible because it lives in the cached prefix anyway.

### Primitive 3: rolling Anthropic prompt cache

The cached prefix is `tool definitions + system prompt`. A `cacheControl: { type: "ephemeral" }` marker on the system message tells Anthropic to cache everything up to that point. Subsequent turns hit cache reads at **10% of base input price** (90% off).

The spec suggested two breakpoints with one rolling forward each turn. Shipped one anchor breakpoint instead. The second breakpoint would have to live after the conversation history but before the current user message, and our message layout puts the manifest and memory snapshot in between. Both of those grow or change per turn, so any cache key past them invalidates on every request. Anchor-only is reliable; documented the trade-off and the two ways to make a rolling breakpoint viable later.

Measured: **3774 of 4125 input tokens served from cache by turn 2 (91%)**, anchor cache hit ratio holds across the entire stress conversation. The first turn pays for the cache write (cache_write_tokens > 0). Every turn after that reads it back.

### Primitive 4: cross-conversation Redis cache

Tool call inputs are canonicalised (keys sorted, whitespace stripped, email-shaped values lowercased) and SHA256-hashed into a `orth:<endpoint>:<hash>` key. Upstash Redis stores `{data, priceCents, upstreamRequestId, cachedAt}` with a per-endpoint TTL: 24h for enrichments, 6h for searches, 1h for scrapes, 5m for web search.

Two fresh conversations asking to verify the same email both hit Redis. Zero `/v1/run` traffic on the second call. Same data, $0.01 saved on the second call.

`withSingleFlight` adds the concurrent-coalesce layer: an NX-locked redis.set ensures only one in-flight call hits Orthogonal when N requests miss cache simultaneously. Verified in `scripts/verify-redis-cache.ts` sanity check: **5 concurrent identical calls collapse to 1 fetch**, all 5 return identical values, 4 of them marked `coalesced: true`.

---

## Measurements

Numbers from `scripts/hero-and-stress.ts` against the deployed app, hitting real Anthropic + Orthogonal + Neon + Upstash.

| Metric | Hero (1 turn, 7 tool calls) | Stress (5 turns, 4 tool calls) | Combined |
|---|---|---|---|
| Input tokens | 53,404 | 87,394 | 140,798 |
| Cache read tokens | 36,045 | 61,767 | **97,812** |
| **Cache hit ratio** | 67.5% | 70.7% | **69.5%** |
| Output tokens | 1,827 | 1,671 | 3,498 |
| LLM cost | $0.23 | $0.36 | $0.59 |
| Orthogonal cost | $0.02 | $0.03 | $0.05 |
| Cache hits (Orthogonal) | 0 | 1 | 1 |
| **Total turn cost** | **$0.25** | $0.39 across 5 turns | $0.64 |

Hero conversation hit the spec's $0.25 per-turn ceiling exactly. Stress per-turn average: **$0.08**.

Forced-eviction demo (stress conversation, 2000-token budget):

| | Value |
|---|---|
| Messages evicted | 7 |
| Facts extracted by Haiku 4.5 | **48** |
| Tokens before eviction | 3189 |
| Tokens after eviction | **251** |
| Compression ratio | **92.1%** |

Reproduce: `pnpm dev` in one terminal, `pnpm exec tsx scripts/hero-and-stress.ts` in another. Costs roughly $0.65 in live API spend.

---

## Architecture

```
Browser
  - useChat (AI SDK 6)
  - SSE stream of UIMessage parts
  - Tool-call cards, contact card, company card, search-result list
        SSE
Next.js Route Handler  /api/chat   (Node runtime, maxDuration 300)
  - streamText with Sonnet 4.6
  - 12 tools: 9 typed Orthogonal + read_tool_result + memory_write + memory_read
  - On finish: persist messages, fire eviction job (async)
        -> Upstash Redis
              hash(endpoint, canonicalInput) -> cached payload (TTL'd)
              single-flight NX locks
              rate limit buckets (30/min sliding window per IP)
        -> Neon Postgres
              conversations, messages, tool_calls
              structured memory + manifest on conversations (jsonb)
        -> Anthropic API
              Sonnet 4.6 main loop, Haiku 4.5 for pre-eviction extraction
              prompt caching with 1 anchor breakpoint
        -> Orthogonal /v1/run  (retry + circuit breaker wrapper)
              Apollo, Hunter, LinkUp, Olostep, Tomba

Build time:  scripts/snapshot-catalog.ts
  - hits /v1/list-endpoints and /v1/details
  - emits lib/orthogonal/catalog.generated.ts
  - committed; not regenerated at runtime
```

### Memory hierarchy

```
L1: Model context (per-turn, ~16K tokens budget)
    Tool defs + system prompt   (cached prefix, anchor breakpoint)
    Pinned turn 0
    Tool call manifest          (always present, append-only)
    Structured memory snapshot  (always present)
    Sliding window of recent turns
                  read_tool_result, memory_read
L2: Upstash Redis  (cross-conversation, TTL'd, single-flight)
                  on miss
L3: Neon Postgres  (lossless audit, addressable by tr_<hex>)
    tool_calls.output       (full raw payloads, jsonb)
    messages.parts          (full UIMessage history)
    conversations.memory    (structured memory)
                  on miss
L4: Orthogonal /v1/run  (last resort, paid)
```

Reads cascade down. Writes happen at L3 (durable audit) and L2 (ephemeral cache). The model addresses L1 plus the tool layer; the tool layer handles the cascade. L3 is the lossless record. L1 is the lossy working set the model reasons over. The split is the architectural answer to "the context window fills up."

---

## Tech stack

- **Framework:** Next.js 16 App Router (deviation from spec's locked 15 to current default), Node runtime, `maxDuration = 300`
- **AI:** Vercel AI SDK 6 (`ai`, `@ai-sdk/react`, `@ai-sdk/anthropic`)
- **Models:** Claude Sonnet 4.6 main loop, Claude Haiku 4.5 pre-eviction extraction. No Opus.
- **Database:** Neon Postgres via `@neondatabase/serverless` Pool driver (Pool, not HTTP, because tool-call writes are transactional with message writes)
- **ORM:** Drizzle ORM + Drizzle Kit migrations
- **Cache:** Upstash Redis (`@upstash/redis`) + Upstash Ratelimit (`@upstash/ratelimit`)
- **UI:** Tailwind v4, lucide-react icons, next-themes for light/dark, react-markdown + `@shikijs/rehype` for code blocks
- **Validation:** Zod
- **Hosting:** Vercel Hobby + Fluid Compute, single region (iad1)

---

## Hero demo

The locked demo prompt (SPEC.md section 2 decision 2):

> Research Stripe: give me the company info, the CEO's email, and the top 5 sales hires from the last year.

This triggers an agentic loop across 6 to 8 tools: company enrichment (Apollo + Hunter cross-check), email finder (Hunter or Apollo people-match), deliverability verification (Tomba), people search with seniority + recency filters (Apollo mixed-people-search). All projections render as structured cards in the UI.

Try it at the live URL: [orthogonal-chat.vercel.app](https://orthogonal-chat.vercel.app)

---

## Running locally

Prereqs: Node 20+, pnpm 9+, accounts on [orthogonal.com](https://orthogonal.com), [neon.tech](https://neon.tech), [upstash.com](https://upstash.com), and an Anthropic API key.

```bash
pnpm install
# create .env.local with the 5 values below
pnpm db:migrate
pnpm dev
```

`.env.local` needs:
```
ORTHOGONAL_API_KEY=orth_live_...
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://...neon.tech/...
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

Useful scripts:
- `pnpm probe` runs `scripts/probe.ts` against Orthogonal (verifies catalog + one $0.01 Tomba call)
- `pnpm snapshot` regenerates `lib/orthogonal/catalog.generated.ts` from `/v1/details`
- `pnpm exec tsx scripts/verify-cache.ts` proves Anthropic prompt cache hits by turn 2
- `pnpm exec tsx scripts/verify-redis-cache.ts` proves cross-conversation Redis cache hits
- `pnpm exec tsx scripts/hero-and-stress.ts` runs the hero + 5-turn stress + forced eviction, writes `notes/measurements.json`

---

## Trade-offs and observations

Sequential record of decisions where the build deviated from the spec or where the spec's intent had to be reinterpreted. Full audit trail in `.paul/STATE.md`.

- **Spec said Next.js 15, shipped Next.js 16.** `create-next-app@latest` defaults to 16, which requires Node 20.9+. Most of the spec's snippets work as-is; AI SDK 6 changed two API surfaces (`convertToModelMessages` now returns a Promise, cache token fields moved to `inputTokenDetails.cacheReadTokens` and `cacheWriteTokens`) which I caught during integration and adapted.
- **MCP spike failed.** `mcp.orth.sh` works server-side (direct JSON-RPC POST `/` returns server info in 228ms with `protocolVersion 2024-11-05`) but `@ai-sdk/mcp@1.0.43`'s SSE transport never completes the handshake against this server. Full diagnosis in `notes/mcp-spike.md`. REST stays locked per `SPEC.md` section 2 decision 1.
- **Catalog is 807 endpoints across 55 providers, not 50/5** as the spec said. The spec's probe data was stale by the time I ran my own. All 5 hero-prompt providers (Tomba, Apollo, Hunter, LinkUp, Olostep) are still present, so the curated-set strategy is unaffected.
- **`/v1/balance` returns 404.** Spec referenced this for the cost meter. The cost meter aggregates `priceCents` from `tool_calls` rows locally instead, excluding cache hits from the billed total.
- **`/v1/run` shape depends on upstream method.** GET endpoints take `{api, path, query: {...}}`. POST endpoints take `{api, path, body: {...}}`. Spec example only generalises to POST. Confirmed via `/v1/integrate` canonical SDK snippet, wired the wrapper to select per endpoint method. See `lib/orthogonal/client.ts` `paramWrapper`.
- **Rolling cache breakpoint deferred.** Single anchor breakpoint ships because manifest + memory blocks change every turn and would invalidate a second rolling breakpoint. Documented two ways to make the second breakpoint viable in a future iteration (re-order blocks, or render manifest in a stably-prefixable way).
- **Cost meter excludes cache_hit tool calls from "billed" total.** `tool_calls.priceCents` is preserved on cache-hit rows for traceability but the cost meter shows actual money spent, which is zero on cache hits.

---

## What I would do with more time

In priority order:

1. **Provenance and inline citations.** Tag every assistant claim with `[src:tr_X]` and render as clickable references. Maps directly to Orthogonal's value prop.
2. **Rolling prompt cache breakpoint.** Re-order blocks so manifest + memory live after history; add the second breakpoint and verify cache_read climbs further on longer conversations.
3. **Multi-user auth.** Clerk or Auth.js. Per-user rate limits via the existing `@upstash/ratelimit` setup. Per-user spend caps.
4. **Resumable streams.** `resumable-stream` package + Redis stream registry, `resume: true` on `useChat`.
5. **RAG over conversation history.** `pgvector` embeddings on evicted messages.
6. **Inngest for long-running tool calls.** Background scrapes that exceed 60s, with the chat surface saying "I am working on this; it will appear when ready."
7. **MCP migration.** Once `mcp.orth.sh` documents auth and streams cleanly through Vercel, swap the generated tools for `createMCPClient`.
8. **Per-user Orthogonal keys.** Route each user's traffic through their own key for direct billing.

---

## Repo layout

```
app/
  api/chat/                              streamText handler
  api/tool-result/[id]/                  fetch full raw payload by tr_<hex>
  api/conversation/[id]/cost/            cost meter data source
  c/[id]/                                chat page (server component hydrates, client renders)
  page.tsx                               redirect /  to  /c/<new-uuid>
components/                              MessageList, ToolCallCard, ContactCard, CompanyCard,
                                         SearchResultList, CostMeter, EvictionMarker,
                                         ThemeToggle, TextPart
drizzle/                                 schema.ts + migrations
lib/
  cache.ts                               Noop + Upstash cache, withSingleFlight, cacheKey
  ratelimit.ts                           @upstash/ratelimit sliding window
  upstash.ts                             shared Redis singleton
  db.ts                                  Neon Pool with ws shim
  env.ts                                 force-load .env.local with override
  llm.ts                                 createAnthropic with explicit baseURL
  manifest.ts                            ManifestEntry, appendManifestEntry (atomic jsonb
                                         append), renderManifest
  memory.ts                              readMemory, writeMemory, readMemorySnapshot
  messages.ts                            user/assistant CRUD + cost rollup
  build-model-messages.ts                hot window filter + system + manifest + memory
  eviction.ts                            maybeTriggerEviction + Haiku extractFacts
  system-prompt.ts                       full SPEC.md section 11 prompt
  orthogonal/
    catalog.generated.ts                 9 curated endpoints (generated, committed)
    client.ts                            callOrth, retry, breaker, error mapping,
                                         telemetry
    context.ts                           AsyncLocalStorage for {conversationId, messageId}
    context-tools.ts                     read_tool_result + memory_write + memory_read
    projections/                         per-endpoint Zod schemas (hand-tuned)
    safety.ts                            wrapUntrusted for <untrusted_content> tagging
    tool-result-store.ts                 storeToolResult + loadToolResult
    tools.generated.ts                   9 tool() definitions + shared executeTool helper
notes/
  measurements.json                      hero + stress + eviction numbers
  mcp-spike.md                           why REST stays locked
  probe-output.json                      raw envelope captures from scripts/probe.ts
scripts/
  probe.ts                               verify Orthogonal endpoints
  mcp-spike.ts                           the spike that failed
  snapshot-catalog.ts                    regenerate catalog.generated.ts
  db-migrate.ts                          apply pending Drizzle migrations
  hero-and-stress.ts                     reproducible measurement run
  verify-cache.ts                        prove Anthropic prompt cache hits
  verify-redis-cache.ts                  prove Orthogonal Redis cache hits
SPEC.md                                  source of truth, 1080 lines
.paul/                                   PAUL framework PROJECT, ROADMAP, STATE
```

---

## Acknowledgements

Built against [Orthogonal](https://orthogonal.com) (universal API gateway), [Anthropic](https://anthropic.com) (Claude Sonnet 4.6 + Haiku 4.5), [Neon](https://neon.tech) (serverless Postgres), [Upstash](https://upstash.com) (serverless Redis), and [Vercel](https://vercel.com) (Fluid Compute hosting).
