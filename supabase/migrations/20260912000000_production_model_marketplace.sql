-- Migration: 20260912000000_production_model_marketplace.sql
-- Purpose: Complete production-ready Model Marketplace data architecture:
--   1. Hierarchical categories & subcategories
--   2. First-class marketplace licenses
--   3. Normalized many-to-many tags & model_tags
--   4. Model versions (v1.0.0, changelogs, current flags)
--   5. Multi-file & multi-format kits (STL, STEP, 3MF, OBJ, ZIP, PDF)
--   6. Multi-image galleries & cover photos
--   7. Model favorites / wishlist
--   8. Lightweight telemetry / model_events
--   9. Enhancements on public.models & public.model_acquisitions
--  10. Strict RLS policies and server-side RPC functions

-- ============================================================================
-- 1. CATEGORIES (Hierarchical: Parent -> Subcategories)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'categories: public read') THEN
    CREATE POLICY "categories: public read" ON public.categories FOR SELECT USING (true);
  END IF;
END $$;

-- Seed Standard Top-Level Categories
INSERT INTO public.categories (name, slug, description, sort_order)
VALUES
  ('Mechanical', 'mechanical', 'Mounts, brackets, functional gears, mechanisms, and structural components', 10),
  ('Robotics', 'robotics', 'Chassis frames, end effectors, robotic arms, sensor brackets, and drone parts', 20),
  ('Electronics', 'electronics', 'Cases, PCBs enclosures, mounts, wiring clips, and battery holders', 30),
  ('Tools & Jigs', 'tools', 'Assembly jigs, drilling guides, clamps, calipers, and workbench accessories', 40),
  ('Enclosures', 'enclosures', 'Custom project boxes, weatherproof housings, and modular enclosures', 50),
  ('Replacement Parts', 'replacement', 'Direct replacements for appliances, vehicles, equipment, and printers', 60),
  ('Educational', 'educational', 'STEM teaching models, kinetic physics toys, and anatomical demonstrations', 70),
  ('Art & Decor', 'art', 'Sculptures, desk ornaments, procedural geometry, and aesthetic decor', 80),
  ('Toys & Games', 'toys', 'Board game miniatures, articulated figures, puzzles, and RC parts', 90),
  ('Cosplay & Props', 'cosplay', 'Wearable armor, prop replicas, helmets, and costume details', 100),
  ('Architecture', 'architecture', 'Scale building models, BIM details, landscape topography, and urban mockups', 110),
  ('Accessories', 'accessories', 'Everyday carry items, keychains, phone stands, and cable organizers', 120),
  ('Other', 'other', 'Miscellaneous 3D printable designs and experimental CAD experiments', 130)
ON CONFLICT (slug) DO NOTHING;

-- Seed Key Subcategories
DO $$
DECLARE
  v_mech_id uuid;
  v_robo_id uuid;
  v_elec_id uuid;
BEGIN
  SELECT id INTO v_mech_id FROM public.categories WHERE slug = 'mechanical';
  SELECT id INTO v_robo_id FROM public.categories WHERE slug = 'robotics';
  SELECT id INTO v_elec_id FROM public.categories WHERE slug = 'electronics';

  IF v_mech_id IS NOT NULL THEN
    INSERT INTO public.categories (parent_id, name, slug, description, sort_order) VALUES
      (v_mech_id, 'Brackets & Mounts', 'mechanical-brackets', 'Structural brackets and motor mount assemblies', 1),
      (v_mech_id, 'Gears & Pulleys', 'mechanical-gears', 'Spurs, bevels, planetary gear sets, and timing pulleys', 2),
      (v_mech_id, 'Linear Motion', 'mechanical-linear', 'Lead screw nuts, carriage blocks, and rail sliders', 3)
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  IF v_robo_id IS NOT NULL THEN
    INSERT INTO public.categories (parent_id, name, slug, description, sort_order) VALUES
      (v_robo_id, 'Chassis & Frames', 'robotics-chassis', 'Wheeled bases, tracked platforms, and drone frames', 1),
      (v_robo_id, 'Arms & Grippers', 'robotics-grippers', 'Articulated robotic hands, grippers, and joints', 2),
      (v_robo_id, 'Sensor Mounts', 'robotics-sensors', 'LiDAR, ultrasonic, camera, and IMU housings', 3)
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  IF v_elec_id IS NOT NULL THEN
    INSERT INTO public.categories (parent_id, name, slug, description, sort_order) VALUES
      (v_elec_id, 'Arduino & Pi Cases', 'electronics-dev-boards', 'Enclosures for Raspberry Pi, Arduino, and ESP32', 1),
      (v_elec_id, 'Cable Management', 'electronics-cable-mgmt', 'Cable combs, clips, grommets, and raceways', 2)
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- 2. LICENSES (First-Class Marketplace Licensing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL,
  allows_commercial boolean NOT NULL DEFAULT false,
  allows_remix boolean NOT NULL DEFAULT false,
  requires_attribution boolean NOT NULL DEFAULT true,
  is_custom boolean NOT NULL DEFAULT false,
  terms_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'licenses' AND policyname = 'licenses: public read') THEN
    CREATE POLICY "licenses: public read" ON public.licenses FOR SELECT USING (true);
  END IF;
