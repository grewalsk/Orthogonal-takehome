# Project State

## Project Reference

See: `.paul/PROJECT.md` (updated 2026-05-25)
Canonical spec: `SPEC.md` at repo root.

**Core value:** Real-data research chat with a context engineering layer that keeps per-turn input cost roughly flat as the conversation grows.
**Current focus:** Phases 1 and 2 complete. Ready for Phase 3 (persistence and infrastructure, steps 11 through 14).

## Current Position

Milestone: v0.1 Take-Home Submission
Phase: 2 of 7 (Catalog and integration layer) COMPLETE. Next: Phase 3.
Plan: None yet (proceeding directly per the build agreement in conversation)
Status: Typed tool palette compiles. Tomba projection validated against real upstream payload from probe (deliverable, score 99). Other 8 projections unverified until Phase 4 end-to-end.
Last activity: 2026-05-25, Phase 2 step 10. lib/orthogonal/tools.generated.ts written with 9 tools all using a shared executeTool() helper that wires inputSchema -> callOrth -> storeToolResult -> project. Hand-written rather than script-generated (mechanical structure, 9 entries, no domain logic to justify generator).

Progress:
- Milestone: [▓▓▓░░░░░░░] ~29% (2 of 7 phases)
- Phase 1: [▓▓▓▓▓▓▓▓▓▓] 100% (5 of 5 steps)
- Phase 2: [▓▓▓▓▓▓▓▓▓▓] 100% (5 of 5 steps)
- Phase 3: [░░░░░░░░░░] 0% (0 of 4 steps)

## Loop Position

Current loop state:

```
PLAN ──▶ APPLY ──▶ UNIFY
  ○        ○        ○     [Ready for first PLAN]
```

## Accumulated Context

### Decisions

Recorded in `.paul/PROJECT.md` Key Decisions table. Seven decisions locked from `SPEC.md` §2. In-conversation decisions:

- **PAUL bootstraps at repo root, not nested under `apps/`.** Honors the "Vercel deploys from repo root" constraint set during clarifying questions.
- **`SPEC.md` is the canonical brief, not a synthesized PLANNING.md.** `.paul/PROJECT.md` is a summary; PRs and plans should cite `SPEC.md` for technical decisions.
- **Model choice confirmed per spec.** User explored "cheapest model" alternative, then reverted to spec defaults (Sonnet 4.6 main loop + Haiku 4.5 extraction) because Sonnet's better tool selection minimizes wasted Orthogonal credits, which is the binding cost constraint.
- **Tech stack deviations from `SPEC.md` §3, user-approved during Phase 1 step 1:**
  - **Next.js 16.2.6** instead of Next.js 15. Reason: `create-next-app@latest` defaults to 16, user opted to stay current rather than downgrade. Risk: scaffold-generated `AGENTS.md` warns of breaking changes from Next.js 14/15. Mitigation: consult `node_modules/next/dist/docs/` when spec snippets do not compile cleanly.
  - **`ai@6.0.191`** instead of "AI SDK 5". The Vercel AI SDK package was bumped to v6 by build date. API surface for `streamText`, `useChat`, `tool` may differ from spec snippets in §6.4, §8, §9.5; will surface during Phase 4 step 15 if any spec code no longer compiles.
  - **`rehype-shiki` deferred to Phase 6 step 26.** Package is deprecated in favor of `@shikijs/rehype`. Decision deferred until the markdown stack is actually wired in the frontend; `shiki` core is installed.
  - **pnpm 9.15.4** pinned via Corepack. Reason: Node 18.20.8 on the dev machine does not support pnpm 11. Vercel-native. Upgrade path: `nvm install 20` then `corepack prepare pnpm@latest --activate`.

- **Spec deviations surfaced by Phase 1 step 3 probe** (2026-05-25, all in `notes/probe-output.json`):
  - **Catalog is 807 endpoints across 55 providers**, not 50 across 5 as `SPEC.md` §4 said. All 5 hero-prompt providers (Tomba, Apollo, Hunter, LinkUp, Olostep) are still present. Curated-set strategy from §6.2 is unaffected; pick 8 to 12 endpoints with the same shape.
  - **`/v1/balance` returns 404**. Tried `/v1/account`, `/v1/credits`, `/v1/me`; all 404. `SPEC.md` §6.1's reference to `/v1/balance` is incorrect. The cost meter must track spend locally from `priceCents` on each `/v1/run` response, not pull from Orthogonal.
  - **`/v1/run` shape depends on upstream method.** GET endpoints with queryParams take `{api, path, query: {...}}`. POST endpoints with bodyParams take `{api, path, body: {...}}`. The `SPEC.md` §6.4 example uses `body` for Apollo (correct since Apollo people-match is POST) but does not generalize. `lib/orthogonal/client.ts` in Phase 2 step 9 must select the wrapper field per endpoint method. Confirmed via the `/v1/integrate` canonical SDK snippet.
  - **`@orth/sdk` exists.** The `/v1/integrate` response references `import Orthogonal from "@orth/sdk"`. Spec locks REST (§2 decision 1); not adopting the SDK, but flagging for awareness.

- **MCP spike outcome (Phase 1 steps 4 and 5, 2026-05-25)**, full writeup in `notes/mcp-spike.md`:
  - `mcp.orth.sh` is a real MCP gateway that accepts bearer auth (bail condition 2 cleared) and responds to direct JSON-RPC POST / in 228ms with `protocolVersion 2024-11-05`.
  - **`@ai-sdk/mcp@1.0.43` `createMCPClient` over SSE hangs**; the handshake never completes within 15 seconds. The SSE wire-level handshake works (curl confirms `event: endpoint\ndata: /message?sessionId=...`), but AI SDK's client cannot drive the older 2024-11-05 SSE transport pattern this server speaks. Bail condition 1 hit.
  - **Decision locked: REST.** `SPEC.md` §2 decision 1 stands. MCP migration moves to deferred work (post-submission).
  - `@ai-sdk/mcp` left installed for potential future use; not imported in runtime code.
  - **AI SDK 6 rename surfaced:** the function is `createMCPClient` (no `experimental_` prefix) and lives in `@ai-sdk/mcp`, not in the main `ai` package. `SPEC.md` §13 step 4 references `experimental_createMCPClient` (the v5 name). Noted; no code change needed since REST is locked.

### Deferred Issues

- **`rehype-shiki` vs `@shikijs/rehype`** (Phase 6 step 26).
- **AI SDK 6 API verification** against spec §6.4, §8, §9.5 snippets (Phase 4 step 15).
- **Cost meter source.** With `/v1/balance` unavailable, the UI cost meter must aggregate `priceCents` from `tool_calls` rows. Will revisit at Phase 6 step 29.

### Blockers / Concerns

None. Both API keys received and verified. Tomba `/v1/email-verifier` call succeeded end-to-end (charged 1 cent, response confirmed `support@vercel.com` as valid/deliverable, score 99).

## Session Continuity

Last session: 2026-05-25
Stopped at: Phase 2 complete. Snapshot script, curated set, 9 projections, client wrapper, and tools.generated.ts all in. Tomba sanity check passed.
Next action: Phase 3 step 11, stand up Neon Postgres. User will need to provision a Neon project and provide `DATABASE_URL` for `.env.local`. Then step 12 (Drizzle schema from `SPEC.md` §9.3), step 13 (Upstash Redis credentials), step 14 (real `withSingleFlight` + `storeToolResult`/`loadToolResult` replacements).
Resume file: `.paul/PROJECT.md` + `SPEC.md` §9 (full data layer spec) + §13 (steps 11 through 14).

---
*STATE.md, updated after every significant action.*
