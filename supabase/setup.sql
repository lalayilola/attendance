-- ============================================================
-- QR Attendance System — Complete Database Setup
-- Run this entire file once in the Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP IF EXISTS.
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  qr_token TEXT NOT NULL UNIQUE,
  address TEXT,
  department TEXT DEFAULT '',
  position TEXT DEFAULT '',
  phone TEXT,
  profile_picture TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_qr_token ON public.profiles(qr_token);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Migration for databases created before the status column existed.
-- Existing accounts are grandfathered in as 'approved'; only NEW
-- registrations default to 'pending' and require admin approval.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
    UPDATE public.profiles SET status = 'approved';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_status_check CHECK (status IN ('pending', 'approved'));
  END IF;

  -- Ensure department and position columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'department'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN department TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'position'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN position TEXT DEFAULT '';
  END IF;
END $$;

-- The 'scanner' role was removed: all approved users can scan QR codes.
-- Migrate any existing scanner accounts to 'user' and tighten the role CHECK.
UPDATE public.profiles SET role = 'user' WHERE role = 'scanner';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin'));

-- Remove the legacy auto-profile trigger if it exists (from the old
-- 01_create_profiles_table.sql). Profiles are created by the frontend;
-- the trigger causes duplicate/conflicting profile rows on signup.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- RLS stays disabled on profiles: the frontend creates profile rows
-- directly after signup, and reads/writes are limited by policies below
-- only if RLS is re-enabled later.
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Profiles table policies (inert while RLS is disabled, kept for safety)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Trigger can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile inserts" ON public.profiles;
CREATE POLICY "Allow profile inserts"
  ON public.profiles FOR INSERT
  TO public
  WITH CHECK (true);

-- ------------------------------------------------------------
-- 2. attendance_records table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  time_in TIMESTAMP WITH TIME ZONE NOT NULL,
  time_out TIMESTAMP WITH TIME ZONE,
  time_in_latitude DOUBLE PRECISION,
  time_in_longitude DOUBLE PRECISION,
  time_in_location TEXT,
  time_out_latitude DOUBLE PRECISION,
  time_out_longitude DOUBLE PRECISION,
  time_out_location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_user_id ON public.attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_time_in ON public.attendance_records(time_in DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_records_open_session ON public.attendance_records(user_id, time_out)
WHERE time_out IS NULL;

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Attendance records policies
DROP POLICY IF EXISTS "Users can view own attendance" ON public.attendance_records;
CREATE POLICY "Users can view own attendance"
  ON public.attendance_records FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Scanners and admins can view all attendance" ON public.attendance_records;
CREATE POLICY "Scanners and admins can view all attendance"
  ON public.attendance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('scanner', 'admin')
    )
  );

DROP POLICY IF EXISTS "No direct insert for users" ON public.attendance_records;
CREATE POLICY "No direct insert for users"
  ON public.attendance_records FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "No direct update for users" ON public.attendance_records;
CREATE POLICY "No direct update for users"
  ON public.attendance_records FOR UPDATE
  WITH CHECK (false);

DROP POLICY IF EXISTS "No delete for users" ON public.attendance_records;
CREATE POLICY "No delete for users"
  ON public.attendance_records FOR DELETE
  USING (false);

-- ------------------------------------------------------------
-- 2b. scanner_locations table
--     Approved GPS areas where the web QR scanner may operate.
--     Add your office location via SQL (see bottom of file).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scanner_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 100
);

