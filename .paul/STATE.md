# Project State

## Project Reference

See: `.paul/PROJECT.md` (updated 2026-05-25)
Canonical spec: `SPEC.md` at repo root.

**Core value:** Real-data research chat with a context engineering layer that keeps per-turn input cost roughly flat as the conversation grows.
**Current focus:** Phase 1 steps 1, 2, 3 complete. Ready for step 4 (MCP spike, hard cap 30 min).

## Current Position

Milestone: v0.1 Take-Home Submission
Phase: 1 of 7 (Bootstrap and verification)
Plan: None yet (proceeding directly per the build agreement in conversation)
Status: Steps 1, 2, 3 complete. Ready for step 4 (MCP spike).
Last activity: 2026-05-25, probe verified `/v1/list-endpoints`, `/v1/details`, `/v1/integrate`, and one $0.01 Tomba `/v1/run`. Three spec deviations captured.

Progress:
- Milestone: [▓░░░░░░░░░] ~10%
- Phase 1: [▓▓▓▓▓▓░░░░] 60% (3 of 5 steps)

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

### Deferred Issues

- **`rehype-shiki` vs `@shikijs/rehype`** (Phase 6 step 26).
- **AI SDK 6 API verification** against spec §6.4, §8, §9.5 snippets (Phase 4 step 15).
- **Cost meter source.** With `/v1/balance` unavailable, the UI cost meter must aggregate `priceCents` from `tool_calls` rows. Will revisit at Phase 6 step 29.

### Blockers / Concerns

None. Both API keys received and verified. Tomba `/v1/email-verifier` call succeeded end-to-end (charged 1 cent, response confirmed `support@vercel.com` as valid/deliverable, score 99).

## Session Continuity

Last session: 2026-05-25
Stopped at: Phase 1 steps 1, 2, 3 complete. Probe pushed, three deviations captured. Paused for user "go" before step 4.
Next action: Phase 1 step 4, spike `mcp.orth.sh` with `experimental_createMCPClient` from AI SDK. Hard cap 30 min. Document outcome in `notes/mcp-spike.md`. Bail conditions: SSE chunks arriving out of order, or non-bearer auth flow.
Resume file: `.paul/PROJECT.md` + `SPEC.md` §13 (steps 4 and 5 remain in Phase 1).

---
*STATE.md, updated after every significant action.*
