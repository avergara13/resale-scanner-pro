<p align="center">
  <img src="./assets/readme/logo.png" alt="Resale Scanner Pro" width="160" />
</p>

<h1 align="center">Resale Scanner Pro</h1>

<p align="center">
  <strong>A mobile-first agentic field tool for resellers.</strong><br/>
  Scan an item, research the market, decide to buy, generate the listing, push it to eBay, and track the sale — all from one phone.
</p>

<p align="center">
  <a href="https://resale-scanner-pro-production.up.railway.app">🔗 Live app</a> ·
  <a href="./AGENTS.md">Engineering protocol</a> ·
  <a href="./CLAUDE.md">Agent workflow</a> ·
  <a href="./PRD.md">Product record</a>
</p>

---

## Why this exists

The most expensive time in a reselling business is the gap between finding an item in the field and turning it into a priced, listed, profit-modeled SKU. Reselling tools today split that gap across five apps — a camera app, a comps lookup, a spreadsheet, a listing tool, and a shipping portal — and every handoff loses information.

Resale Scanner Pro collapses that stack into a single mobile surface. One scan produces an identification, a market read, a BUY/PASS decision, a ready-to-publish listing, and a back-office record. The engine underneath is an agentic workflow — AI for the judgment-heavy steps, structured pipelines for the operational ones, and a production database for everything that needs to survive the session.

---

## Status — 2026-04-21

| Surface | State |
| --- | --- |
| Live production app | ✅ Running on Railway, auto-deploy on merge to `main` |
| eBay Developer Program | ✅ Approved 2026-04-10 |
| eBay OAuth (production) | ✅ Authorized, singleton token row in Supabase |
| eBay Sell API | ✅ Live — real listings pushing to the marketplace |
| RSP Phase 3 (end-to-end pipeline) | ✅ Shipped 2026-04-16 |
| iPhone Polish Program (12 PRs) | ✅ Complete 2026-04-20 — full Apple-native UI/UX pass |
| PWA home-screen install | ✅ Shipped 2026-04-21 — dark-gradient edge-to-edge iOS icon |
| WF-09 Sale Alert automation | ✅ Live on n8n → Notion back office |
| Multi-marketplace publishing | 🚧 eBay live; additional platforms queued |
| Shipping label purchase in-app | 🚧 Pirate Ship integration in design |

The product ships behind a six-phase engineering protocol (Plan → Execute → PR Gate → PR → Review → Merge Gate) and every merge writes a Checksum Registry entry to the Notion governance workspace.

---

## The pipeline

```text
STORE ─► 📸 scan ─► 🧠 Gemini Vision ID ──► 📊 market research ──► 💰 profit math
                                                                          │
                                                          ┌──────── BUY / MAYBE / PASS
                                                          │
                                                          ▼
                                            📦 Photo Manager (Supabase Storage)
                                                          │
                                                          ▼
                                              📝 Listing Queue (7-section editor)
                                                          │
                                                          ▼
                                 🤖 AI enrichment: title · description · condition
                                    · category · item specifics · pricing
                                                          │
                                                          ▼
                                    ✅ 9 required checks + 5 warnings gate
                                                          │
                                                          ▼
                                     🛒 Confirm & Push → eBay Sell API (live)
                                                          │
                                                          ▼
                                   🗃️ Notion back-office record written on confirm
                                                          │
                                                          ▼
                                       📮 Pack → ship → sale alert → close loop
```

**Two-container model** (non-negotiable design constraint):

- **Scan / Research** — `PENDING` + `MAYBE` items. Active working pile. Every decision reversible. `PASS` items kept with Restore. Re-scan available until eBay push.
- **Listing Queue** — `BUY` items only. Optimize → Build → Gate → Push. No mixing.

**Notion is the back office** — it receives the confirmed record *after* eBay confirms, carrying the real Item Number, Listing URL, ROI, Gross Profit, Break Even, Net Payout, and 24 KPIs. The app runs the workflow. Notion runs the business.

---

## Live product views

| Session workflow | Agent workspace |
| --- | --- |
| ![Resale Scanner Pro session view](./assets/readme/session.png) | ![Resale Scanner Pro agent view](./assets/readme/agent.png) |

Full Apple-native UI pass complete — large-title collapse, liquid-glass tab bars, material-thin surfaces, semantic design tokens, haptics, safe-area respect, optical typography scale. Three ED walkthroughs passed during the polish program.

---

## Product surfaces

| Screen | What it does |
| --- | --- |
| **Session** | Sourcing run management — goals, spend, active pile, session performance |
| **Scanner / AI Analysis** | Camera capture → Gemini Vision ID → comps → BUY/PASS signal |
| **Agent** | Natural-language command surface across scans, listings, sold items, research |
| **Listing Queue** | BUY pile — optimize listing, run the gate, push to eBay |
| **Sold / Shipping Center** | Post-sale tracking, label purchase, Pirate Ship rate card, Notion sync |
| **Cost Tracking** | AI cost model per scan · per listing · per session · per month |
| **Settings** | API keys, business rules, Notion DB bindings, agent behavior |

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite + Tailwind + Radix primitives |
| Mobile | PWA with iOS home-screen install, standalone display, dark splash |
| Backend | Node + Express (`server.js`) on Railway |
| Database | Supabase Postgres (`zfbaijiynnwxasyyqglg`) — `scans`, `ebay_tokens`, `listing-photos` bucket |
| Auth / RLS | Supabase service-role + anon policies, singleton token row pattern |
| AI — Vision & Research | Google Gemini 2.0 Flash |
| AI — Copy & Listing Optimization | Anthropic Claude API |
| Marketplace | eBay Sell API (production OAuth, Fulfillment / Return / Payment policies) |
| Automation | n8n workflows (WF-08 Deploy log, WF-09 Sale Alert) |
| Governance / Project state | Notion databases (Checksum Registry, Governed Work Mirror, Active Workstreams) |
| CI / Deploy | GitHub Actions → Railway (`deploy/production`) |