-- RLS enabled with no policies: only the SECURITY DEFINER RPC
-- function can read this table.
ALTER TABLE public.scanner_locations ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 3. record_attendance RPC function
--    Handles TIME IN / TIME OUT with server-side validation.
--    Enforces Morning (AM) and Afternoon (PM) sessions:
--      - Maximum ONE Time In and ONE Time Out in the Morning
--      - Maximum ONE Time In and ONE Time Out in the Afternoon
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_attendance(TEXT);
DROP FUNCTION IF EXISTS public.record_attendance(TEXT, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.record_attendance(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT);
DROP FUNCTION IF EXISTS public.record_attendance(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.record_attendance(
  p_qr_token text, 
  p_latitude float8 DEFAULT NULL, 
  p_longitude float8 DEFAULT NULL, 
  p_action text DEFAULT NULL,
  p_location_name text DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_status TEXT;
  v_scanned_status TEXT;
  v_scanned_role TEXT;
  v_user_name TEXT;
  v_location_ok BOOLEAN;
  v_current_time TIMESTAMP WITH TIME ZONE;
  v_ph_time TIMESTAMP WITH TIME ZONE;
  v_today DATE;
  v_hour INTEGER;
  v_cooldown_seconds INTEGER := 5; -- 5 second cooldown to prevent accidental double-scans
  v_last_record_id UUID;
  v_last_time_out TIMESTAMP WITH TIME ZONE;

  -- Morning and Afternoon records for today
  v_am_id UUID;
  v_am_in TIMESTAMP WITH TIME ZONE;
  v_am_out TIMESTAMP WITH TIME ZONE;

  v_pm_id UUID;
  v_pm_in TIMESTAMP WITH TIME ZONE;
  v_pm_out TIMESTAMP WITH TIME ZONE;

  v_target_action TEXT;
  v_result JSONB;
BEGIN
  -- Set current time to server time
  v_current_time := NOW();
  -- Asia/Manila (UTC+8) timezone
  v_ph_time := v_current_time AT TIME ZONE 'Asia/Manila';
  v_today := DATE(v_ph_time);
  v_hour := EXTRACT(HOUR FROM v_ph_time);

  -- 1. Caller validation (if called by logged-in web user)
  IF auth.uid() IS NOT NULL THEN
    SELECT status INTO v_user_status
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_user_status IS DISTINCT FROM 'approved' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Unauthorized: Only approved users can record attendance'
      );
    END IF;
  END IF;

  -- 2. Geofence verification (only if locations exist and coordinates provided)
  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.scanner_locations) THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.scanner_locations sl
        WHERE 6371000 * 2 * ASIN(SQRT(
          POWER(SIN(RADIANS(p_latitude - sl.latitude) / 2), 2) +
          COS(RADIANS(sl.latitude)) * COS(RADIANS(p_latitude)) *
          POWER(SIN(RADIANS(p_longitude - sl.longitude) / 2), 2)
        )) <= sl.radius_meters
      ) INTO v_location_ok;

      IF NOT v_location_ok THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Scan rejected: outside authorized area'
        );
      END IF;
    END IF;
  END IF;

  -- 3. Find scanned user profile by QR token
  SELECT id, status, full_name, role INTO v_user_id, v_scanned_status, v_user_name, v_scanned_role
  FROM public.profiles
  WHERE qr_token = p_qr_token;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid QR code'
    );
  END IF;

  IF v_scanned_role = 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Admin accounts do not record attendance'
    );
  END IF;

  IF v_scanned_status <> 'approved' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Account is pending approval'
    );
  END IF;

  -- 4. Check cooldown to prevent duplicate rapid scans (5 seconds)
  SELECT id, time_out INTO v_last_record_id, v_last_time_out
  FROM public.attendance_records
  WHERE user_id = v_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_record_id IS NOT NULL THEN
    IF v_last_time_out IS NULL THEN
      IF EXTRACT(EPOCH FROM (v_current_time - (
        SELECT created_at FROM public.attendance_records WHERE id = v_last_record_id
      ))) < v_cooldown_seconds THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Please wait before scanning again'
        );
      END IF;
    ELSE
      IF EXTRACT(EPOCH FROM (v_current_time - v_last_time_out)) < v_cooldown_seconds THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Please wait before scanning again'
        );
      END IF;
    END IF;
  END IF;

  -- 5. Query today's Morning and Afternoon records for this user (Philippine Time)
  SELECT id, time_in, time_out INTO v_am_id, v_am_in, v_am_out
  FROM public.attendance_records
  WHERE user_id = v_user_id 
    AND DATE(time_in AT TIME ZONE 'Asia/Manila') = v_today
    AND EXTRACT(HOUR FROM (time_in AT TIME ZONE 'Asia/Manila')) < 12
  ORDER BY time_in ASC
  LIMIT 1;

  SELECT id, time_in, time_out INTO v_pm_id, v_pm_in, v_pm_out
  FROM public.attendance_records
  WHERE user_id = v_user_id 
    AND DATE(time_in AT TIME ZONE 'Asia/Manila') = v_today
    AND EXTRACT(HOUR FROM (time_in AT TIME ZONE 'Asia/Manila')) >= 12
  ORDER BY time_in ASC
  LIMIT 1;

  -- Normalize action parameter if provided ('TIME IN' or 'TIME OUT')
  v_target_action := UPPER(TRIM(COALESCE(p_action, '')));

  -- 6. Enforce Morning & Afternoon attendance rules
  IF v_hour < 12 THEN
    -- ========================================================
    -- MORNING SESSION (Before 12:00 PM)
    -- ========================================================
    IF v_am_id IS NULL THEN
      -- No morning record exists yet: Only TIME IN allowed
      IF v_target_action = 'TIME OUT' THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Cannot Time Out: No active Morning Time In found for today.'
        );
      END IF;

      INSERT INTO public.attendance_records (user_id, time_in)
      VALUES (v_user_id, v_current_time)
      RETURNING id INTO v_am_id;

      RETURN jsonb_build_object(
        'success', true,
        'action', 'TIME IN',
        'session', 'MORNING',
        'name', v_user_name,
        'timestamp', v_current_time,
        'user_id', v_user_id,
        'message', 'Morning TIME IN recorded successfully'
      );

    ELSIF v_am_out IS NULL THEN
      -- Morning record exists and is OPEN: Only TIME OUT allowed
      IF v_target_action = 'TIME IN' THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'You are already Timed In for the Morning session. Scan TIME OUT to complete it.'
        );
      END IF;

      UPDATE public.attendance_records
      SET time_out = v_current_time
      WHERE id = v_am_id;

      RETURN jsonb_build_object(
        'success', true,
        'action', 'TIME OUT',
        'session', 'MORNING',
        'name', v_user_name,
        'timestamp', v_current_time,
        'user_id', v_user_id,
        'message', 'Morning TIME OUT recorded successfully'
      );

    ELSE
      -- Both Morning Time In and Time Out already completed
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Morning attendance is already completed for today. Afternoon session starts at 12:00 PM.'
      );
    END IF;

  ELSE
    -- ========================================================
    -- AFTERNOON SESSION (12:00 PM onwards)
    -- ========================================================
    -- Check if user has an unclosed Morning record (e.g. clocked in at 8 AM, timing out after 12 PM for lunch)
    IF v_am_id IS NOT NULL AND v_am_out IS NULL THEN
      IF v_target_action = 'TIME IN' THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'You have an open Morning session. Please Time Out your Morning session first.'
        );
      END IF;

      UPDATE public.attendance_records
      SET time_out = v_current_time
      WHERE id = v_am_id;

      RETURN jsonb_build_object(
        'success', true,
        'action', 'TIME OUT',
        'session', 'MORNING',
        'name', v_user_name,
        'timestamp', v_current_time,
        'user_id', v_user_id,
        'message', 'Morning TIME OUT recorded successfully'
      );
    END IF;

    -- Afternoon record processing
    IF v_pm_id IS NULL THEN
      -- No afternoon record exists yet: Only TIME IN allowed
      IF v_target_action = 'TIME OUT' THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Cannot Time Out: No active Afternoon Time In found for today.'
        );
      END IF;

      INSERT INTO public.attendance_records (user_id, time_in)
      VALUES (v_user_id, v_current_time)
      RETURNING id INTO v_pm_id;

      RETURN jsonb_build_object(
        'success', true,
        'action', 'TIME IN',
        'session', 'AFTERNOON',
        'name', v_user_name,
        'timestamp', v_current_time,
        'user_id', v_user_id,
        'message', 'Afternoon TIME IN recorded successfully'
      );

    ELSIF v_pm_out IS NULL THEN
      -- Afternoon record exists and is OPEN: Only TIME OUT allowed
      IF v_target_action = 'TIME IN' THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'You are already Timed In for the Afternoon session. Scan TIME OUT to complete it.'
        );
      END IF;

      UPDATE public.attendance_records
      SET time_out = v_current_time
      WHERE id = v_pm_id;

      RETURN jsonb_build_object(
        'success', true,
        'action', 'TIME OUT',
        'session', 'AFTERNOON',
        'name', v_user_name,
        'timestamp', v_current_time,
        'user_id', v_user_id,
        'message', 'Afternoon TIME OUT recorded successfully'
      );

    ELSE
      -- Both Afternoon Time In and Time Out already completed
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Both Morning and Afternoon attendance are already completed for today.'
      );
    END IF;
  END IF;

END;
$$;

-- Grant execution permission to both anon and authenticated callers
GRANT EXECUTE ON FUNCTION public.record_attendance(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- 4. Role & approval management helpers
--    New registrations start as status='pending' and must be approved
--    by an admin in the Admin page (or via SQL below).
--    To make a user an admin, run (replace email):
--      UPDATE public.profiles SET role = 'admin', status = 'approved' WHERE email = 'admin@example.com';
--    To approve a pending user without changing their role:
--      UPDATE public.profiles SET status = 'approved' WHERE email = 'user@example.com';
--
-- 5. Scanner locations
--    The web scanner only works within radius_meters of a row here.
--    Get coordinates from Google Maps (right-click a spot → copy lat/lng),
--    then run (replace with your actual values):
--      INSERT INTO public.scanner_locations (name, latitude, longitude, radius_meters)
--      VALUES ('Main Office', 9.XXXXXXX, 124.XXXXXXX, 100);
--    To add more areas, insert additional rows.
-- ------------------------------------------------------------