END $$;

INSERT INTO public.licenses (name, slug, description, allows_commercial, allows_remix, requires_attribution, sort_order)
VALUES
  ('Standard License', 'standard', 'Personal, non-commercial 3D printing and private modification. Distribution and physical reselling prohibited.', false, true, true, 10),
  ('Creative Commons (CC-BY)', 'cc', 'Free to print, share, adapt, and remix for any purpose with appropriate creator attribution.', false, true, true, 20),
  ('Commercial 3D Printing', 'commercial', 'Permits the buyer to 3D print and physically sell manufactured units. Digital CAD files cannot be resold or re-uploaded.', true, true, true, 30),
  ('Personal Non-Commercial', 'personal', 'Strictly personal use. No digital redistribution, sharing, or commercial physical reproduction.', false, false, true, 40),
  ('Custom License', 'custom', 'Custom rights defined by the creator in the model documentation.', true, true, true, 50)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 3. TAGS & MODEL_TAGS (Many-to-Many Normalized Tagging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.model_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_tags_unique_pair UNIQUE (model_id, tag_id)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_tags ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tags' AND policyname = 'tags: public read') THEN
    CREATE POLICY "tags: public read" ON public.tags FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'model_tags' AND policyname = 'model_tags: public read') THEN
    CREATE POLICY "model_tags: public read" ON public.model_tags FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================================
-- 4. EXTENSIONS ON public.models
-- ============================================================================

-- Expand status check constraint to support full workflow
ALTER TABLE public.models 
  DROP CONSTRAINT IF EXISTS models_status_check;

ALTER TABLE public.models 
  ADD CONSTRAINT models_status_check 
  CHECK (status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'published'::text, 'rejected'::text, 'archived'::text]));

-- Add new columns safely
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'models' AND column_name = 'slug') THEN
    ALTER TABLE public.models ADD COLUMN slug text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'models' AND column_name = 'visibility') THEN
    ALTER TABLE public.models ADD COLUMN visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'models' AND column_name = 'category_id') THEN
    ALTER TABLE public.models ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'models' AND column_name = 'subcategory_id') THEN
    ALTER TABLE public.models ADD COLUMN subcategory_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'models' AND column_name = 'license_id') THEN
    ALTER TABLE public.models ADD COLUMN license_id uuid REFERENCES public.licenses(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'models' AND column_name = 'admin_review_notes') THEN
    ALTER TABLE public.models ADD COLUMN admin_review_notes text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'models' AND column_name = 'published_at') THEN
    ALTER TABLE public.models ADD COLUMN published_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'models' AND column_name = 'updated_at') THEN
    ALTER TABLE public.models ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Populate slugs for existing models
