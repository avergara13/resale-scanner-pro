## Context / Why

<!-- Explain the motivation for this change. What problem does it solve?
     What was broken, missing, or suboptimal before this PR? Link to the
     relevant ENQ/WO if this is a governed work order, or describe the
     Spark feature iteration this wiring supports. -->

## Changes

<!-- List every file that changed and what was done to it. Be specific.
     Reviewers should be able to understand the full diff from this list
     without opening the files. -->

- `src/App.tsx` — 
- `scripts/apply-wiring.mjs` — 
- `.github/workflows/wire-and-deploy.yml` — 

## Verification

<!-- How was correctness confirmed? List every check performed:
     - GitHub Actions run result (link if available)
     - Local wiring script run output
     - deploy/production branch sync confirmed
     - Notion Live Activity page updated
     - Live URL behavioral smoke (if Deploy_Scope: live-app-complete) -->

- [ ] `node scripts/apply-wiring.mjs` ran clean — all checks ✅ or anchor-miss warnings documented
- [ ] `git diff origin/main origin/deploy/production --name-only` = 0 files
- [ ] GitHub Actions Wire + Deploy job: PASSED
- [ ] Notion Live Activity: `✅ DEPLOYED` callout present

## Risk / Rollback

<!-- What breaks if this is wrong? How do you revert?
     Be honest about any unknowns or partial confidence. -->

**Rollback:** `git revert <commit-sha>` on `main` — Actions will re-run and push
the reverted state to `deploy/production` within ~2 minutes.

**Risk level:** Low / Medium / High — <!-- pick one and explain -->
