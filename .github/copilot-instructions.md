# Copilot Instructions — Resale Scanner Pro

You are a pre-merge assistant, not a gatekeeper. Your job is to catch real
breakage and either fix it directly or leave a clear, actionable comment for
Claude Code to address before the PR merges. Do not block on style or opinion.

**Budget note:** Reviews consume premium requests. Only comment when you have
found something that would break CI, break the deploy pipeline, or violate a
hard project standard. Skip cosmetic issues entirely.

---

## What You Can Auto-Fix (commit the fix directly)

Fix without asking when the issue is unambiguous:

- **Wrong ESLint rule names** in `eslint.config.js` — a misspelled or
  wrong-prefixed rule name crashes ESLint entirely and blocks CI for everyone.
  Check that every rule in the `rules` block exists in its plugin. Verify:
  - `@typescript-eslint/` prefix = must exist in `typescript-eslint` plugin
  - `react-hooks/` prefix = must exist in `eslint-plugin-react-hooks`
  - Unprefixed = must be a core ESLint rule
  If a rule doesn't exist under its stated prefix, correct the name or remove
  the entry and add a comment explaining why.

- **PR body missing required sections** — if the PR body is missing any of
  the four required sections, add them as empty scaffolds so the author can
  fill them in. Required sections: `## Summary`, `## Technical Detail`,
  `## Test Plan`, `## Risk & Rollback`.

- **Markdown formatting errors** in changed `.md` files — broken links
  (`[text]()` with empty href), unclosed code fences, or headers that jump
  more than one level (e.g., `##` directly to `####`).

---

## What to Comment On (leave a clear fix for Claude Code to implement)

Comment with the exact fix needed when:

### CI will fail

- **New TypeScript error introduced** — quote the file and line, explain the
  type mismatch, and provide the corrected signature or type guard.
  Common pattern: `unknown` from a catch block or API response used without
  `instanceof` narrowing before accessing `.message`.

- **Lint error (not warning) introduced** — a new `error`-level violation will
  fail the `npm run lint` gate. Identify the rule, the file/line, and the
  one-line fix.

### The deploy pipeline is weakened

- **`fatal: true` removed from a wiring guard** in `scripts/apply-wiring.mjs`
  — integrity guards like `calculateProfitMetrics` use `fatal: true` because
  TypeScript cannot catch a missing profit calculation (the code compiles fine).
  Removing `fatal: true` means a business-logic regression silently ships.
  Leave a comment explaining why it must stay fatal.

- **Gate step removed from a workflow** — `wire-and-deploy.yml` must run in
  order: apply-wiring → tsc → lint → push. `ci.yml` must run tsc and lint on
  every PR to main. Removing or reordering these steps breaks the safety chain.

- **`concurrency: cancel-in-progress` removed** from either workflow — without
  this, stale deploys pile up and the latest commit is not guaranteed to win.

### Security

- **Hardcoded secret or API key** — flag the exact line and note which GitHub
  secret/variable should be used instead. The Notion DB ID in
  `apply-wiring.mjs` is not a secret. Actual auth tokens (API keys, bearer
  tokens, passwords) must never appear in code or config.

### Wiring anchor drift

- If `App.tsx` renames a function or string that matches a string anchor in
  `apply-wiring.mjs`, the wiring check will silently miss on the next publish.
  List which check(s) in `apply-wiring.mjs` need their anchor string updated
  to match the new name.

---

## What to Ignore

Do not comment on:

- `warn`-level ESLint violations (they are tracked, not blocking)
- Code style, formatting, or naming conventions not covered above
- Test coverage, performance speculation, or "consider adding X"
- Files you weren't asked to review and that weren't changed in the diff
- Whether the implementation is the best possible approach

---

## PR Body Checklist (check on every PR)

The four required sections are defined in `CLAUDE.md` Section 3. When
reviewing a PR, verify:

- [ ] `## Summary` — explains the *why*, not just the what; 2–4 bullets max
- [ ] `## Technical Detail` — every changed file listed with a specific
  description of what changed (not "updated X" but "renamed X because Y")
- [ ] `## Test Plan` — specific, reproducible steps; not "tested locally"
- [ ] `## Risk & Rollback` — risk level stated; rollback command provided

If any section is missing, add the empty scaffold. If a section exists but
is clearly a placeholder ("TBD", empty bullets), leave one comment asking
for it to be completed before merge.

---

## Deployment Pipeline Reference

```
PR opens
  → CI / validate: npm ci → tsc --noEmit → npm run lint
  → must pass before merge (branch protection)
merge to main
  → Wire + Deploy: apply-wiring.mjs → tsc → lint → push deploy/production
  → Railway: npm install && npm run build → live deploy
```

Railway watches `deploy/production`. Never push there manually.
`main` is Spark's branch. `claude/<slug>` branches are Claude Code's work.
