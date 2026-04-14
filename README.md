# Resale Scanner Pro

Resale Scanner Pro is a mobile-first agentic workflow app for resellers.

I originally built it to automate listing creation. It has since grown into a
full sourcing-to-sale operating system: scan an item in the field, research
comps, estimate profit, decide whether to buy, generate listing assets, and
move the item into a publishing and fulfillment workflow.

This is the first product deployment coming out of the Loft OS agentic system.
It is in launch-phase tuning now and approaching full release.

Live app: [resale-scanner-pro-production.up.railway.app](https://resale-scanner-pro-production.up.railway.app)

## What the product does

Resale Scanner Pro is designed for the actual resale workflow, not just the
listing step.

- scan and identify items while sourcing
- run AI-assisted research across comps, market data, and profitability
- make fast BUY/PASS decisions in the field
- generate optimized listing content from approved items
- hand listings into inventory and publishing workflows
- track sold, shipping, and completion status after the sale

## Workflow

```text
source item -> scan -> analyze -> research comps -> decide BUY/PASS -> optimize listing -> publish/handoff -> track sold + shipping
```

The goal is simple: reduce the time between finding an item and turning it into
an informed resale decision with a usable listing workflow behind it.

## What is shipping now

The current product already includes the main operating surfaces:

- **Mobile-first scanning workflow** for quick item capture during sourcing
- **AI-assisted analysis pipeline** for product identification, price research,
  and profit estimation
- **Agent workspace** for natural-language actions across scans, listings, and
  sold-item workflows
- **Queue and session management** to organize work by sourcing session and
  listing state
- **Listing optimization** for titles, descriptions, pricing, and item details
- **Inventory publishing handoff** through Notion and downstream workflow wiring
- **Sold and shipping operations** for sale logging, tracking, and post-sale
  follow-through

## Live product views

Current production screenshots from the Railway deploy:

| Session workflow | Agent workspace |
| --- | --- |
| ![Resale Scanner Pro session view](./assets/readme/session.png) | ![Resale Scanner Pro agent view](./assets/readme/agent.png) |

## Honest status

This app is far beyond a prototype, but it is not positioned here as a
fully-autonomous black box.

What is already real:

- the scanning, research, decision, queue, optimization, and sold/shipping
  layers
- the agent surface that can operate across those workflows
- the deployable production app running on Railway

What is still being hardened:

- deeper downstream marketplace publishing automation
- continued agent expansion across the resale workflow
- launch polish and production tuning before full release

That distinction matters. The value of the product is already visible, and the
automation surface is growing fast, but the README should reflect the current
system truth instead of promising more than the live product does today.

## Why it is interesting

For resellers, the product reduces the most expensive form of waste in the
business: slow decisions, weak research, and listing friction.

For engineers, this repo is interesting because it sits at the boundary between
an AI product and an AI workflow system:

- real product UI, not just a demo agent
- applied multimodal + research workflow design
- structured listing generation and operator handoff
- post-listing operational workflows like sold status and shipping
- production deployment as part of the larger Loft OS system

## Product surfaces

The app currently centers around a few core screens and flows:

- **Session**: manage sourcing runs, goals, and session performance
- **Scanner / AI analysis**: capture item data and evaluate resale potential
- **Agent**: run guided actions across the queue, listings, research, and sold
  items
- **Queue**: review BUY items, optimize listings, and push inventory forward
- **Sold**: manage post-sale status, shipping, and follow-through
- **Settings**: configure APIs, business rules, and workflow integrations

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React + TypeScript + Vite |
| UI | Mobile-first PWA with Tailwind and Radix-based primitives |
| AI | Gemini-powered analysis, research, and listing optimization flows |
| Data / workflow | Notion integration, downstream n8n workflow hooks, Supabase-ready surfaces |
| Deployment | Railway |

## Run locally

```bash
npm install
npm run dev
```

If you need the Google integrations configured locally, use
[GOOGLE_CLOUD_SETUP.md](./GOOGLE_CLOUD_SETUP.md).

## Related docs

- [CONTRIBUTING.md](./CONTRIBUTING.md) for repo standards and PR format
- [GOOGLE_CLOUD_SETUP.md](./GOOGLE_CLOUD_SETUP.md) for local Google API setup
- [PRD.md](./PRD.md) for the broader product planning record

## Live direction

Resale Scanner Pro is the first launch lane coming out of the Loft OS agentic
system. It is not the end state. It is the first serious product proving the
system in the real world.