UPDATE public.models
SET slug = lower(regexp_replace(COALESCE(title, name, 'model'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(id::text from 1 for 6)
WHERE slug IS NULL;

-- Make slug unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_models_slug_unique ON public.models (slug);

-- Backfill published_at for existing published models
UPDATE public.models
SET published_at = created_at
WHERE status = 'published' AND published_at IS NULL;

-- Backfill category_id and license_id based on text values
UPDATE public.models m
SET category_id = c.id
FROM public.categories c
WHERE m.category_id IS NULL AND lower(m.category) = lower(c.name);

UPDATE public.models m
SET license_id = l.id
FROM public.licenses l
WHERE m.license_id IS NULL AND lower(m.license_type) = lower(l.slug);

-- Fallback to standard license if not set
UPDATE public.models m
SET license_id = (SELECT id FROM public.licenses WHERE slug = 'standard' LIMIT 1)
WHERE license_id IS NULL;

-- ============================================================================
-- 5. MODEL_VERSIONS (Version History & Change Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  version_number text NOT NULL DEFAULT 'v1.0.0',
  changelog text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_versions_unique_version UNIQUE (model_id, version_number)
);

ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'model_versions' AND policyname = 'model_versions: public read published') THEN
    CREATE POLICY "model_versions: public read published" ON public.model_versions
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.models m
          WHERE m.id = model_versions.model_id
            AND (m.status = 'published' OR m.owner_id = auth.uid() OR m.seller_user_id = auth.uid())
        )
      );
  END IF;
END $$;

-- Backfill version v1.0.0 for all existing models
INSERT INTO public.model_versions (model_id, version_number, changelog, created_by, is_current, created_at)
SELECT
  m.id,
  'v1.0.0',
  'Initial marketplace release',
  COALESCE(m.seller_user_id, m.owner_id),
  true,
  m.created_at
FROM public.models m
ON CONFLICT (model_id, version_number) DO NOTHING;

-- ============================================================================
-- 6. MODEL_FILES (Multi-File & Multi-Format Kits)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.model_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.model_versions(id) ON DELETE SET NULL,
  filename text NOT NULL,
  storage_path text NOT NULL,
  format text NOT NULL, -- 'stl', 'step', 'stp', '3mf', 'obj', 'zip', 'pdf'
  file_size bigint NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  is_downloadable boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb, -- dimensions: {x,y,z}, triangles, manifold: true/false
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.model_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'model_files' AND policyname = 'model_files: owner read') THEN
    CREATE POLICY "model_files: owner read" ON public.model_files
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.models m
          WHERE m.id = model_files.model_id
            AND (m.owner_id = auth.uid() OR m.seller_user_id = auth.uid())
        )
      );
  END IF;
END $$;

-- Backfill model_files from existing models with file_path or storage_path
INSERT INTO public.model_files (model_id, version_id, filename, storage_path, format, is_primary, is_downloadable, created_at)
SELECT
  m.id,
  mv.id,
  COALESCE(split_part(COALESCE(m.file_path, m.storage_path), '/', 2), m.name || '.stl') AS filename,
  COALESCE(m.file_path, m.storage_path),
  CASE 
    WHEN COALESCE(m.file_path, m.storage_path) ILIKE '%.step' OR COALESCE(m.file_path, m.storage_path) ILIKE '%.stp' THEN 'step'
    WHEN COALESCE(m.file_path, m.storage_path) ILIKE '%.3mf' THEN '3mf'
    WHEN COALESCE(m.file_path, m.storage_path) ILIKE '%.obj' THEN 'obj'
    WHEN COALESCE(m.file_path, m.storage_path) ILIKE '%.zip' THEN 'zip'
    ELSE 'stl'
  END AS format,
  true AS is_primary,
  true AS is_downloadable,
  m.created_at
FROM public.models m
LEFT JOIN public.model_versions mv ON mv.model_id = m.id AND mv.is_current = true
WHERE (m.file_path IS NOT NULL OR m.storage_path IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.model_files mf WHERE mf.model_id = m.id);

-- ============================================================================
-- 7. MODEL_IMAGES (Gallery & Previews)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.model_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  storage_path text,
  thumbnail_url text NOT NULL,
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.model_images ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'model_images' AND policyname = 'model_images: public read published') THEN
    CREATE POLICY "model_images: public read published" ON public.model_images
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.models m
          WHERE m.id = model_images.model_id
            AND (m.status = 'published' OR m.owner_id = auth.uid() OR m.seller_user_id = auth.uid())
        )
      );
  END IF;
