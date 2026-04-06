> [☀️ Morning](https://www.notion.so/Morning-Brief-335f99e853ab81dea329c09543144f11?pvs=21) · [🏗️ Strategy Room](https://www.notion.so/Strategy-Room-29af99e853ab80939b18e8df3528e7b3?pvs=21) · [🛋️ Hub](https://www.notion.so/MASTER-HUB-Loft-OS-294f99e853ab80558d6ddaf2f60ddcee?pvs=21) · [🏢 Vergara Inc](https://www.notion.so/Vergara-Inc-HQ-29bf99e853ab80f78262cb58209e28f4?pvs=21) · [💼 Business](https://www.notion.so/Business-334f99e853ab8158a4d1f06a9e0d12b5?pvs=21) · [⚙️ Engineering](https://www.notion.so/Engineering-334f99e853ab8143b137f3c6df32ecc6?pvs=21) · [🎨 Creative](https://www.notion.so/Creative-334f99e853ab81a6bf4fff266dbaa329?pvs=21) · [🤖 HR](https://www.notion.so/Human-Resources-334f99e853ab81ad875bc9c03cd3bf54?pvs=21)
> 

*Project Brief for Claude Code · Resale Scanner Pro · Engineering · Vergara Inc · Copy raw content into [CLAUDE.md](http://CLAUDE.md) in repo root*

---

> ⚠️ **SCOPE RULE — This file is project-specific ONLY.**
> 

> Agent identity, roles, and universal standards live in `loft-os-architect/AGENTS.md` and `CODEX.md`.
> 

> Do NOT duplicate governance here. Reference it.
> 

---

## 🔍 Session Start — Run These First

Before any build work, Claude Code verifies:

```bash
git status
git log --oneline -5
npm run dev
```

Expected: clean state or known branch · Latest commit 984fccf or newer · App loads on [localhost](http://localhost)

---

## 🧠 Project Identity

**Resale Scanner Pro (RSP)** — Field scanning app for eBay resale.

Scan item → AI researches pricing → Generate listing → Push to eBay.

**Governance:** `loft-os-architect/AGENTS.md` · `CODEX.md` · `copilot-instructions.md`

**PR Standard:** A77 Canon — see [CODEX.md](http://CODEX.md). Four required sections: Context/Why · Changes · Verification · Risk/Rollback.

---

## 🏗️ Stack

| Layer | Technology |
| --- | --- |
| Frontend | React + Vite |
| AI — Research | Gemini 2.0 Flash (primary) |
| AI — Copy/Analysis | Claude API (Anthropic) |
| Database | Supabase |
| Deploy | Railway — auto-deploy on merge to main |
| Repo | [github.com/avergara13/resale-scanner-pro](http://github.com/avergara13/resale-scanner-pro) |
| Listings | Vendoo (multi-platform sync) |
| eBay API | eBay Sell API — CORS fallback until App ID approved |

---

## 🔑 Environment Variables (Railway — never hardcode)

All 7 `VITE_` prefixed vars set on Railway:

`VITE_GEMINI_API_KEY` · `VITE_ANTHROPIC_API_KEY` · `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `VITE_EBAY_APP_ID` · `VITE_EBAY_CLIENT_SECRET` · `VITE_EBAY_REDIRECT_URI`

Local dev: copy to `.env.local` — never commit this file.

---

## 🗃️ Supabase

- Project ID: `zfbaijiynnwxasyyqglg`
- Primary table: `scans`
- RLS: enabled — check policies before new queries
- Never bypass RLS · Never use service role key in frontend

---

## 🚀 Deploy

- URL: `resale-scanner-pro-production.up.railway.app`
- Last known good deploy: HEAD `984fccf` · Apr 6 14:08 UTC · PR #26 merged
- Trigger: merge to `main` → Railway auto-deploys
- All 8 screens rendering ✅ · Gemini online ✅ · eBay App ID pending ⚠️

---

## 📱 The 8 Screens

1. Home / Dashboard
2. Scanner (camera + barcode)
3. AI Research Results
4. Listing Builder
5. Listing Preview
6. eBay Push / Status (CORS fallback active)
7. Inventory / History
8. Settings

---

## ⚡ Phase 3 — Current Sprint

- [ ]  Photo burst mode (multiple photos per item)
- [ ]  Background removal on product photos
- [ ]  eBay Sell API — listing creation endpoint
    - 🔴 Blocked: eBay App ID pending developer portal approval
    - CORS fallback in place — do not remove it

**When eBay App ID arrives:** It is pasted in Notion Engineering page. CA coordinates the wire to Railway. Do not bypass this protocol.

---

## 🤖 Agent Handoff Protocol

| Agent | Role | Handoff Signal |
| --- | --- | --- |
| 🏛️ CA ([Claude.ai](http://Claude.ai)) | Architecture, Notion, planning | Updates Active Workstreams DB before ending session |
| ⚙️ CE-VS (VS Code Copilot) | Repo, infra, Railway, Supabase | Commits PR with A77 body, updates Notion status |
| Claude Code (Code tab) | Autonomous build sessions | Commits with A77 PR, flags blockers in Notion |

**Sonnet 4.6 for all iteration. Opus 4.6 only for complex architecture review.**

---

## 🗺️ Notion — Key Pages

| Page | URL |
| --- | --- |
| RSP Product Hub | [Resale Scanner Pro — Product Hub](https://www.notion.so/Resale-Scanner-Pro-Product-Hub-336f99e853ab8131b63ee475e3805b02?pvs=21) |
| RSP Live Activity | [📡 Resale Scanner Pro — Live Activity](https://www.notion.so/Resale-Scanner-Pro-Live-Activity-337f99e853ab81929ebbed2fc770352b?pvs=21) |
| Active Workstreams DB | [⚡ Active Workstreams](https://www.notion.so/4b0e969d94c04c418e9c071df3b35eb8?pvs=21) |
| Engineering Dashboard | [⚙️ Engineering](https://www.notion.so/Engineering-334f99e853ab8143b137f3c6df32ecc6?pvs=21) |
| Agent Context Layer | [Agent Context Layer](https://www.notion.so/Agent-Context-Layer-334f99e853ab816f977ad6388c6256db?pvs=21) |

Update Active Workstreams status when a task completes. CA syncs Notion between sessions.

---

## 🚫 Hard Rules (project-specific)

- Never commit `.env` or `.env.local`
- Never use Supabase service role key in frontend code
- Never push directly to `main` — always PR with A77 body
- Never remove the eBay CORS fallback until App ID is live and tested
- Never use Opus 4.6 for routine iteration — Sonnet only

---

## ✅ Session Checklist

**Before starting:**

1. `git status` — clean state or known branch
2. `git pull origin main` — get latest
3. Check Active Workstreams DB for current priority
4. `npm run dev` — confirm app loads

**Before ending:**

1. All changes committed · PR has full A77 body
2. No `.env` files staged
3. Active Workstreams status updated or flagged for CA

---

*📋 [CLAUDE.md](http://CLAUDE.md) · Resale Scanner Pro · Engineering · Vergara Inc · Last updated: 2026-04-06*