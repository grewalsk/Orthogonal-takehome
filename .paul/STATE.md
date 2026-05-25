# Project State

## Project Reference

See: `.paul/PROJECT.md` (updated 2026-05-25)
Canonical spec: `SPEC.md` at repo root.

**Core value:** Real-data research chat with a context engineering layer that keeps per-turn input cost roughly flat as the conversation grows.
**Current focus:** Phase 1, step 1 complete (scaffold + deps + keys). Ready for step 2 (Orthogonal sign-up already done, key in `.env.local`) and step 3 (probe script).

## Current Position

Milestone: v0.1 Take-Home Submission
Phase: 1 of 7 (Bootstrap and verification)
Plan: None yet (proceeding directly per the build agreement in conversation)
Status: Steps 1 and 2 complete. Ready for step 3 (`scripts/probe.ts`).
Last activity: 2026-05-25, Next.js 16 scaffolded, spec deps installed, both keys in `.env.local`.

Progress:
- Milestone: [▓░░░░░░░░░] ~5%
- Phase 1: [▓▓▓▓░░░░░░] 40% (2 of 5 steps)

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

### Deferred Issues

- **`rehype-shiki` vs `@shikijs/rehype`** (Phase 6 step 26).
- **AI SDK 6 API verification** against spec §6.4, §8, §9.5 snippets (Phase 4 step 15).

### Blockers / Concerns

None. Both API keys received, `.env.local` written and gitignored.

## Session Continuity

Last session: 2026-05-25
Stopped at: Phase 1 steps 1 and 2 complete. Scaffold pushed, both keys local. Paused for user "go" before step 3.
Next action: Phase 1 step 3, write `scripts/probe.ts` to verify `/v1/list-endpoints`, `/v1/details`, `/v1/balance`, and one $0.01 Tomba `/v1/run` call. Log full envelope to `notes/probe-output.json`.
Resume file: `.paul/PROJECT.md` + `SPEC.md` §13 (step 3 is one of five Phase 1 steps).

---
*STATE.md, updated after every significant action.*