END $$;

-- Backfill model_images from models.thumbnail_url and models.preview_image_paths
INSERT INTO public.model_images (model_id, thumbnail_url, is_cover, sort_order, created_at)
SELECT
  m.id,
  m.thumbnail_url,
  true,
  0,
  m.created_at
FROM public.models m
WHERE m.thumbnail_url IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.model_images mi WHERE mi.model_id = m.id AND mi.is_cover = true);

-- ============================================================================
-- 8. MODEL_FAVORITES (Wishlist / Social Proof)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.model_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_favorites_user_model_unique UNIQUE (user_id, model_id)
);

ALTER TABLE public.model_favorites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'model_favorites' AND policyname = 'model_favorites: user select own') THEN
    CREATE POLICY "model_favorites: user select own" ON public.model_favorites
      FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'model_favorites' AND policyname = 'model_favorites: user insert own') THEN
    CREATE POLICY "model_favorites: user insert own" ON public.model_favorites
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'model_favorites' AND policyname = 'model_favorites: user delete own') THEN
    CREATE POLICY "model_favorites: user delete own" ON public.model_favorites
      FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================================
-- 9. MODEL_EVENTS (Lightweight Telemetry & Analytics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.model_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('view', 'download', 'acquired', 'favorite')),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.model_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'model_events' AND policyname = 'model_events: service role only') THEN
    CREATE POLICY "model_events: service role only" ON public.model_events
      FOR ALL USING (false);
  END IF;
END $$;

