# Contributing — Resale Scanner Pro

> Vergara Inc · Loft OS v1.0 · PRJ-009

## Commit + PR Standards

All changes to this repo follow the Vergara Inc A77 engineering standard.

### PR Title Format

```
<scope>: <imperative verb> <what changed> — <why in brief>
```

Examples from this repo:
- `feat: wire listing optimization and Notion push into AgentScreen`
- `fix: eBay Finding API CORS fallback — gracefully falls back to Gemini data if browser blocked`
- `ci: correct workflow step order, consolidate git config, fix anchor-miss tracking`
- `perf: skip Google Lens on high-confidence Gemini scans, disable in batch mode`
- `docs: register PRJ-009 Resale Scanner Pro in AGENTS.md topology table`

### PR Body — Required Sections

Every PR must include all four sections. No placeholders. No TBD.

```
## Context / Why
Why this change exists. What problem it solves. Reference ENQ/WO if governed.

## Changes
Bullet list of every file changed and what was done to it.

## Verification
Every check performed: Actions run, wiring script output, live URL smoke if applicable.

## Risk / Rollback
Rollback steps. Honest risk assessment.
```

### Commit Message Format

```
<type>(<scope>): <description>

<body — required for non-trivial commits>

<footer — issue refs, breaking change notes>
```

Types: `feat`, `fix`, `ci`, `perf`, `docs`, `refactor`, `test`

---

## Multi-Agent Lane Separation

Three agents touch this repo. They never step on each other because each owns
distinct surfaces and branches.

| Agent | A77 Role | Owns | Never touches |
|---|---|---|---|
| **Claude (this chat)** | SA-VS | `main` wiring commits, `server.js`, docs, Notion, AGENTS.md topology table | WO branches, Railway UI, Supabase, n8n |
| **VS Code Copilot/Codex** | CE-VS | WO branches, PRs, Railway/Supabase/n8n setup, A77 WO execution | Force-pushing to `main`, `deploy/production` |
| **GitHub Actions** | Automation | `deploy/production` exclusively — triggered by every clean `main` push | N/A — automated only |
| **GitHub Spark** | Rapid proto | Spark-generated commits to `main` | Governance branches, CI config |

### Six rules that prevent conflicts

**Rule 1 — Branch ownership is exclusive.**
Claude commits to `main` only (wiring, docs, server.js). CE-VS works on WO branches
and merges via PR. Spark publishes to `main`. These never collide because they live
on separate branches until a WO PR merges.

**Rule 2 — `deploy/production` is Actions-only after pipeline is live.**
No agent manually force-pushes to `deploy/production` once the pipeline is running.
If a sync is needed, trigger `workflow_dispatch` on Wire + Deploy.
Emergency manual syncs must note `[emergency-sync]` in the commit message.

**Rule 3 — Wiring is idempotent, so merge order does not matter.**
When any WO PR merges to `main`, Actions re-runs `apply-wiring.mjs`. Already-wired
code is detected and skipped. Missing wiring is re-applied. CE-VS cannot accidentally
un-wire integrations by merging feature changes.

**Rule 4 — AGENTS.md topology table is SA-VS territory between WOs.**
Claude updates the topology table in `loft_os_architect/AGENTS.md` directly
(app name, PRJ, deploy branch, status). If a WO also touches it, the WO allowlist
declares it and the PR body describes the change. WO change wins on conflict.

**Rule 5 — Sous Chef WOs (225, 226+) and Resale Scanner work are fully parallel.**
`loft_os_architect` WO branches and `resale-scanner-pro` main are in separate repos.
CE-VS executing WO-225 on `loft_os_architect` has zero overlap with Claude
wiring `resale-scanner-pro`. No coordination needed between those lanes.

**Rule 6 — SA-VS drafts; CE-VS executes. Never in the same message.**
Claude drafts the WO and stops. CE-VS picks it up in VS Code after the ED token.
There is no in-chat execution handoff. Planning and execution are always separate turns.

