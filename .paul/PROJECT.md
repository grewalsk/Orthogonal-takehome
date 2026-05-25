# Orthogonal Chat

## What This Is

A web chat where Claude Sonnet 4.6 has typed access to Orthogonal's universal API gateway. Users ask for real-world data (companies, people, emails, web results) and the assistant fetches it through Orthogonal, persists every byte for audit, and renders results inline as structured cards.

Built as a take-home assignment. Source of truth for every technical decision lives in `SPEC.md` at the repo root. This `.paul/` layer tracks build progress against `SPEC.md` §13.

## Core Value

Real-data research chat with a context engineering layer that keeps per-turn input cost roughly flat as the conversation grows. The four-primitive context engineering design is the central technical contribution.

## Current State

| Attribute | Value |
|-----------|-------|
| Type | Application |
| Version | 0.0.0 |
| Status | Initialized, ready for Phase 1 |
| Last Updated | 2026-05-25 |

## Requirements

### Core Features

1. **Web chat backed by Claude Sonnet 4.6** with typed access to a curated subset of Orthogonal's catalog (8 to 12 typed tools).
2. **Real upstream data** rendered as structured cards (contact, company, search results).
3. **Conversation persistence** keyed by URL, hydrated from Postgres on page load.
4. **Context engineering layer** with four primitives:
   - Content-addressed tool results with per-endpoint Zod projections + `read_tool_result` drill-in.
   - Structured memory (jsonb on `conversations`) with pre-eviction Haiku 4.5 extraction and a sliding token-budgeted window.
   - Rolling Anthropic prompt cache with two breakpoints alternating per turn.
   - Cross-conversation Upstash Redis cache keyed by `hash(endpoint, canonical_input)` with single-flight Redis NX locks.
5. **README leading with context engineering decisions** and including measured numbers (cache hit rate, projection compression ratio, cost per turn).

### Validated (Shipped)

None yet.

### Active (In Progress)

Phase 1: Bootstrap and verification.

### Planned (Next)

Phases 2 to 7, mapped to `SPEC.md` §13 in `.paul/ROADMAP.md`.

### Out of Scope (v1, per `SPEC.md` §0)

- Multi-user auth (single shared instance).
- Resumable streams across page refreshes.
- Conversation export, regeneration, edit-and-resend.
- Mobile-native (mobile-responsive web is enough).
- Bring-your-own-key UI.
- Streaming partial tool results from upstream providers.

## Constraints

### Technical Constraints

- Vercel Hobby tier with Fluid Compute, 300s function ceiling, single region.
- One Anthropic key with standard rate limits.
- Tool palette generated at build time from a committed catalog snapshot. The LLM never calls `/v1/search` at runtime (search service is degraded per probe findings in `SPEC.md` §4).
- Tool wrapper enforces 30s timeout, 2 retry max with jitter, in-memory circuit breaker (5 failures in 60s, 60s OPEN window).
- `stepCountIs(8)` caps the agentic loop per user turn.
- Postgres failure fails closed (audit integrity). Redis failure is non-fatal.

### Business Constraints

- One Orthogonal account with $5 to $10 of free credits, no billing on file.
- $0.25 silent execution cap per turn. Above that, surface a confirmation in the UI.
- Take-home deadline driven by reviewer availability (`christianpickettcode`, `berasogut` invited if private).

## Key Decisions

Locked before any code is written. From `SPEC.md` §2.

| # | Decision | Choice | Status |
|---|----------|--------|--------|
| 1 | MCP vs REST against Orthogonal | REST. Spike `mcp.orth.sh` briefly first; if it does not stream cleanly through Vercel functions, drop it. Document the result. | Locked, spike pending in Phase 1 |
| 2 | Hero demo prompt | "Research Stripe: give me the company, the CEO's email, and the top 5 sales hires from the last year." | Locked |
| 3 | Endpoint scope | Whatever endpoints the hero prompt requires across the 5 providers in the catalog, plus 1 cheap scrape and 1 web-search endpoint for breadth. Target 8 to 12 typed tools total. | Locked |
| 4 | Tool granularity | One typed tool per endpoint, generated at build time from the catalog snapshot. No freeform `run(api, path, body)` exposed to the model. | Locked |
| 5 | Context engineering primitives in v1 | Four: content-addressed tool results with per-endpoint projections; structured memory with pre-eviction extraction; rolling prompt cache; cross-conversation Redis cache. | Locked |
| 6 | Persistence stack | Neon Postgres + Drizzle + `@neondatabase/serverless` Pool driver. Upstash Redis for the cross-conversation cache and rate limiting. | Locked |
| 7 | Cost gating | Silent execution up to $0.25 per turn. Above that, surface a confirmation in the UI. Running cost meter always visible. | Locked |

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Hero prompt completes end-to-end on deployed URL | Pass | - | Not started |
| Cache read percentage by turn 3 | > 0% (non-zero confirms rolling cache hits) | - | Not started |
| Cross-conversation cache hit rate on repeat hero runs | > 0% | - | Not started |
| Per-turn input cost flat across turns | Slope near zero past turn 5 | - | Not started |
| README leads with context engineering and includes measured numbers | Yes | - | Not started |
| Reviewers invited | `christianpickettcode`, `berasogut` if private | - | Not started |

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Framework | Next.js 15 App Router | Node runtime, Fluid Compute, `maxDuration = 300` |
| AI SDK | `ai`, `@ai-sdk/react`, `@ai-sdk/anthropic` | Vercel AI SDK 5 |
| Main model | `claude-sonnet-4-6` | Sonnet 4.6 for the main loop |
| Extraction model | `claude-haiku-4-5-20251001` | Haiku 4.5 for pre-eviction extraction. No Opus. |
| Database | Neon Postgres via `@neondatabase/serverless` Pool driver | Pool (not HTTP) for transactional tool-call writes |
| ORM | Drizzle ORM with `drizzle-kit` | Migrations committed |
| Cache | `@upstash/redis`, `@upstash/ratelimit` | Cross-conversation cache, single-flight locks, rate limiting |
| UI | Tailwind, shadcn/ui, `lucide-react`, `next-themes` | Dark mode via `next-themes` |
| Markdown | `react-markdown` + `rehype-shiki` | Syntax highlighting |
| Validation | Zod | Tool inputs and projection outputs |
| Hosting | Vercel Hobby + Fluid Compute | Single region |

No optional libraries get added without writing the reason in the README under "trade-offs".

## Deferred Work (post-submission)

In priority order, from `SPEC.md` §14.

1. Provenance and inline citations (`[src:tr_X]` clickable references).
2. Multi-user auth (Clerk or Auth.js).
3. Resumable streams (`resumable-stream` + Redis stream registry).
4. RAG over conversation history (`pgvector` embeddings on evicted messages).
5. Inngest for long-running tool calls (background scrapes).
6. MCP migration once `mcp.orth.sh` documents auth and streams cleanly.
7. Per-user Orthogonal keys.

---
*Created: 2026-05-25*
*Source of truth: `SPEC.md` at repo root. This file is a PAUL-facing summary; `SPEC.md` is canonical.*