---

## Architecture — Core vs Shell

The app has two layers with very different stability contracts. This is what lets AI design tools rebuild the UI without ever breaking the pipeline.

**Core** (stable — survives every UI redesign):

| Layer | Files | Guarded by |
| --- | --- | --- |
| Backend API | `server.js` | `apply-wiring.mjs` BACKEND_GUARDS (fatal) |
| Service layer | `src/lib/*.ts` | TypeScript type-checking |
| Type contracts | `src/types/index.ts` | TypeScript type-checking |
| Wiring script | `scripts/apply-wiring.mjs` | CI gate + manual review |

**Shell** (interchangeable — redesign freely with Spark, Claude, or any AI design tool):

| Layer | Files |
| --- | --- |
| App orchestration | `src/App.tsx` |
| Screen components | `src/components/screens/*.tsx` |
| UI primitives | `src/components/ui/*.tsx` |

When a design tool publishes a new shell, `scripts/apply-wiring.mjs` re-injects service wiring, the `tsc` + `lint` gates surface broken prop contracts, and the remaining anchor-miss warnings become the manual reconnection punch list. The backend, data model, and business logic never move.

---

## Engineering protocol

Every change — whether made by a human, Claude, or Codex — follows the same six phases:

1. **Plan** — written plan, user approval required before any code changes
2. **Execute** — feature branch only, never direct to `main`, build must pass
3. **PR Gate** — user explicitly approves before PR opens
4. **PR** — A77 format: title, Summary, Technical Detail, Test Plan, Risk & Rollback
5. **Review Loop** — Copilot comments resolved autonomously when unambiguous, escalated when not
6. **Merge Gate** — user explicitly approves merge

Deploy gates run in this order on every PR:

| Order | Step | Catches |
| --- | --- | --- |
| 1 | `node scripts/apply-wiring.mjs` | Broken App.tsx service wiring |
| 2 | `npx tsc --noEmit` | Type drift, prop mismatches, missing imports |
| 3 | `npm run lint` | Code quality regressions |

On merge, Railway redeploys `deploy/production` and the deploy event writes to Notion via WF-08.

Every merge writes a **Checksum Registry** entry (`{CHECKSUM:RSP/YYYY-MM-DD/PRxxx-slug}`) to Notion. Historical versions are never overwritten — they transition to `⚪ Superseded`. This gives the project a durable provenance trail that survives individual sessions.

---

## Built with agents

This repo is the first production product shipped out of **Loft OS** — a home-grown agentic development system.

| Agent | Role |
| --- | --- |
| **CA** — Claude (strategy surface) | Architecture, planning, Notion orchestration, governance writes |
| **CE-VS** — Copilot in VS Code | Repo changes, infra, Railway, Supabase migrations |
| **SA-VS** — Claude Code | Autonomous build sessions, parallel work orders, deep codebase changes |
| **Human (Owner)** | Plan approval, PR approval, merge approval, ED walkthroughs |

The humans run the gates; the agents run the loops. Every agent output — code change, Notion write, deploy log — is linked back to a numbered Work Order (WO-RSP-###) or Active Workstream (WS-##) so the whole development history is queryable.

This README itself was refreshed through that pipeline.

---

## Run locally

```bash
git clone https://github.com/avergara13/resale-scanner-pro.git
cd resale-scanner-pro
npm install
npm run dev
```

The app runs on `http://localhost:5173`. For Gemini Vision locally, see [GOOGLE_CLOUD_SETUP.md](./GOOGLE_CLOUD_SETUP.md). All production secrets live in Railway environment variables — never commit `.env*` files.

---

## Repository docs

| Doc | Purpose |
| --- | --- |
| [`AGENTS.md`](./AGENTS.md) | Canonical engineering protocol, PR standards, deploy gates |
| [`CLAUDE.md`](./CLAUDE.md) | Claude-specific operating instructions, branch strategy, governance rules |
| [`CONTEXT.md`](./CONTEXT.md) | Project context, handoff notes, Notion pointers |
| [`PRD.md`](./PRD.md) | Product requirements and decision log |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Repo standards, PR format, commit conventions |
| [`GOOGLE_CLOUD_SETUP.md`](./GOOGLE_CLOUD_SETUP.md) | Local Gemini / Google API setup |

---

## What's next

- **Multi-marketplace publishing** — extending the listing pipeline beyond eBay (Mercari, Poshmark, Depop)
- **In-app shipping label purchase** — Pirate Ship + Shippo rate cards integrated into the Sold screen
- **Swipe gestures across Queue / Sold / ScanHistory** — deferred pending `dnd-kit` + Framer Motion transform conflict resolution
- **Business dashboard expansion** — 24 KPI roll-up, P&L, ROI cohorts
- **Autonomous agent workflows** — extending SA-VS beyond dev into live sourcing triage

---

## License

Proprietary — source available for portfolio review. Not licensed for redistribution or commercial use.

---

<p align="center">
  <sub>Resale Scanner Pro · first product out of Loft OS · built by Angel Vergara<br/>
  <em>Hobbyst Resale · Vergara Inc</em></sub>
</p>
