-- PKT-20260414-001 + PKT-20260414-002
-- Creates or extends the scans table with full enriched listing fields.
-- Safe to run against an existing scans table (ADD COLUMN IF NOT EXISTS guards).

-- ── Create table (idempotent) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  title            TEXT,
  notion_page_id   TEXT,
  ebay_listing_id  TEXT,
  raw_analysis     JSONB
);

-- ── Add enriched columns idempotently ────────────────────────────────────────
-- Uses ADD COLUMN IF NOT EXISTS inside a DO block so the migration is safe on
-- both a brand-new DB and an existing scans table from prior work.
DO $$ BEGIN
  -- Core identification
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS ebay_category_id        TEXT;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS item_specifics          JSONB;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS seo_title               TEXT;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS subtitle                TEXT;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS upc_ean                 TEXT;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS brand                   TEXT;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS model                   TEXT;
  -- Condition
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS condition               TEXT;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS condition_description   TEXT;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS item_description        TEXT;
  -- Attributes
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS color                   TEXT;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS size                    TEXT;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS department              TEXT;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS seo_keywords            TEXT[];
  -- Dimensions / weight
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS item_weight_oz          NUMERIC;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS item_dimensions_lwh     TEXT;
  -- Shipping & fulfillment
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS shipping_strategy       TEXT;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS handling_time_days      INTEGER DEFAULT 1;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS free_shipping           BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS return_policy           JSONB;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS ebay_listing_type       TEXT DEFAULT 'Fixed Price';
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS listing_duration        TEXT DEFAULT 'GTC';
  -- Pricing & offers
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS listing_price           NUMERIC;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS best_offer_enabled      BOOLEAN DEFAULT TRUE;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS auto_accept_price       NUMERIC;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS auto_decline_price      NUMERIC;
  -- Comp data
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS comp_range_low          NUMERIC;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS comp_range_high         NUMERIC;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS sold_comp_count         INTEGER;
  -- Financial estimates (pre-sale, Supabase only — NOT pushed to Notion formulas)
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS ebay_fvf_rate           NUMERIC;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS est_shipping_label_cost NUMERIC;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS gross_profit_est        NUMERIC;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS roi_pct_est             NUMERIC;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS break_even_price        NUMERIC;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS net_payout_est          NUMERIC;
  -- Photos (PKT-20260414-002)
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS photo_count             INTEGER;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS photo_filenames         TEXT[];
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS photo_urls              TEXT[];
  -- Metadata
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS subtitle_cost_flag      BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS pending_schema_additions JSONB;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS notion_push_status      TEXT DEFAULT 'pending';
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS notion_push_timestamp   TIMESTAMPTZ;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS session_id              TEXT;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS operator_id             TEXT;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS purchase_price          NUMERIC;
  ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS decision                TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- DROP + CREATE pattern (CREATE POLICY has no IF NOT EXISTS in PostgreSQL)
DROP POLICY IF EXISTS "anon read scans" ON public.scans;
CREATE POLICY "anon read scans"
  ON public.scans FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon insert scans" ON public.scans;
CREATE POLICY "anon insert scans"
  ON public.scans FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon update scans" ON public.scans;
CREATE POLICY "anon update scans"
  ON public.scans FOR UPDATE USING (true);
