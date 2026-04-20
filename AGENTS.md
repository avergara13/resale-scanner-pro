# Resale Scanner Pro — Engineering Protocol

> Governs Codex behavior across all sessions.
> Source of truth for workflow, PR standards, and deployment gates.
> Committed to the repo so it persists across sessions and is version-controlled.

---

## 1. Development Workflow

All work follows six phases in sequence. No phase is skipped.

### Phase 1 — Plan
- All work begins in plan mode.
- The plan file is written and iterated until the user explicitly approves.
- No code is written, no files changed, no commands run during planning.
- `AskUserQuestion` for genuine ambiguity only. `ExitPlanMode` to request approval.

### Phase 2 — Execute
- Begins only after user approves the plan.
- Runs to completion without pausing unless a blocker requires user input.
- All commits go on the designated feature branch (e.g. `fix/camera-not-opening`, `ui/visual-polish`).
- Build must pass (`npm run build`) before execution is considered done.

### Phase 3 — PR Gate (user-controlled pause)
When execution is complete and build is clean, Codex asks:
> "Build is clean. Ready to open the PR, or do you have more changes to add first?"

Codex does **not** open the PR automatically. The user gives explicit approval.

### Phase 4 — PR Creation
See Section 3 for PR title and body standards.
Codex subscribes to PR activity (`subscribe_pr_activity`) immediately after opening the PR.

### Phase 5 — Review Loop (autonomous within bounds)
When Copilot (CE-VS) or reviewers post comments:
- **Tractable, unambiguous fix** → Codex implements, commits, pushes, replies to comment.
- **Ambiguous or architectural** → Codex asks the user before acting.
- **Already fixed / outdated thread** → Codex notes it and skips.

Codex does **not** merge autonomously.

### Phase 6 — Merge Gate (user-controlled pause)
When all checks pass and comments are resolved, Codex asks:
> "All checks are green and review comments are resolved. Ready to merge?"

User gives explicit approval. Codex confirms Wire + Deploy ran successfully after merge.

---

## 2. Branch Strategy

### Protected Branches

| Branch | Owner | Purpose |
|--------|-------|---------|
| `main` | User | Source of truth. All PRs target this. No direct pushes. |
| `deploy/production` | CI only | Railway watches this. Never push manually. |

### Work Branches (one branch = one unit of work)

| Prefix | When to use | Example |
|--------|-------------|---------|
| `ui/` | Visual changes, layout, styling, dark mode | `ui/visual-polish` |
| `feature/` | New functionality | `feature/ai-agent-capabilities` |
| `fix/` | Bug that's breaking something | `fix/camera-not-opening-on-ios` |
| `refactor/` | Restructuring code without changing behavior | `refactor/split-server-routes` |
| `chore/` | Maintenance, cleanup, no user impact | `chore/remove-unused-dependencies` |
| `docs/` | Documentation only | `docs/api-reference` |

### Rules

- **Maximum 3 active branches at any time** — prevents stale branches and merge conflicts.
- **One concern per branch** — never mix UI changes into a feature branch or vice versa.
- **Merge or close within one week** — stale branches create conflicts. If a branch goes stale, close it and start fresh.
- **Branch names must describe the work** — no cryptic hashes or generated slugs. A beginner engineer should understand the branch purpose from the name alone.

### Lifecycle

branch created → commits → PR opened → CI gates pass → Codex + Copilot review → fixes applied → user approves merge → Wire + Deploy pushes to deploy/production → Railway deploys → branch deleted.

### Runtime Agent Teams (future)

When Loft OS Runtime orchestrates autonomous agents, each agent team gets its own branch following the same naming convention. Agent branches go through the same PR → CI → review → merge pipeline as human branches. No shortcuts.

---

## 3. PR Standards

PRs are read by engineers, collaborators, and investors. Every PR must meet this bar.

### Title
`<type>(<scope>): <what changed and why — max 72 chars>`

Types: `fix` `feat` `refactor` `ci` `chore` `docs`

Good examples:
- `ci: add type-check and lint gates before Railway deploy`
- `fix: restore SoldScreen Notion integration, rename title to Shipping Center`
- `feat: add Pirate Ship label integration and shipping rate card to SOLD screen`

Bad examples (never do these):
- "Update stuff" — vague
- "Revolutionary new SOLD screen" — exaggerated
- "Fixed the bug" — no context

### Body (four required sections)

```
## Summary
- <What changed and WHY — not just "changed X" but "changed X because Y was broken">
- <2–4 bullets maximum — one bullet per coherent logical change>

## Technical Detail
- `path/to/file.tsx` — what changed and the mechanism by which it fixes the problem
- Every changed file listed. Non-obvious changes explained.

## Test Plan
- [ ] <Specific, reproducible step — e.g., "SOLD tab → dark mode → 'Shipping Center' heading visible">
- [ ] Every claim in Summary has a corresponding checkbox here.
- No vague entries like "tested on phone" — be specific about what was tested.

## Risk & Rollback
**Risk:** Low / Medium / High — <one sentence explanation>
**Rollback:** `git revert <sha>` on main → CI redeploys in ~2 min.
<Any unknowns or partial confidence disclosed here.>
```

