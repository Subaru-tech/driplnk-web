-- Migration: 20260911090000_vendor_marketplace.sql
-- Purpose: Schema, RLS, and RPCs for DripLnk Vendor Marketplace & Mart Quote Engine

-- 1. Drop existing legacy constraints and table for mart_orders if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_order_id_fkey') THEN
    ALTER TABLE public.sales DROP CONSTRAINT sales_order_id_fkey;
  END IF;
END $$;

DROP TABLE IF EXISTS public.mart_orders CASCADE;

-- 2. Create vendor_profiles table
CREATE TABLE IF NOT EXISTS public.vendor_profiles (
  provider_id uuid PRIMARY KEY REFERENCES public.providers(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  location text,
  materials_supported text[] NOT NULL DEFAULT '{}',
  capacity_notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create vendor_pricing_rules table (Deliberately never publicly readable)
CREATE TABLE IF NOT EXISTS public.vendor_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  material text NOT NULL,
  price_per_gram numeric NOT NULL CHECK (price_per_gram > 0),
  min_order_price numeric NOT NULL CHECK (min_order_price >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create quote_requests table
CREATE TABLE IF NOT EXISTS public.quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  material text,
  weight_g numeric CHECK (weight_g >= 0),
  status text NOT NULL CHECK (status IN ('pending', 'weighed', 'failed')) DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Create mart_orders table
CREATE TABLE IF NOT EXISTS public.mart_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE RESTRICT,
  buyer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE RESTRICT,
  price numeric NOT NULL CHECK (price >= 0),
  material text NOT NULL,
  status text NOT NULL CHECK (
    status IN ('placed', 'accepted', 'printing', 'shipped', 'delivered', 'completed', 'cancelled')
  ) DEFAULT 'placed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Restore sales FK if sales table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales') THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.mart_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Enable Row-Level Security
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mart_orders ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies on vendor_profiles (Owner-only, no public access)
CREATE POLICY "vendor_profiles: owner select" ON public.vendor_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = vendor_profiles.provider_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "vendor_profiles: owner insert" ON public.vendor_profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = vendor_profiles.provider_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "vendor_profiles: owner update" ON public.vendor_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = vendor_profiles.provider_id
        AND p.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = vendor_profiles.provider_id
        AND p.user_id = auth.uid()
    )
  );

-- 8. RLS Policies on vendor_pricing_rules (Owner-only, strictly never publicly readable)
CREATE POLICY "vendor_pricing_rules: owner select" ON public.vendor_pricing_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = vendor_pricing_rules.provider_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "vendor_pricing_rules: owner insert" ON public.vendor_pricing_rules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = vendor_pricing_rules.provider_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "vendor_pricing_rules: owner update" ON public.vendor_pricing_rules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = vendor_pricing_rules.provider_id
        AND p.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = vendor_pricing_rules.provider_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "vendor_pricing_rules: owner delete" ON public.vendor_pricing_rules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = vendor_pricing_rules.provider_id
        AND p.user_id = auth.uid()
    )
  );

-- 9. RLS Policies on quote_requests (User sees only their own)
CREATE POLICY "quote_requests: user select own" ON public.quote_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "quote_requests: user insert own" ON public.quote_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "quote_requests: user update own" ON public.quote_requests
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 10. RLS Policies on mart_orders (Buyer sees own, Vendor sees assigned)
CREATE POLICY "mart_orders: party select" ON public.mart_orders
  FOR SELECT USING (
    buyer_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = mart_orders.provider_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "mart_orders: buyer insert" ON public.mart_orders
  FOR INSERT WITH CHECK (buyer_user_id = auth.uid());

CREATE POLICY "mart_orders: party update" ON public.mart_orders
  FOR UPDATE USING (
    buyer_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = mart_orders.provider_id
        AND p.user_id = auth.uid()
    )
  );

