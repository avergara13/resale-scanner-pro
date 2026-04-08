# Resale Scanner Pro

Project: Resale Scanner Pro (RSP)

This file is the short project brief for Claude sessions in this repo. For full operating context, priorities, handoff notes, and Notion links, see `CONTEXT.md`.

## Stack

- Frontend: React + Vite
- Backend/Data: Supabase
- AI: Gemini + Claude API
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