-- ============================================================================
-- 10. EXTENSIONS ON public.model_acquisitions
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'model_acquisitions' AND column_name = 'price_paid') THEN
    ALTER TABLE public.model_acquisitions ADD COLUMN price_paid numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'model_acquisitions' AND column_name = 'currency') THEN
    ALTER TABLE public.model_acquisitions ADD COLUMN currency text NOT NULL DEFAULT 'INR';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'model_acquisitions' AND column_name = 'status') THEN
    ALTER TABLE public.model_acquisitions ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'model_acquisitions' AND column_name = 'order_id') THEN
    ALTER TABLE public.model_acquisitions ADD COLUMN order_id uuid REFERENCES public.mart_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 11. INDEXING (Targeted & Justified by Access Patterns)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_models_status_pub_date ON public.models (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_models_category_id ON public.models (category_id);
CREATE INDEX IF NOT EXISTS idx_models_license_id ON public.models (license_id);
CREATE INDEX IF NOT EXISTS idx_models_owner_id ON public.models (owner_id);
CREATE INDEX IF NOT EXISTS idx_models_seller_user_id ON public.models (seller_user_id);
CREATE INDEX IF NOT EXISTS idx_model_files_model_id ON public.model_files (model_id);
CREATE INDEX IF NOT EXISTS idx_model_images_model_id ON public.model_images (model_id);
CREATE INDEX IF NOT EXISTS idx_model_versions_model_id ON public.model_versions (model_id);
CREATE INDEX IF NOT EXISTS idx_model_tags_tag_id ON public.model_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_model_events_model_event ON public.model_events (model_id, event_type);
CREATE INDEX IF NOT EXISTS idx_model_acquisitions_user_id ON public.model_acquisitions (user_id, acquired_at DESC);

-- ============================================================================
-- 12. RPC FUNCTIONS (Secured & Optimized)
-- ============================================================================

DROP FUNCTION IF EXISTS public.can_user_access_model_file(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_user_access_model_file(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_user_model_acquisitions(uuid);
DROP FUNCTION IF EXISTS public.get_marketplace_models(text, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_marketplace_model_by_id(uuid);

-- Function: Secure download access check
CREATE OR REPLACE FUNCTION public.can_user_access_model_file(
  p_user_id uuid,
  p_model_id uuid,
  p_file_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  -- 1. Check if user is the creator / owner of the model
  IF EXISTS (
    SELECT 1 FROM public.models
    WHERE id = p_model_id AND (owner_id = p_user_id OR seller_user_id = p_user_id)
  ) THEN
    RETURN true;
  END IF;

  -- 2. Check if user has an active acquisition
  IF EXISTS (
    SELECT 1 FROM public.model_acquisitions
    WHERE user_id = p_user_id AND model_id = p_model_id AND status = 'active'
  ) THEN
    -- If a specific file_id was requested, confirm it belongs to the model
    IF p_file_id IS NOT NULL THEN
      RETURN EXISTS (
        SELECT 1 FROM public.model_files
        WHERE id = p_file_id AND model_id = p_model_id
      );
    END IF;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Function: Claim Model Acquisition (Free models)
CREATE OR REPLACE FUNCTION public.claim_model_acquisition(
  p_user_id uuid,
  p_model_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_model public.models%ROWTYPE;
  v_acquisition_id uuid;
BEGIN
  SELECT * INTO v_model FROM public.models WHERE id = p_model_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Model not found.');
  END IF;

  IF v_model.status <> 'published' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This model is not available for acquisition.');
  END IF;

  IF COALESCE(v_model.price, 0) > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paid models cannot be claimed directly. Payment processing is coming soon.');
  END IF;

  SELECT id INTO v_acquisition_id 
  FROM public.model_acquisitions 
  WHERE user_id = p_user_id AND model_id = p_model_id;

  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'already_acquired', true, 'message', 'This model is already in your library.');
  END IF;

  BEGIN
    INSERT INTO public.model_acquisitions (user_id, model_id, license_type, price_paid, currency, status)
    VALUES (p_user_id, p_model_id, COALESCE(v_model.license_type, 'standard'), 0, 'INR', 'active')
    RETURNING id INTO v_acquisition_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'already_acquired', true, 'message', 'This model is already in your library.');
  END;

  -- Record telemetry event
  INSERT INTO public.model_events (model_id, event_type, user_id, metadata)
  VALUES (p_model_id, 'acquired', p_user_id, jsonb_build_object('source', 'free_claim'));

  RETURN jsonb_build_object('success', true, 'acquisition_id', v_acquisition_id, 'message', 'Added to your library.');
END;
$$;

-- Function: Get User Model Acquisitions (for My Library)
CREATE OR REPLACE FUNCTION public.get_user_model_acquisitions(
  p_user_id uuid
)
RETURNS TABLE (
  acquisition_id uuid,
  acquired_at timestamptz,
  license_type text,
  model_id uuid,
  title text,
  description text,
  category text,
  price numeric,
  preview_image_paths text[],
  file_path text,
  seller_name text,
  formats text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ma.id AS acquisition_id,
    ma.acquired_at,
    ma.license_type,
    m.id AS model_id,
    COALESCE(m.title, m.name) AS title,
    m.description,
    COALESCE(c.name, m.category) AS category,
    m.price,
    m.preview_image_paths,
    COALESCE(m.file_path, m.storage_path) AS file_path,
    COALESCE(p.full_name, 'DripLnk Creator') AS seller_name,
    COALESCE(
      (
        SELECT array_agg(DISTINCT upper(mf.format))
        FROM public.model_files mf
        WHERE mf.model_id = m.id
      ),
      ARRAY['STL']::text[]
    ) AS formats
  FROM public.model_acquisitions ma
  JOIN public.models m ON m.id = ma.model_id
  LEFT JOIN public.categories c ON c.id = m.category_id
  LEFT JOIN public.profiles p ON p.id = COALESCE(m.seller_user_id, m.owner_id)
  WHERE ma.user_id = p_user_id AND ma.status = 'active'
  ORDER BY ma.acquired_at DESC;
END;
$$;

-- Function: Get Marketplace Models (Catalog Browsing)
CREATE OR REPLACE FUNCTION public.get_marketplace_models(
  p_search text DEFAULT NULL::text,
  p_category text DEFAULT NULL::text,
  p_license_type text DEFAULT NULL::text,
  p_sort text DEFAULT 'newest'::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 12
)
RETURNS TABLE(
  id uuid,
  seller_user_id uuid,
  title text,
  description text,
  category text,
  license_type text,
  price numeric,
  preview_image_paths text[],
  status text,
  created_at timestamp with time zone,
  seller_name text,
  seller_avatar text,
  formats text[],
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_offset integer := (GREATEST(p_page, 1) - 1) * p_page_size;
  v_clean_search text := NULLIF(TRIM(p_search), '');
  v_clean_cat text := NULLIF(TRIM(p_category), '');
  v_clean_lic text := NULLIF(TRIM(p_license_type), '');
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT 
      m.id,
      COALESCE(m.seller_user_id, m.owner_id) AS seller_user_id,
      COALESCE(m.title, m.name) AS title,
      m.description,
      COALESCE(c.name, m.category) AS category,
      COALESCE(l.name, m.license_type) AS license_type,
      m.price,
      m.preview_image_paths,
      m.status,
      m.created_at,
      COALESCE(p.full_name, 'DripLnk Creator') AS seller_name,
      p.avatar_url AS seller_avatar,
      COALESCE(
        (
          SELECT array_agg(DISTINCT upper(mf.format))
          FROM public.model_files mf
          WHERE mf.model_id = m.id
        ),
        ARRAY['STL']::text[]
      ) AS formats,
      COUNT(*) OVER() AS total_count
    FROM public.models m
    LEFT JOIN public.categories c ON c.id = m.category_id
    LEFT JOIN public.licenses l ON l.id = m.license_id
    LEFT JOIN public.profiles p ON p.id = COALESCE(m.seller_user_id, m.owner_id)
    WHERE m.status = 'published'
      AND (v_clean_cat IS NULL OR c.slug = lower(v_clean_cat) OR m.category ILIKE v_clean_cat)
      AND (v_clean_lic IS NULL OR l.slug = lower(v_clean_lic) OR m.license_type = v_clean_lic)
      AND (
        v_clean_search IS NULL 
        OR m.title ILIKE '%' || v_clean_search || '%'
        OR m.name ILIKE '%' || v_clean_search || '%'
        OR m.description ILIKE '%' || v_clean_search || '%'
        OR EXISTS (
          SELECT 1 FROM public.model_tags mt
          JOIN public.tags t ON t.id = mt.tag_id
          WHERE mt.model_id = m.id AND t.name ILIKE '%' || v_clean_search || '%'
        )
      )
  )
  SELECT 
    f.id,
    f.seller_user_id,
    f.title,
    f.description,
    f.category,
    f.license_type,
    f.price,
    f.preview_image_paths,
    f.status,
    f.created_at,
    f.seller_name,
    f.seller_avatar,
    f.formats,
    f.total_count
  FROM filtered f
  ORDER BY 
    CASE WHEN p_sort = 'price_low' THEN f.price END ASC,
    CASE WHEN p_sort = 'price_high' THEN f.price END DESC,
    f.created_at DESC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;

-- Function: Get Marketplace Model By ID (Detail View)
CREATE OR REPLACE FUNCTION public.get_marketplace_model_by_id(p_model_id uuid)
RETURNS TABLE(
  id uuid,
  seller_user_id uuid,
  title text,
  slug text,
  description text,
  category text,
  license_type text,
  price numeric,
  preview_image_paths text[],
  file_path text,
  status text,
  created_at timestamp with time zone,
  seller_name text,
  seller_avatar text,
  formats text[],
  files jsonb,
  images jsonb,
  license_info jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    COALESCE(m.seller_user_id, m.owner_id) AS seller_user_id,
    COALESCE(m.title, m.name) AS title,
    m.slug,
    m.description,
    COALESCE(c.name, m.category) AS category,
    COALESCE(l.name, m.license_type) AS license_type,
    m.price,
    m.preview_image_paths,
    COALESCE(m.file_path, m.storage_path) AS file_path,
    m.status,
    m.created_at,
    COALESCE(p.full_name, 'DripLnk Creator') AS seller_name,
    p.avatar_url AS seller_avatar,
    COALESCE(
      (
        SELECT array_agg(DISTINCT upper(mf.format))
        FROM public.model_files mf
        WHERE mf.model_id = m.id
      ),
      ARRAY['STL']::text[]
    ) AS formats,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', mf.id,
            'filename', mf.filename,
            'format', mf.format,
            'file_size', mf.file_size,
            'is_primary', mf.is_primary
          )
        )
        FROM public.model_files mf
        WHERE mf.model_id = m.id
      ),
      '[]'::jsonb
    ) AS files,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', mi.id,
            'thumbnail_url', mi.thumbnail_url,
            'is_cover', mi.is_cover,
            'alt_text', mi.alt_text
          )
        )
        FROM public.model_images mi
        WHERE mi.model_id = m.id
      ),
      '[]'::jsonb
    ) AS images,
    jsonb_build_object(
      'name', COALESCE(l.name, 'Standard License'),
      'description', COALESCE(l.description, 'Personal 3D printing license'),
      'allows_commercial', COALESCE(l.allows_commercial, false),
      'allows_remix', COALESCE(l.allows_remix, true)
    ) AS license_info
  FROM public.models m
  LEFT JOIN public.categories c ON c.id = m.category_id
  LEFT JOIN public.licenses l ON l.id = m.license_id
  LEFT JOIN public.profiles p ON p.id = COALESCE(m.seller_user_id, m.owner_id)
  WHERE m.id = p_model_id AND m.status = 'published';
