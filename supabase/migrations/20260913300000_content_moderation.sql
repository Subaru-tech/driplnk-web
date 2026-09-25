-- ==============================================================================
-- Migration: 20260913300000_content_moderation.sql
-- Description: Content Moderation — Weapons blocklist flags, SHA-256 duplicate
--              rejection, pgvector perceptual hash, and model reports queue.
-- ==============================================================================

-- 1. Enable pgvector extension for perceptual image hash similarity
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add content moderation fields to models table
ALTER TABLE models
  ADD COLUMN IF NOT EXISTS file_sha256 text,
  ADD COLUMN IF NOT EXISTS moderation_flags jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS moderation_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS preview_phash vector(64);

-- 3. Enforce uniqueness on primary CAD file SHA-256 hash (exact duplicate prevention)
CREATE UNIQUE INDEX IF NOT EXISTS idx_models_file_sha256
  ON models (file_sha256)
  WHERE file_sha256 IS NOT NULL;

-- 4. Constraint for moderation_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'models_moderation_status_check'
  ) THEN
    ALTER TABLE models
      ADD CONSTRAINT models_moderation_status_check
      CHECK (moderation_status IS NULL OR moderation_status IN ('weapon_review', 'duplicate_review', 'report_review', 'cleared'));
  END IF;
END $$;

-- 5. Create model_reports table for community-driven IP and prohibited content reports
CREATE TABLE IF NOT EXISTS model_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  reporter_user_id text NOT NULL,
  reporter_contact text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('stolen_design', 'weapon_content', 'counterfeit', 'other')),
  evidence_url text,
  details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
  resolution text,
  resolved_at timestamp with time zone,
  resolved_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_model_reports_model_id ON model_reports(model_id);
CREATE INDEX IF NOT EXISTS idx_model_reports_status ON model_reports(status);
CREATE INDEX IF NOT EXISTS idx_model_reports_reporter ON model_reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_models_moderation_status ON models(moderation_status) WHERE moderation_status IS NOT NULL;

-- 6. Cosine distance similarity search RPC for perceptual hashes
CREATE OR REPLACE FUNCTION match_model_phash(
  query_phash vector(64),
  match_threshold float DEFAULT 0.85,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    models.id,
    models.title,
    1 - (models.preview_phash <=> query_phash) AS similarity
  FROM models
  WHERE models.preview_phash IS NOT NULL
    AND 1 - (models.preview_phash <=> query_phash) >= match_threshold
  ORDER BY models.preview_phash <=> query_phash
  LIMIT match_count;
$$;

-- 7. Enable RLS on model_reports
ALTER TABLE model_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "model_reports_insert_auth" ON model_reports;
CREATE POLICY "model_reports_insert_auth" ON model_reports
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "model_reports_select_reporter" ON model_reports;
CREATE POLICY "model_reports_select_reporter" ON model_reports
  FOR SELECT TO authenticated
  USING (
    reporter_user_id = (SELECT auth.jwt() ->> 'sub')
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE (profiles.id::text = (SELECT auth.jwt() ->> 'sub') OR profiles.clerk_id = (SELECT auth.jwt() ->> 'sub'))
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "model_reports_admin_update" ON model_reports;
CREATE POLICY "model_reports_admin_update" ON model_reports
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE (profiles.id::text = (SELECT auth.jwt() ->> 'sub') OR profiles.clerk_id = (SELECT auth.jwt() ->> 'sub'))
        AND profiles.role = 'admin'
    )
  );
