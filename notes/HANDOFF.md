# Orthogonal Chat — Handoff for the next chat

Read this top to bottom before doing anything. It will save you hours.

## What this is

A take-home build. v0.1 shipped and submitted earlier; the user is now extending it before final submission. Repo: https://github.com/grewalsk/Orthogonal-takehome. Live: https://orthogonal-chat.vercel.app.

`SPEC.md` at the repo root is the source of truth for the original design. `.paul/STATE.md` is the audit log of every decision and deviation across the 35 build steps. `README.md` is the user-facing summary with measured numbers. Read SPEC.md if you need to ground a decision; read STATE.md to know what was already tried.

## Mission for this phase

The user wants to:

1. **Expand the Orthogonal endpoint set** beyond the current 9 tools. Spec caps at 12. Three slots left.
2. **Implement improvements** in each of the 5 challenge areas (context window, persistence, system design, concurrency, slow/down). Priority list is below.
3. **Frontend polish.**
4. **Debug pass end-to-end.**
5. **Update README** with an in-depth context-engineering explanation for all 5 challenge areas, and a **Mermaid system-design diagram**.
6. **Final submit.**

User explicitly wants to **collaborate at each step on what to use vs not use**. Do not ship sweeping changes without checking priorities first. Ask before each meaningful chunk.

## Working agreement (locked from the original build)