### Never
- Hallucinate check results — only report what actually ran
- Exaggerate ("revolutionary", "completely reimagined", "production-ready")
- List files that weren't changed
- Omit the test plan
- Describe what code does instead of what problem it solves

---

## 4. Deployment Gates

The following must all pass before any code reaches Railway:

| Order | Step | Command | Catches |
|-------|------|---------|---------|
| 1 | Wiring validation | `node scripts/apply-wiring.mjs` | Broken App.tsx wiring anchors |
| 2 | Type check | `npx tsc --noEmit` | Interface drift, prop mismatches, missing types |
| 3 | Lint | `npm run lint` | Code quality regressions |

**Not in CI gates:** `npm run build` — Railway runs this itself. Duplicating it wastes ~12s per deploy.

**Concurrency:** `cancel-in-progress: true` — the latest commit always wins. Stale in-progress deploys are cancelled automatically.

**Wiring anchor misses** are non-fatal (warn + continue). The tsc + lint gates catch any code issues they introduce. A stale anchor is a maintenance note, not a deploy blocker.

**Fatal failures** (App.tsx integrity guards with `fatal: true`, all backend route guards) always block deploy — no bypass exists. Fix the root cause before deploying.

---

## 5. Commit Standards

- One logical change per commit.
- Format: `<type>: <what changed and why>`
- Session URL appended as trailer (Codex requirement — do not omit).
- Never amend published commits. Create a new commit.
- Never use `--no-verify`.

---

## 6. User Approval Required For

Codex does not do any of the following without explicit user instruction:

| Action | Why it requires approval |
|--------|--------------------------|
| Open a PR | User may have more changes to add |
| Merge a PR | User controls when code goes to production |
| Push to `main` directly | Bypasses review |
| Push to `deploy/production` directly | Bypasses CI gates |
| Force-push any branch | Destructive — can overwrite work |
| Delete a branch | Irreversible pointer removal |
| `git reset --hard` / `git clean -f` | Destructive — can lose uncommitted work |

---

## 7. Core vs Shell Architecture

### The Model

The app has two layers with different stability contracts:

**Core (stable — survives every UI redesign):**

| Layer | Files | Guarded by |
|-------|-------|------------|
| Backend API | `server.js` | `apply-wiring.mjs` BACKEND_GUARDS (fatal) |
| Service layer | `src/lib/*.ts` | tsc type-checking |
| Type contracts | `src/types/index.ts` | tsc type-checking |
| Wiring script | `scripts/apply-wiring.mjs` | CI + manual review |

**Shell (interchangeable — redesign freely with Spark or any AI design tool):**

| Layer | Files |
|-------|-------|
| App orchestration | `src/App.tsx` |
| Screen components | `src/components/screens/*.tsx` |
| UI primitives | `src/components/ui/*.tsx` |

### Replugging After a Shell Redesign

When Spark (or any design tool) publishes a new App.tsx shell:

1. `node scripts/apply-wiring.mjs` — injects standard service wiring; backend guards confirm server.js is intact
2. Read the anchor-miss ⚠️ warnings — those are the manual reconnection tasks for this shell
3. `npx tsc --noEmit` — prop mismatches and missing types surface here
4. `npm run lint` — remaining wiring errors surface here
5. Fix each anchor miss manually, reconnecting services/handlers to the new component structure
6. Repeat until clean → open PR → CI gates → merge → deploy

Anchor-miss warnings are the expected "reconnect these" TODO list. They are non-fatal by design.

### Boundary Exception (5 Screens with Direct Service Imports)

These screens import from `src/lib/` directly instead of receiving services as props:
`AIScreen`, `AgentScreen`, `CostTrackingScreen`, `ListingDetailScreen`, `SoldScreen`

When a design tool redesigns these screens from scratch, the direct imports are lost and must be manually re-added (or the screen refactored to receive the service as a prop from App.tsx). The wiring script does not guard these — tsc will surface missing imports as type errors.

---

# Resale Scanner Pro

Project: Resale Scanner Pro (RSP)

This file is the short project brief for Codex sessions in this repo. For full operating context, priorities, handoff notes, and Notion links, see `CONTEXT.md`.

## Stack

- Frontend: React + Vite
- Backend/Data: Supabase
- AI: Gemini + Codex API
- Deploy: Railway
- Integrations: eBay Sell API, Notion bridge

## Current Phase

Phase 3 active.

## Live Infra

- Railway URL: https://resale-scanner-pro-production.up.railway.app
- Supabase project ID: `zfbaijiynnwxasyyqglg`

## Non-Negotiable Rules

1. All PRs must use A77 format: `scope: imperative description` with `Context/Why`, `Changes`, `Verification`, and `Risk/Rollback`.
2. Write Supabase first for durable product data and workflow state; treat downstream mirrors and secondary systems as follow-on sync targets.
3. No inline tokens, secrets, or hardcoded credentials in code, config, workflow JSON, or docs.
4. Every PR merge requires a Checksum Registry update in Notion.
5. Update Active Workstreams through the Notion bridge when work status changes.

## Reference

Read `CONTEXT.md` before substantial work. It is the authoritative project-specific context file for this repo.
