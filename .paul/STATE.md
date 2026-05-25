# Project State

## Project Reference

See: `.paul/PROJECT.md` (updated 2026-05-25)
Canonical spec: `SPEC.md` at repo root.

**Core value:** Real-data research chat with a context engineering layer that keeps per-turn input cost roughly flat as the conversation grows.
**Current focus:** Phase 1, step 1. Scaffold Next.js 15 App Router and install dependencies.

## Current Position

Milestone: v0.1 Take-Home Submission
Phase: 1 of 7 (Bootstrap and verification)
Plan: None yet (run `/paul:plan` to create the Phase 1 plan, or proceed directly per the build agreement in conversation)
Status: Ready for step 1 (scaffold)
Last activity: 2026-05-25T22:59:33Z, Project initialized from SPEC.md

Progress:
- Milestone: [░░░░░░░░░░] 0%
- Phase 1: [░░░░░░░░░░] 0% (0 of 5 steps)

## Loop Position

Current loop state:

```
PLAN ──▶ APPLY ──▶ UNIFY
  ○        ○        ○     [Ready for first PLAN]
```

## Accumulated Context

### Decisions

Recorded in `.paul/PROJECT.md` Key Decisions table. Seven decisions locked from `SPEC.md` §2. Notable in-conversation decisions made during init:

- **PAUL bootstraps at repo root, not nested under `apps/`.** Honors the "Vercel deploys from repo root" constraint set during clarifying questions.
- **`SPEC.md` is the canonical brief, not a synthesized PLANNING.md.** `.paul/PROJECT.md` is a summary; PRs and plans should cite `SPEC.md` for technical decisions.
- **Open-source LLM swap deferred.** User mentioned starting with an open-source model and substituting Claude at the end. Flagged for re-confirmation at Phase 4 (route handler) because `SPEC.md` §3 and prompt-caching primitive lock Anthropic-specific. Not actioned during init.

### Deferred Issues

None yet.

### Blockers / Concerns

- **Step 2 requires user action.** Orthogonal sign-up takes 2 to 3 minutes; the user pastes `ORTHOGONAL_API_KEY` and `ANTHROPIC_API_KEY` into `.env.local` after Phase 1 step 1 completes. Build agreement: scaffold runs to completion, then pause until keys are pasted.

## Session Continuity

Last session: 2026-05-25T22:59:33Z
Stopped at: PAUL initialization complete
Next action: Phase 1 step 1, scaffold Next.js 15 App Router at repo root with pnpm
Resume file: `.paul/PROJECT.md` + `SPEC.md` §13

---
*STATE.md, updated after every significant action.*