END;
$$;

-- Function: Admin Get Pending Models
CREATE OR REPLACE FUNCTION public.admin_get_pending_models()
RETURNS TABLE (
  id uuid,
  title text,
  slug text,
  category text,
  price numeric,
  status text,
  created_at timestamptz,
  seller_name text,
  thumbnail_url text,
  part_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    COALESCE(m.title, m.name) AS title,
    m.slug,
    COALESCE(c.name, m.category) AS category,
    m.price,
    m.status,
    m.created_at,
    COALESCE(p.full_name, 'Independent Creator') AS seller_name,
    COALESCE(m.thumbnail_url, m.preview_image_paths[1]) AS thumbnail_url,
    (SELECT COUNT(*) FROM public.model_files mf WHERE mf.model_id = m.id) AS part_count
  FROM public.models m
  LEFT JOIN public.categories c ON c.id = m.category_id
  LEFT JOIN public.profiles p ON p.id = COALESCE(m.seller_user_id, m.owner_id)
  WHERE m.status IN ('pending_review', 'draft')
  ORDER BY m.created_at DESC;
END;
$$;

-- Function: Admin Review Model
CREATE OR REPLACE FUNCTION public.admin_review_model(
  p_model_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF p_status NOT IN ('published', 'rejected') THEN
    RAISE EXCEPTION 'Invalid review status: %', p_status;
  END IF;

  UPDATE public.models
  SET 
    status = p_status,
    admin_review_notes = p_notes,
    published_at = CASE WHEN p_status = 'published' THEN now() ELSE published_at END,
    updated_at = now()
  WHERE id = p_model_id;

  RETURN FOUND;
END;
$$;

-- Function: Toggle Model Favorite
CREATE OR REPLACE FUNCTION public.toggle_model_favorite(
  p_user_id uuid,
  p_model_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.model_favorites
    WHERE user_id = p_user_id AND model_id = p_model_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.model_favorites
    WHERE user_id = p_user_id AND model_id = p_model_id;
    RETURN jsonb_build_object('favorited', false);
  ELSE
    INSERT INTO public.model_favorites (user_id, model_id)
    VALUES (p_user_id, p_model_id);

    INSERT INTO public.model_events (model_id, event_type, user_id)
    VALUES (p_model_id, 'favorite', p_user_id);

    RETURN jsonb_build_object('favorited', true);
  END IF;
END;
$$;

-- ============================================================================
-- 13. SECURITY & PRIVILEGE LOCKDOWN
-- ============================================================================

-- Public read RPCs
GRANT EXECUTE ON FUNCTION public.get_marketplace_models(text, text, text, text, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_marketplace_model_by_id(uuid) TO anon, authenticated, service_role;

-- Privileged / Server-side RPCs
REVOKE EXECUTE ON FUNCTION public.claim_model_acquisition(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_model_acquisition(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_model_acquisitions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_model_acquisitions(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.can_user_access_model_file(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_access_model_file(uuid, uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_get_pending_models() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_pending_models() TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_review_model(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_model(uuid, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.toggle_model_favorite(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_model_favorite(uuid, uuid) TO service_role;
