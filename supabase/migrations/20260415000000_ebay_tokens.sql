-- WO-RSP-008 / PKT-20260415-009
-- ebay_tokens — single-row eBay OAuth credential store for the seller account.
-- RLS USING(false) blocks all anon access; service role key bypasses RLS implicitly.
-- Server.js performs DELETE-then-INSERT on every OAuth callback (no upsert) — this
-- table never holds more than one row.

CREATE TABLE IF NOT EXISTS public.ebay_tokens (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  access_token        TEXT NOT NULL,
  refresh_token       TEXT NOT NULL,
  token_type          TEXT DEFAULT 'User',
  expires_at          TIMESTAMPTZ NOT NULL,
  refresh_expires_at  TIMESTAMPTZ,
  scope               TEXT,
  ebay_user_id        TEXT
);

-- Lock down to service role only — frontend (anon key) must never read tokens.
ALTER TABLE public.ebay_tokens ENABLE ROW LEVEL SECURITY;

-- Drop any prior policy so the migration is rerunnable.
DROP POLICY IF EXISTS "service role only" ON public.ebay_tokens;

CREATE POLICY "service role only"
  ON public.ebay_tokens
  USING (false);
