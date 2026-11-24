-- ============================================================
-- SQL Migration: Add Location Tracking to Attendance Records
-- Run this in your Supabase Project -> SQL Editor
-- ============================================================

-- 1. Add location columns to attendance_records
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS time_in_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS time_in_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS time_in_location TEXT,
  ADD COLUMN IF NOT EXISTS time_out_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS time_out_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS time_out_location TEXT;

-- 2. Drop existing function signatures to avoid parameter name/type conflicts
DROP FUNCTION IF EXISTS public.record_attendance(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.record_attendance(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) CASCADE;
DROP FUNCTION IF EXISTS public.record_attendance(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.record_attendance(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) CASCADE;

-- 3. Create updated record_attendance RPC function with location support
CREATE OR REPLACE FUNCTION public.record_attendance(
  p_qr_token TEXT,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_location_name TEXT DEFAULT NULL
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
  v_location_name TEXT;
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

  -- 2. Geofence verification & Location name resolution
  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    -- Check if within any defined scanner location
    IF EXISTS (SELECT 1 FROM public.scanner_locations) THEN
      SELECT name INTO v_location_name
      FROM public.scanner_locations sl
      WHERE 6371000 * 2 * ASIN(SQRT(
        POWER(SIN(RADIANS(p_latitude - sl.latitude) / 2), 2) +
        COS(RADIANS(sl.latitude)) * COS(RADIANS(p_latitude)) *
        POWER(SIN(RADIANS(p_longitude - sl.longitude) / 2), 2)
      )) <= sl.radius_meters
      LIMIT 1;

      IF v_location_name IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Scan rejected: outside authorized attendance location'
        );
      END IF;
    ELSE
      -- Use client-provided geocoded place name or fallback to GPS coordinates
      IF p_location_name IS NOT NULL AND TRIM(p_location_name) <> '' THEN
        v_location_name := p_location_name;
      ELSE
        v_location_name := 'GPS (' || ROUND(p_latitude::numeric, 4) || ', ' || ROUND(p_longitude::numeric, 4) || ')';
      END IF;
    END IF;
  ELSE
    -- Called from Hardware Scanner (ESP32-S3 terminal without GPS module)
    v_location_name := COALESCE(p_location_name, 'ESP32 Hardware Terminal');
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
      'error', 'Admin accounts do not log attendance'
    );
  END IF;

  IF v_scanned_status <> 'approved' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This account is pending admin approval'
    );
  END IF;

  -- 4. Global cooldown check (5 seconds between any scans for this user)
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

  -- Normalize action if explicitly passed
  IF p_action IS NOT NULL AND TRIM(p_action) <> '' THEN
    v_target_action := UPPER(TRIM(p_action));
  ELSE
    v_target_action := NULL;
  END IF;

  -- 5. Fetch Today's Morning and Afternoon records for this user
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

  -- 6. Enforce Session Rules based on Current Time
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

      INSERT INTO public.attendance_records (
        user_id, time_in, time_in_latitude, time_in_longitude, time_in_location
      )
      VALUES (
        v_user_id, v_current_time, p_latitude, p_longitude, v_location_name
      )
      RETURNING id INTO v_am_id;

      RETURN jsonb_build_object(
        'success', true,
        'action', 'TIME IN',
        'session', 'MORNING',
        'name', v_user_name,
        'location', v_location_name,
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
      SET time_out = v_current_time,
          time_out_latitude = p_latitude,
          time_out_longitude = p_longitude,
          time_out_location = v_location_name
      WHERE id = v_am_id;

      RETURN jsonb_build_object(
        'success', true,
        'action', 'TIME OUT',
        'session', 'MORNING',
        'name', v_user_name,
        'location', v_location_name,
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
    -- Check if user has an unclosed Morning record
    IF v_am_id IS NOT NULL AND v_am_out IS NULL THEN
      IF v_target_action = 'TIME IN' THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'You have an open Morning session. Please Time Out your Morning session first.'
        );
      END IF;

      UPDATE public.attendance_records
      SET time_out = v_current_time,
          time_out_latitude = p_latitude,
          time_out_longitude = p_longitude,
          time_out_location = v_location_name
      WHERE id = v_am_id;

      RETURN jsonb_build_object(
        'success', true,
        'action', 'TIME OUT',
        'session', 'MORNING',
        'name', v_user_name,
        'location', v_location_name,
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

      INSERT INTO public.attendance_records (
        user_id, time_in, time_in_latitude, time_in_longitude, time_in_location
      )
      VALUES (
        v_user_id, v_current_time, p_latitude, p_longitude, v_location_name
      )
      RETURNING id INTO v_pm_id;

      RETURN jsonb_build_object(
        'success', true,
        'action', 'TIME IN',
        'session', 'AFTERNOON',
        'name', v_user_name,
        'location', v_location_name,
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
      SET time_out = v_current_time,
          time_out_latitude = p_latitude,
          time_out_longitude = p_longitude,
          time_out_location = v_location_name
      WHERE id = v_pm_id;

      RETURN jsonb_build_object(
        'success', true,
        'action', 'TIME OUT',
        'session', 'AFTERNOON',
        'name', v_user_name,
        'location', v_location_name,
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

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.record_attendance(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) TO anon, authenticated;