1. Build order: phases in SPEC.md §13 (you are past phase 7; treat new work as phase 8+).
2. Locked decisions (SPEC.md §2) are not up for debate. Flag if you think one is wrong; wait for confirmation.
3. Tech stack (SPEC.md §3) is fixed. No library substitutions without asking.
4. **Small commits.** After each meaningful chunk: `git add -A && git commit && git push`. Commit messages reference the phase/step. No `git add .` (use `-A` per the user's prior preference).
5. Ask when SPEC.md is ambiguous. Don't guess on architecture. Do guess on naming and trivial style.
6. **No em dashes** in code comments, commit messages, or docs. Use periods, commas, or " - " instead.
7. After each meaningful change, run a sanity check appropriate to it before moving on.
8. **No "Co-Authored-By: Claude" lines in commit messages.** The user removed this explicitly.
9. Tell the user the step number, what you did, what's next, after each step. Wait for "go" before the next step unless they chained.

## Critical landmines that will burn your time

Each of these took me real time to figure out. Don't re-discover.

- **Node version:** must be 22.14.0 via nvm. Project has `.nvmrc`. The Claude Code harness pre-builds `PATH` with Node 18 first. **Prefix every node/pnpm/npx command with `export PATH=/Users/kabirgrewal/.nvm/versions/node/v22.14.0/bin:$PATH && ...`** or run `which node` first to verify. Without this, you'll see `ERR_PNPM_RECURSIVE_EXEC_NO_PACKAGE` or pnpm crashes.
- **pnpm version:** pinned to 9.15.4. **Do not use pnpm 10 or 11.** Their `minimum-release-age` supply-chain policy will reject our recent dependencies. Pinned via Corepack already.
- **Bash cwd resets between tool calls.** Always `cd /Users/kabirgrewal/Orthogonal-takehome && ...` at the start of every Bash command, or you will see "not a git repository" or "no package.json" errors that are misleading.
- **Anthropic env collisions from the harness:**
  - Harness exports `ANTHROPIC_BASE_URL=https://api.anthropic.com` (without `/v1`). `@ai-sdk/anthropic` reads it and tries to POST `/messages` (404).
  - Harness exports `ANTHROPIC_API_KEY=""` (empty). Next.js does not override existing env vars from `.env.local`.
  - Fixed via `lib/env.ts` (force-loads `.env.local` with `override: true`) imported as the first line of `lib/llm.ts`, plus an explicit `baseURL: "https://api.anthropic.com/v1"` passed to `createAnthropic`. Don't touch these unless you understand why.
- **Vercel deploys are NOT auto-triggered by GitHub push.** The project is CLI-linked, not GitHub-connected. After `git push`, you must manually run `pnpm exec vercel deploy --prod --yes`. Otherwise the live URL stays on the last manually-deployed commit.
- **Vercel SSO Protection** was on by default (HTTP 401 on the public URL). Disabled via `pnpm exec vercel api -X PATCH /v9/projects/prj_5kdXo4xxRwnT5kJ8vOCOw94JS0Ll --input - <<< '{"ssoProtection":null}'`. If somehow re-enabled, do this again.
- **Vercel CLI output buffering in non-TTY:** every Bash call here is non-TTY. The CLI may print nothing to stdout while still completing successfully. Always redirect to a file (`> /tmp/orth-deploy.log 2>&1`) and read the file. Don't expect realtime stdout.
- **AI SDK 6 deltas vs SPEC.md (which referenced AI SDK 5):**
  - `convertToModelMessages` is async. Await it.
  - Cache token fields are at `totalUsage.inputTokenDetails.cacheReadTokens` and `cacheWriteTokens`, not top-level. Top-level `cachedInputTokens` does not exist.
  - `tool()` is in `@ai-sdk/provider-utils` re-exported via `ai`.
  - `useChat` is in `@ai-sdk/react` and takes `messages` (renamed from `initialMessages`).
  - `toUIMessageStreamResponse({ originalMessages, generateMessageId, onFinish })` — onFinish receives `responseMessage` (UIMessage) and is where I pre-mint the assistant message id.
- **@shikijs/rehype is incompatible with react-markdown@10** because react-markdown uses `processor.runSync()` internally, and shiki is async. Removed; code blocks render as plain `<pre><code>` styled by `@tailwindcss/typography`. Don't re-add unless you swap markdown libs or render server-side. Notes/HANDOFF says so.
- **`jsonpath-plus` must stay in `package.json` deps.** Was lost once during `pnpm install --force` after a Node upgrade. Production build failed silently on Vercel until re-added. Verify with `grep jsonpath-plus package.json` before any deploy.
- **Drizzle v0.45 index syntax:** the index callback returns an array (`(t) => [index(...)...]`), not an object (`(t) => ({byX: index(...)})`). SPEC.md §9.3 example used the older object form; the schema file at `drizzle/schema.ts` uses the array form. Don't switch back.
- **`/v1/balance` does not exist** on Orthogonal. Spec referenced it but it returns 404. Cost meter aggregates `priceCents` from `tool_calls` rows in Postgres, excluding `cache_hit=true` rows.
- **`/v1/run` shape depends on upstream HTTP method.** GET endpoints with queryParams take `{api, path, query: {...}}`. POST endpoints with bodyParams take `{api, path, body: {...}}`. `lib/orthogonal/client.ts` `callOrth` selects per `paramWrapper`. When adding new endpoints, verify the method in `catalog.generated.ts` and the projection's tool call.
- **`tools.generated.ts` is hand-written**, not generated by a script. SPEC.md called it "generated" but my analysis showed that for 9 entries a script was over-engineering. Adding a tool means editing it by hand. Pattern is fully mechanical.
- **Markdown lint and the no-em-dash rule:** the user is strict about no em dashes (`—`) in code comments, commit messages, or any committed docs. The model SOMETIMES emits them. Grep before committing: `grep -c $'—' README.md notes/*.md`.

## What's done (link, don't restate)

All 35 build steps from SPEC.md §13. Full audit log: `.paul/STATE.md`. Brief summary:

- **Phase 1:** scaffold, deps, env, probe, MCP spike (REST locked)
- **Phase 2:** catalog snapshot, 9-endpoint curated set, projections, `lib/orthogonal/client.ts`, `tools.generated.ts`
- **Phase 3:** Neon Postgres, Drizzle schema (3 tables + 4 indexes), Upstash Redis, `withSingleFlight` + Postgres-backed `storeToolResult`/`loadToolResult`
- **Phase 4:** `/api/chat` route handler with `streamText`, real Tomba round-trip verified
- **Phase 5:** all 4 context primitives wired (`read_tool_result`, `memory_write/read` + Haiku eviction, anchor prompt cache, cross-conv Redis cache) and individually verified
- **Phase 6:** UI (useChat hydration, MessageList, ToolCallCard, ContactCard, CompanyCard, SearchResultList, CostMeter, EvictionMarker, ThemeToggle, error boundary, dark mode, mobile responsive)
- **Phase 7:** measurements (hero $0.25, stress $0.39 across 5 turns, 91% cache hit ratio measured, 48 facts extracted in forced-eviction demo), Vercel deploy, README

Post-submission fixes already shipped:
- `@shikijs/rehype` removed (runSync crash)
- Date awareness added to system prompt (model was interpreting "past month" against its training cutoff)
- `linkup_search` outputType description warns model away from `sourcedAnswer`

## Current curated tool set (9 endpoints)

| Slug | Provider | Method | Purpose |
|---|---|---|---|
| `apollo_organizations_enrich` | Apollo | GET | Company by domain |
| `apollo_people_match` | Apollo | POST | Person by email/name/linkedin |
| `apollo_mixed_people_search` | Apollo | POST | Filter people by company+title+seniority |
| `hunter_domain_search` | Hunter | GET | Emails on a domain |
| `hunter_email_finder` | Hunter | GET | Find specific person's email |
| `hunter_companies_find` | Hunter | GET | Company by domain (alternate) |
| `tomba_email_verifier` | Tomba | GET | Verify deliverability |
| `linkup_search` | LinkUp | POST | Web search |
| `olostep_scrapes` | Olostep | POST | Scrape a URL |

Plus context tools: `read_tool_result`, `memory_write`, `memory_read`.

## Files to read first (in order)

1. `notes/HANDOFF.md` (this file).
2. `.paul/STATE.md` — full build audit log with every deviation explained.
3. `README.md` — user-facing summary, measured numbers, the 5-challenge writeup as it stands today.
4. `SPEC.md` — original brief, source of truth for locked decisions, especially §2 (locked decisions), §7 (context engineering), §9 (data layer), §13 (build order).
5. `notes/measurements.json` — hero+stress benchmark output.
6. `notes/mcp-spike.md` — why REST is locked, why MCP is deferred.
7. `notes/probe-output.json` — raw Orthogonal API response shapes (1.3MB; grep don't read).

## Suggested ordering for this phase

Confirm each block with the user before starting. Within each block, individual commits per item.

### Phase 8: scope expansion

Add 3 more endpoints to bring total to 12 (spec cap). The current 9 covers company info, contacts, web search, and scrape, but the prompt's "whatever's available through Orthogonal" phrase is under-answered. Candidates to discuss:

- **`exa_search` or `serper_search`** — second web search provider for redundancy when LinkUp degrades.
- **`apollo_organizations_job_postings`** — hiring signals, not currently covered.
- **`predictleads_*` or `crustdata_*`** — intent signals (funding rounds, leadership changes, news triggers). The category that LLMs without API access can't answer.
- **`tomba_technology`** — what tech a site uses (BuiltWith equivalent), demo-friendly.
- **`logo_*`** — company logo for the CompanyCard, makes UI pop.
- **`elevenlabs_*`** — voice synthesis, very different category, demo-flashy.

Per added endpoint:
1. Append to `scripts/curated-endpoints.json` (3 lines: `{api, path, slug}`).
2. Run `pnpm snapshot`. This regenerates `lib/orthogonal/catalog.generated.ts`.
3. Hand-write the projection under `lib/orthogonal/projections/<slug>.ts` following the pattern of existing files. Two exports: `inputSchema` (Zod), `projectionSchema` (Zod with `result_id`, `endpoint`, `summary`, `available_paths`, `price_usd`), and a `project(raw, result_id, price_usd)` function.
4. Add import + 4-line tool entry to `lib/orthogonal/tools.generated.ts`. Follow the existing `executeTool` helper pattern.
5. `pnpm exec tsc --noEmit` clean.
6. Optionally update the structured card dispatch in `components/tool-call-card.tsx` if the new endpoint has a domain-specific UI representation.

### Phase 9: improvements (priority ordered, ask before each)

1. **Move circuit breaker to Redis.** Currently per-function-instance, so each cold start has to relearn that a provider is broken by failing 5 times. State in Redis means all instances share it instantly. Small code change in `lib/orthogonal/client.ts`. High value.
2. **Per-endpoint timeout config.** Currently 30s for everything. Olostep needs 60s; Apollo wants 5s. Add a `timeoutMs` column to `catalog.generated.ts` (or override map) and have `callOrth` read it per endpoint.
3. **Provider fallback chains in the wrapper.** When `apollo_organizations_enrich` returns `UPSTREAM_ERROR`, the wrapper transparently tries `hunter_companies_find` before bubbling the error. Move the pivot logic from "model decides" to "wrapper decides" for common-equivalent endpoints.
4. **Second rolling cache breakpoint.** The big one. Today single anchor caches tools+system. Reorder blocks in `buildModelMessages` so conversation history sits between system and the dynamic manifest/memory blocks. Add second `cacheControl` marker at the end of history. Push 91% input cache hit toward 98%.
5. **Resumable streams.** Standard pattern with the `resumable-stream` package + Redis stream registry. Survive page refresh mid-response.
6. **Edit and resend / regeneration.** UX polish but expected. Mark prior turn as soft-deleted, regenerate.
7. **Provenance citations `[src:tr_X]`** in assistant text. System prompt change to teach the format. UI affordance: render `[src:tr_X]` as a clickable link that scrolls to the source tool card.
8. **Inngest for long Olostep scrapes.** 300s function cap workaround. Background job that streams results back via SSE.
9. **Per-user rate limits + cost-aware throttling.** Requires auth first.
10. **pgvector RAG over evicted messages.** Semantic recall beyond Haiku's key-name extraction. Add `embedding vector(1536)` column to messages, embed during eviction, retrieve top-K by similarity at context-build time.

### Phase 10: frontend polish

Open-ended. Likely:

- **Conversation list sidebar** (left rail with last 20 conversations). The conversations table already has `title` + `updatedAt`.
- **Sync-compatible syntax highlighter** to replace dropped shiki (e.g. `react-syntax-highlighter` which is sync, or `rehype-pretty-code` if compatibility is verified).
- **Loading skeleton during page hydration.**
- **Streaming indicator** beyond "Working..." text.
- **Per-tool cost in the tool card header** alongside the price tag.
- **Better empty state** when a fresh conversation has no messages yet.
- **Mobile menu** for sidebar collapse.

### Phase 11: debug pass

Run, in this order:
```
cd /Users/kabirgrewal/Orthogonal-takehome
export PATH=$HOME/.nvm/versions/node/v22.14.0/bin:$PATH
pnpm exec tsc --noEmit
pnpm build
pnpm exec tsx scripts/verify-cache.ts
pnpm exec tsx scripts/verify-redis-cache.ts
pnpm exec tsx scripts/hero-and-stress.ts
```
Then manual UI walkthrough on the live URL: hero prompt, a multi-turn followup, force eviction by running 10+ turns or by manually invoking `maybeTriggerEviction` with a small budget, refresh the page mid-stream, verify CostMeter, verify ToolCallCard payload drawer, verify dark mode, verify mobile.

### Phase 12: README + Mermaid + final submit

- Update README sections for the 5 challenge areas. The current README already has measured numbers. Goal: in-depth explanation of HOW each primitive addresses each challenge. The user has detailed explanations in chat history; lift the substance, drop the chat-style framing.
- Add **Mermaid system-design diagram**. Replace or supplement the ASCII topology diagram. Use `mermaid` code fences. GitHub renders them inline.
- Update measurements table if Phase 9 changed numbers meaningfully.
- Final `git push && pnpm exec vercel deploy --prod --yes`.
- Verify live URL.

## Useful commands

```sh
# Setup (run at start of every session)
cd /Users/kabirgrewal/Orthogonal-takehome
export PATH=$HOME/.nvm/versions/node/v22.14.0/bin:$PATH

# Sanity
node --version           # expect v22.14.0
pnpm --version           # expect 9.15.4
pnpm exec tsc --noEmit   # type check
pnpm build               # production build (catches what tsc misses)

# Dev
pnpm dev                 # localhost:3000

# Catalog
pnpm probe               # Orthogonal API health
pnpm snapshot            # regenerate lib/orthogonal/catalog.generated.ts from curated-endpoints.json

# Database
pnpm db:generate         # Drizzle schema diff to migration file
pnpm db:migrate          # apply pending migrations
pnpm db:studio           # Drizzle Studio

# Measurement
pnpm exec tsx scripts/verify-cache.ts        # Anthropic prompt cache hit ratio
pnpm exec tsx scripts/verify-redis-cache.ts  # Orthogonal Redis cache (cross-conv hit)
pnpm exec tsx scripts/hero-and-stress.ts     # End-to-end measurement run, writes notes/measurements.json

# Deploy
pnpm exec vercel ls > /tmp/v.log 2>&1                   # list deploys (read /tmp/v.log)
pnpm exec vercel deploy --prod --yes > /tmp/d.log 2>&1  # deploy to production (read /tmp/d.log)
```

## Production env vars (already set in Vercel Production scope)

`ORTHOGONAL_API_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. All in `.env.local` locally; gitignored. If you need to push a new one: `printf "%s" "$VALUE" | pnpm exec vercel env add NAME production --force`.

## Vercel project facts

- Project ID: `prj_5kdXo4xxRwnT5kJ8vOCOw94JS0Ll`
- Scope: personal (`grewalskabir-8914`)
- Stable alias: `https://orthogonal-chat.vercel.app`
- SSO Protection: disabled
- Auto-deploy on Git push: **disabled** (CLI-linked, not GitHub-connected)
- Fluid Compute: enabled
- Region: iad1

## First action for the next agent

1. `cd /Users/kabirgrewal/Orthogonal-takehome` and confirm Node 22 via `which node`.
2. Read `.paul/STATE.md` and `README.md`.
3. Ask the user which Phase 8 endpoints to add (the 3 candidates) and which Phase 9 improvements to prioritize.
4. Wait for "go" before starting.
