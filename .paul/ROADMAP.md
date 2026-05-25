# Roadmap: Orthogonal Chat

## Overview

Build the Orthogonal Chat take-home in seven phases. Each phase has hard dependencies on the previous. Frontend is the last functional phase before deployment, intentionally: the backend, tools, and context layer must be verifiable via curl or a minimal test harness before any UI work begins.

Phase order and step numbering follow `SPEC.md` §13 exactly. Do not skip phases or reorder steps.

## Current Milestone

**v0.1 Take-Home Submission** (v0.1.0)
Status: In progress
Phases: 0 of 7 complete

## Phases

| Phase | Name | Steps | Status | Completed |
|-------|------|-------|--------|-----------|
| 1 | Bootstrap and verification | 1 to 5 | In progress | - |
| 2 | Catalog and integration layer | 6 to 10 | Not started | - |
| 3 | Persistence and infrastructure | 11 to 14 | Not started | - |
| 4 | Chat loop (backend) | 15 to 16 | Not started | - |
| 5 | Context engineering | 17 to 24 | Not started | - |
| 6 | Frontend | 25 to 30 | Not started | - |
| 7 | Measurement and deployment | 31 to 35 | Not started | - |

## Phase Details

### Phase 1: Bootstrap and verification (steps 1 to 5)

Sanity check: probe script runs end-to-end against Orthogonal with a $0.01 Tomba call, MCP spike is either adopted or documented as rejected, and `pnpm build` is clean.

1. Scaffold Next.js 15 App Router project, install dependencies from `SPEC.md` §3.
2. Sign up at orthogonal.com, claim free credits, store key in `.env.local`.
3. Write `scripts/probe.ts`. Verify `/v1/list-endpoints`, `/v1/details`, `/v1/balance`, and one `/v1/run` call (Tomba at $0.01). Log full envelope to `notes/probe-output.json`.
4. Spike `mcp.orth.sh` with `experimental_createMCPClient`. Hard cap 30 min. Document result in `notes/mcp-spike.md`.
5. Decide: MCP or REST. Lock in. The rest of the spec assumes REST.

### Phase 2: Catalog and integration layer (steps 6 to 10)

Sanity check: typed tool palette compiles, each projection schema accepts a real upstream payload (via `scripts/probe.ts` fixtures).

6. Write `scripts/snapshot-catalog.ts`. Run it, commit the output (`lib/orthogonal/catalog.generated.ts`).
7. Define the curated set in `scripts/curated-endpoints.json` (8 to 12 endpoints covering the hero prompt plus breadth).
8. Hand-write the per-endpoint Zod projections under `lib/orthogonal/projections/`.
9. Write `lib/orthogonal/client.ts` with retry, circuit breaker, error mapping, prompt-injection wrapping, and cache lookup.
10. Generate `lib/orthogonal/tools.generated.ts` from the catalog + projections.

### Phase 3: Persistence and infrastructure (steps 11 to 14)

Sanity check: `drizzle-kit push` lands the schema on Neon, `withSingleFlight` coalesces two concurrent fake calls in a unit test, `storeToolResult` round-trips a 50KB payload.

11. Stand up Neon Postgres. Configure `@neondatabase/serverless` Pool driver.
12. Write Drizzle schema from `SPEC.md` §9.3. Run initial migration.
13. Stand up Upstash Redis. Wire `@upstash/redis` and `@upstash/ratelimit`.
14. Implement `withSingleFlight` from `SPEC.md` §5.5. Implement `storeToolResult` and `loadToolResult` for L3.

### Phase 4: Chat loop (backend) (steps 15 to 16)

Sanity check: curl `/api/chat` with a single-turn payload, observe SSE chunks, see Postgres rows for user + assistant + tool calls, see one row in `tool_calls` with `output` populated.

15. Implement `/api/chat/route.ts` with `streamText`, the typed Orthogonal tools, and basic message persistence. No context primitives yet, just verify the loop runs end-to-end.
16. Verify via curl or a minimal test script. Assistant should respond, tool calls should hit Orthogonal, results should land in Postgres.

### Phase 5: Context engineering (steps 17 to 24)

Sanity check: by turn 3 of the hero prompt, `usage.cache_read_input_tokens` is non-zero. Second run of the hero prompt from a fresh conversation ID shows `cacheHit = true` on the Apollo + Hunter calls. Eviction job runs on a synthesized long conversation without losing pinned turn 0 or memory entries.

17. Implement content addressing: ensure `tool_calls.output` stores the full payload; expose `read_tool_result` tool.
18. Implement `memory_write` / `memory_read` tools backed by `conversations.memory`.
19. Implement the manifest renderer and wire it into `buildModelMessages`.
20. Implement the token-budgeted sliding window with pinned turn 0.
21. Implement pre-eviction extraction with Haiku 4.5 (eviction job from `SPEC.md` §9.6).
22. Implement rolling cache breakpoints via `providerOptions.anthropic.cacheControl`.
23. Verify cache hits by logging `usage.cache_read_input_tokens`. Should be non-zero by turn 3.
24. Verify cross-conversation cache by running the hero prompt twice from different conversation IDs.

### Phase 6: Frontend (steps 25 to 30)

Sanity check: load `/c/[id]` cold, see hydrated history, run the hero prompt, observe tool call cards rendering during streaming, see contact + company + search cards, see cost meter updating live.

25. Implement client with `useChat` and `experimental_throttle: 100`. Hydrate from Postgres on `/c/[id]` load.
26. Build `MessageList`, `TextPart` (markdown + Shiki).
27. Build `ToolCallCard` with streaming input pill, completion badge, and collapsible "View full payload".
28. Build the structured cards: `ContactCard`, `CompanyCard`, `SearchResultList`.
29. Build `CostMeter` and `EvictionMarker`.
30. Dark mode, mobile responsive, error boundary with retry.

### Phase 7: Measurement and deployment (steps 31 to 35)

Sanity check: deployed URL passes hero prompt, `/api/admin/metrics` returns populated rows, README "Measurements" table has real numbers (not placeholders).

31. Run the hero conversation and a longer stress conversation. Collect metrics from `/api/admin/metrics`.
32. Deploy to Vercel. Set env vars: `ANTHROPIC_API_KEY`, `ORTHOGONAL_API_KEY`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
33. Verify the deployed instance with the hero prompt.
34. Write the README, leading with the Context Engineering section. Drop measured numbers into the table.
35. Invite `christianpickettcode` and `berasogut` if the repo is private. Submit.

## Cut Order If Scoping Down

Per `SPEC.md` §13. Cut in this order, never further.

1. Dark mode
2. Mobile responsive
3. Stress test conversation
4. Eviction marker UI

Never cut: content addressing, structured memory, cache breakpoints, cost meter, README context section.

---
*Roadmap created: 2026-05-25*
*Aligned to `SPEC.md` §13. Update phase status after each phase sanity check passes.*