-- 11. Atomic RPC: apply_vendor_profile
CREATE OR REPLACE FUNCTION public.apply_vendor_profile(
  p_user_id uuid,
  p_business_name text,
  p_location text DEFAULT NULL,
  p_materials_supported text[] DEFAULT '{}',
  p_capacity_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_provider_id uuid;
BEGIN
  -- Insert or retain pending vendor provider
  INSERT INTO public.providers (user_id, type, status)
  VALUES (p_user_id, 'vendor', 'pending')
  ON CONFLICT (user_id, type)
  DO UPDATE SET status = 'pending'
  RETURNING id INTO v_provider_id;

  IF v_provider_id IS NULL THEN
    SELECT id INTO v_provider_id FROM public.providers WHERE user_id = p_user_id AND type = 'vendor';
  END IF;

  -- Upsert vendor profile
  INSERT INTO public.vendor_profiles (
    provider_id,
    business_name,
    location,
    materials_supported,
    capacity_notes,
    updated_at
  ) VALUES (
    v_provider_id,
    p_business_name,
    p_location,
    p_materials_supported,
    p_capacity_notes,
    now()
  )
  ON CONFLICT (provider_id)
  DO UPDATE SET
    business_name = EXCLUDED.business_name,
    location = EXCLUDED.location,
    materials_supported = EXCLUDED.materials_supported,
    capacity_notes = EXCLUDED.capacity_notes,
    updated_at = now();

  RETURN v_provider_id;
END;
$$;

-- 12. Quote RPC: get_mart_vendor_quotes (SECURITY DEFINER, strictly never leaks price_per_gram or min_order_price)
CREATE OR REPLACE FUNCTION public.get_mart_vendor_quotes(
  p_weight_g numeric,
  p_material text
)
RETURNS TABLE (
  provider_id uuid,
  business_name text,
  location text,
  price numeric,
  material text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS provider_id,
    vp.business_name,
    vp.location,
    ROUND(GREATEST(vpr.min_order_price, p_weight_g * vpr.price_per_gram), 2) AS price,
    vpr.material
  FROM public.providers p
  JOIN public.vendor_profiles vp ON vp.provider_id = p.id
  JOIN public.vendor_pricing_rules vpr ON vpr.provider_id = p.id
  WHERE p.type = 'vendor'
    AND p.status = 'approved'
    AND vpr.active = true
    AND LOWER(vpr.material) = LOWER(p_material)
  ORDER BY price ASC, vp.business_name ASC;
END;
$$;

-- 13. Atomic RPC: create_mart_order
CREATE OR REPLACE FUNCTION public.create_mart_order(
  p_buyer_user_id uuid,
  p_quote_request_id uuid,
  p_provider_id uuid,
  p_material text,
  p_price numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_provider public.providers%ROWTYPE;
  v_order_id uuid;
BEGIN
  -- Verify provider is an approved vendor
  SELECT * INTO v_provider FROM public.providers WHERE id = p_provider_id AND type = 'vendor';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor provider not found';
  END IF;

  IF v_provider.status <> 'approved' THEN
    RAISE EXCEPTION 'Cannot place order with unapproved vendor';
  END IF;

  IF v_provider.user_id = p_buyer_user_id THEN
    RAISE EXCEPTION 'You cannot order from your own print hub';
  END IF;

  -- Verify quote request exists and belongs to buyer
  IF NOT EXISTS (SELECT 1 FROM public.quote_requests WHERE id = p_quote_request_id AND user_id = p_buyer_user_id) THEN
    RAISE EXCEPTION 'Invalid quote request';
  END IF;

  INSERT INTO public.mart_orders (
    quote_request_id,
    buyer_user_id,
    provider_id,
    price,
    material,
    status
  ) VALUES (
    p_quote_request_id,
    p_buyer_user_id,
    p_provider_id,
    p_price,
    p_material,
    'placed'
  ) RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;

-- 14. Atomic RPC: respond_to_mart_order
CREATE OR REPLACE FUNCTION public.respond_to_mart_order(
  p_user_id uuid,
  p_order_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order public.mart_orders%ROWTYPE;
  v_provider public.providers%ROWTYPE;
  v_is_vendor boolean := false;
  v_is_buyer boolean := false;
BEGIN
  SELECT * INTO v_order FROM public.mart_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT * INTO v_provider FROM public.providers WHERE id = v_order.provider_id;
  
  IF v_provider.user_id = p_user_id THEN
    v_is_vendor := true;
  END IF;

  IF v_order.buyer_user_id = p_user_id THEN
    v_is_buyer := true;
  END IF;

  IF NOT v_is_vendor AND NOT v_is_buyer THEN
    RAISE EXCEPTION 'Unauthorized: You are not a party to this order';
  END IF;

  IF p_action = 'accept' THEN
    IF NOT v_is_vendor THEN
      RAISE EXCEPTION 'Unauthorized: Only the vendor can accept an order';
    END IF;
    IF v_order.status <> 'placed' THEN
      RAISE EXCEPTION 'Order can only be accepted when in placed status';
    END IF;
    UPDATE public.mart_orders
    SET status = 'accepted', updated_at = now()
    WHERE id = p_order_id;

  ELSIF p_action = 'print' THEN
    IF NOT v_is_vendor THEN
      RAISE EXCEPTION 'Unauthorized: Only the vendor can move an order to printing';
    END IF;
    IF v_order.status <> 'accepted' THEN
      RAISE EXCEPTION 'Order can only begin printing after acceptance';
    END IF;
    UPDATE public.mart_orders
    SET status = 'printing', updated_at = now()
    WHERE id = p_order_id;

  ELSIF p_action = 'ship' THEN
    IF NOT v_is_vendor THEN
      RAISE EXCEPTION 'Unauthorized: Only the vendor can mark an order shipped';
    END IF;
    IF v_order.status <> 'printing' THEN
      RAISE EXCEPTION 'Order can only be shipped after printing';
    END IF;
    UPDATE public.mart_orders
    SET status = 'shipped', updated_at = now()
    WHERE id = p_order_id;

  ELSIF p_action = 'deliver' THEN
    IF NOT v_is_vendor THEN
      RAISE EXCEPTION 'Unauthorized: Only the vendor can mark an order delivered';
    END IF;
    IF v_order.status <> 'shipped' THEN
      RAISE EXCEPTION 'Order can only be delivered after being shipped';
    END IF;
    UPDATE public.mart_orders
    SET status = 'delivered', updated_at = now()
    WHERE id = p_order_id;

  ELSIF p_action = 'complete' THEN
    IF NOT v_is_buyer THEN
      RAISE EXCEPTION 'Unauthorized: Only the buyer can mark an order completed';
    END IF;
    IF v_order.status <> 'delivered' THEN
      RAISE EXCEPTION 'Order can only be completed after being delivered';
    END IF;
    UPDATE public.mart_orders
    SET status = 'completed', updated_at = now()
    WHERE id = p_order_id;

  ELSIF p_action = 'cancel' THEN
    IF v_is_buyer AND v_order.status = 'placed' THEN
      UPDATE public.mart_orders
      SET status = 'cancelled', updated_at = now()
      WHERE id = p_order_id;
    ELSIF v_is_vendor AND v_order.status IN ('placed', 'accepted') THEN
      UPDATE public.mart_orders
      SET status = 'cancelled', updated_at = now()
      WHERE id = p_order_id;
    ELSE
      RAISE EXCEPTION 'Cannot cancel order in current status (%)', v_order.status;
    END IF;

  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'action', p_action);
END;
$$;

-- 15. Query RPC: get_mart_orders_for_user
CREATE OR REPLACE FUNCTION public.get_mart_orders_for_user(
  p_user_id uuid,
  p_role text
)
RETURNS TABLE (
  id uuid,
  quote_request_id uuid,
  buyer_user_id uuid,
  provider_id uuid,
  price numeric,
  material text,
  status text,
  file_path text,
  weight_g numeric,
  created_at timestamptz,
  updated_at timestamptz,
  counterparty_name text,
  counterparty_email text,
  counterparty_location text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_role = 'buyer' THEN
    RETURN QUERY
    SELECT
      mo.id,
      mo.quote_request_id,
      mo.buyer_user_id,
      mo.provider_id,
      mo.price,
      mo.material,
      mo.status,
      qr.file_path,
      qr.weight_g,
      mo.created_at,
      mo.updated_at,
      CASE
        WHEN mo.status IN ('accepted', 'printing', 'shipped', 'delivered', 'completed')
          THEN vp.business_name
        ELSE 'Assigned Print Farm'
      END AS counterparty_name,
      CASE
        WHEN mo.status IN ('accepted', 'printing', 'shipped', 'delivered', 'completed')
          THEN vu.email::text
        ELSE NULL
      END AS counterparty_email,
      CASE
        WHEN mo.status IN ('accepted', 'printing', 'shipped', 'delivered', 'completed')
          THEN vp.location
        ELSE NULL
      END AS counterparty_location
    FROM public.mart_orders mo
    JOIN public.quote_requests qr ON qr.id = mo.quote_request_id
    JOIN public.providers p ON p.id = mo.provider_id
    JOIN public.vendor_profiles vp ON vp.provider_id = p.id
    JOIN auth.users vu ON vu.id = p.user_id
    WHERE mo.buyer_user_id = p_user_id
    ORDER BY mo.created_at DESC;

  ELSIF p_role = 'vendor' THEN
    RETURN QUERY
    SELECT
      mo.id,
      mo.quote_request_id,
      mo.buyer_user_id,
      mo.provider_id,
      mo.price,
      mo.material,
      mo.status,
      qr.file_path,
      qr.weight_g,
      mo.created_at,
      mo.updated_at,
      COALESCE(bp.full_name, 'DripLnk Buyer') AS counterparty_name,
      bu.email::text AS counterparty_email,
      NULL::text AS counterparty_location
    FROM public.mart_orders mo
    JOIN public.quote_requests qr ON qr.id = mo.quote_request_id
    JOIN public.providers p ON p.id = mo.provider_id
    JOIN auth.users bu ON bu.id = mo.buyer_user_id
    LEFT JOIN public.profiles bp ON bp.id = mo.buyer_user_id
    WHERE p.user_id = p_user_id
    ORDER BY mo.created_at DESC;

  ELSE
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;
END;
$$;

-- 16. Atomic RPC: create_quote_request (SECURITY DEFINER for server-side quote requests)
CREATE OR REPLACE FUNCTION public.create_quote_request(
  p_user_id uuid,
  p_file_path text,
  p_material text,
  p_weight_g numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote_request_id uuid;
BEGIN
  INSERT INTO public.quote_requests (
    user_id,
    file_path,
    material,
    weight_g,
    status
  ) VALUES (
    p_user_id,
    p_file_path,
    p_material,
    p_weight_g,
    'weighed'
  ) RETURNING id INTO v_quote_request_id;

  RETURN v_quote_request_id;
END;
$$;

-- 17. Helper RPC: admin_get_mart_order
CREATE OR REPLACE FUNCTION public.admin_get_mart_order(p_order_id uuid)
RETURNS TABLE (
  id uuid,
  status text,
  price numeric,
  material text,
  buyer_user_id uuid,
  provider_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mo.id,
    mo.status,
    mo.price,
    mo.material,
    mo.buyer_user_id,
    mo.provider_id,
    mo.created_at,
    mo.updated_at
  FROM public.mart_orders mo
  WHERE mo.id = p_order_id;
END;
$$;