### Handoff pattern (fast path)

```
Claude (SA-VS, this chat)            VS Code Copilot (CE-VS)
─────────────────────────            ──────────────────────────
Sketch → ENQ → WO draft   ────→     Open loft_os_architect in VS Code
                                     Pin the WO file
ED: "Approved to Execute: <WO_ID>"  ← ED issues token in chat
                                     Execute → branch → PR → merge → closeout
Update Notion, topology,   ←────    Certification Handoff Packet posted in chat
wiring if needed (parallel)
```

Claude's Notion/wiring work and CE-VS's branch work run simultaneously.
They only synchronize at two points: ED token issuance and Certification Handoff.

---

## Architecture Record — What Was Built and Why

This section serves as the permanent engineering record for the initial build of
Resale Scanner Pro. All of these changes were made as direct pushes during the
initial architecture session (April 2026) before the PR template was established.

---

### `server.js` — Static File Server
**Date:** 2026-04-03 · **SHA:** `8c15c28`

**Context / Why:**
Railway requires a start command that serves the built Vite output. The app is a
pure React/Vite frontend with no Express backend. The correct pattern — proven
in production on Sous Chef (PRJ-006) — is a minimal Node `http` server that
serves `dist/` as static files with SPA fallback routing and a `/health` endpoint
for Railway's health checks.

**Changes:**
- `server.js` — new file. Node http server (no dependencies), reads
  `process.env.PORT` from Railway env injection, serves `dist/` with SPA routing,
  `/health` returns `ok`. Identical pattern to `avergara13/sous-chef-app`.

**Verification:**
- Pattern confirmed live on `https://sous-chef-production.up.railway.app`
- `/health` endpoint confirmed working on Sous Chef
- `distDir = path.join(__dirname, 'dist')` matches Vite's output directory

**Risk / Rollback:** Remove `server.js` and set Railway start command to
`npx serve dist -l $PORT`. No app code touched.

---

### `.github/workflows/wire-and-deploy.yml` — CI/CD Pipeline
**Date:** 2026-04-03 · **SHA:** `70f4b24` (initial), `e70e7ea` (audit fix)

**Context / Why:**
GitHub Spark publishes UI changes directly to `main`, which would overwrite
integration wiring on every UI iteration. The pipeline solves this by intercepting
every push to `main`, re-applying all integration wiring idempotently via
`scripts/apply-wiring.mjs`, and pushing the wired result to `deploy/production`.
Railway watches `deploy/production` only — Spark's `main` publishes never reach
Railway directly. Notion's Live Activity page is updated on every deploy outcome.

**Changes:**
- `.github/workflows/wire-and-deploy.yml` — GitHub Actions workflow. Steps:
  checkout, setup Node, configure git identity, apply wiring, commit if changed
  (`[skip ci]` to prevent loops), force-push to `deploy/production`, log
  `✅ DEPLOYED` or `❌ FAILED` callout to Notion Live Activity page.

**Verification:**
- `deploy/production` confirmed in sync with `main` (0 file diff)
- `NOTION_API_KEY` guard: `[ -z "$NOTION_API_KEY" ] && exit 0` — safe when absent
- `continue-on-error: true` on all Notion steps — deploy never blocked by Notion
- Audit confirmed: no-op "mark in progress" step removed, git config consolidated

**Risk / Rollback:** Disable the Actions workflow in GitHub UI. Direct-push to
`deploy/production` to revert. No app functionality affected.

---

### `scripts/apply-wiring.mjs` — Idempotent Wiring Engine
**Date:** 2026-04-03 · **SHA:** `70f4b24` (initial), `e70e7ea` (audit fix)

**Context / Why:**
Spark re-generates `src/App.tsx` on every publish, removing integration code
(service instantiation, handler functions, JSX props). The wiring script re-applies
these integrations on every CI run using string-anchor detection. Each check is
independent and idempotent — if the wiring is already present, it's skipped. If
Spark removed it, it's re-applied. If Spark refactored an anchor, the script
logs a clear warning and the deploy continues with partial wiring.

**Changes:**
- `scripts/apply-wiring.mjs` — 6 wiring checks (sequentially numbered 1–6):
  1. Import `createListingOptimizationService`
  2. Import `createNotionService`
  3. Instantiate both services as `useMemo` hooks
  4. Pre-fill `notionDatabaseId` default (Hobbyst Resale Inventory DB)
  5. Add `handleOptimizeItem` + `handlePushToNotion` handlers
  6. Wire `onOptimizeItem` + `onPushToNotion` props into `AgentScreen` JSX

**Verification:**
- All 6 checks confirmed present in `src/App.tsx` (12 wiring references at audit)
- `anchorMissCount` tracking added — warnings are explicit and actionable
- Script output: each check reports `✅ Already wired` or `🔧 Applied`

**Risk / Rollback:** Add `detect: () => true` to any check to permanently disable
it. Anchor misses are non-fatal — deploy continues with a warning.

---

### Integration Wiring — `src/App.tsx`
**Date:** 2026-04-03 · Various SHAs

**Context / Why:**
Spark's `AgentScreen` component was built with `onOptimizeItem` and `onPushToNotion`
props that were never connected — both were `undefined` in production. The
`ListingOptimizationService` and `NotionService` were instantiated as classes in
`src/lib/` but never wired into the app's state graph.

**Changes:**
- `src/App.tsx` — imports added for both services. `useMemo` hooks instantiate
  both services reactive to settings changes. `handleOptimizeItem` calls listing
  optimization and writes `optimizedListing` + `listingStatus: 'ready'` to queue.
  `handlePushToNotion` calls Notion API, writes `notionPageId` + `notionUrl` back
  to queue item. Both handlers passed to `AgentScreen` via JSX props.
  `notionDatabaseId` default pre-filled: `7e49058fa8874889b9f6ae5a6c3bf8e7`
  (Hobbyst Resale Inventory DB).

**Verification:**
- 12 wiring references confirmed in `src/App.tsx` at audit
- `AgentScreen` JSX confirmed: `onOptimizeItem={handleOptimizeItem}` at line 885,
  `onPushToNotion={handlePushToNotion}` at line 886

**Risk / Rollback:** Handled automatically by `apply-wiring.mjs` — re-applied on
next CI run if accidentally removed.

---

### Cost Optimizations — eBay Finding API + Google Lens
**Date:** 2026-04-03 · **SHA:** `58b8ea3`, `68f15fb`

**Context / Why:**
At 7 items/month scanning volume, all API calls fall within free tiers. However,
two specific optimizations protect quota at any volume and make the pipeline
resilient to service degradation.

**Changes:**
- `src/App.tsx` — Google Lens skipped when Gemini confidence ≥ 92%. Saves a
  Custom Search API call on clearly identified items. Batch mode disables
  Google Lens entirely — eBay data is sufficient for GO/PASS decisions at volume.
- `src/lib/ebay-service.ts` — CORS error handling added to both `fetchCompletedItems`
  and `fetchActiveListings`. Network errors return `[]` instead of throwing.
  eBay Finding API is designed for browser use (App ID is public), but
  occasionally rejects browser requests — silent fallback to Gemini market data.

**Verification:**
- CORS fallback path confirmed: `catch (corsError) → return []` with console.warn
- Confidence threshold of 0.92 set above typical clear-match floor (~0.85)
- Pipeline confirmed: Lens-skipped path still completes all 5 stages

**Risk / Rollback:** Set confidence threshold to `0` to always run Lens. Remove
`false &&` from batch Lens disable to re-enable.

---

*Vergara Inc · Loft OS v1.0 · PRJ-009 Resale Scanner Pro*
*Engineering record authored by SA-VS (Claude) · April 2026*
