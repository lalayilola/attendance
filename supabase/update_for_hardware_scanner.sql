-- ============================================================
-- SQL Update: Morning & Afternoon Session Rules + Hardware Scanner
-- Run this entire script in Supabase -> SQL Editor -> Run
-- ============================================================

-- Ensure department and position columns exist on profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position TEXT DEFAULT '';

DROP FUNCTION IF EXISTS public.record_attendance(text);
DROP FUNCTION IF EXISTS public.record_attendance(text, float8, float8);
DROP FUNCTION IF EXISTS public.record_attendance(text, float8, float8, text);
DROP FUNCTION IF EXISTS public.record_attendance(text, double precision, double precision);
DROP FUNCTION IF EXISTS public.record_attendance(text, double precision, double precision, text);

CREATE OR REPLACE FUNCTION public.record_attendance(p_qr_token text, p_latitude float8 DEFAULT NULL, p_longitude float8 DEFAULT NULL, p_action text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_user_status text;
  v_scanned_status text;
  v_user_name text;
  v_location_ok boolean;
  v_current_time timestamptz;
  v_ph_time timestamp;
  v_today date;
  v_hour integer;
  v_cooldown_seconds integer := 5;
  v_last_record_id uuid;
  v_last_time_out timestamptz;

  -- Morning and Afternoon records for today
  v_am_id uuid;
  v_am_in timestamptz;
  v_am_out timestamptz;

  v_pm_id uuid;
  v_pm_in timestamptz;
  v_pm_out timestamptz;

  v_target_action text;
BEGIN
  -- Current server time in UTC
  v_current_time := NOW();
  -- Asia/Manila (UTC+8) local time conversion
  v_ph_time := (v_current_time AT TIME ZONE 'Asia/Manila');
  v_today := v_ph_time::date;
  v_hour := EXTRACT(HOUR FROM v_ph_time)::integer;

  -- 1. Caller validation (if web user is logged in)
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

  -- 2. Geofence verification (only if scanner_locations has active rows)
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

  -- 3. Verify scanned employee profile by QR token
  SELECT id, status, full_name INTO v_user_id, v_scanned_status, v_user_name
  FROM public.profiles
  WHERE qr_token = p_qr_token;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid QR code'
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
    AND (time_in AT TIME ZONE 'Asia/Manila')::date = v_today
    AND EXTRACT(HOUR FROM (time_in AT TIME ZONE 'Asia/Manila')) < 12
  ORDER BY time_in ASC
  LIMIT 1;

  SELECT id, time_in, time_out INTO v_pm_id, v_pm_in, v_pm_out
  FROM public.attendance_records
  WHERE user_id = v_user_id 
    AND (time_in AT TIME ZONE 'Asia/Manila')::date = v_today
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
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Both Morning and Afternoon attendance are already completed for today.'
      );
    END IF;
  END IF;

END;
$$;

-- Grant execution permission to both anon and authenticated callers
GRANT EXECUTE ON FUNCTION public.record_attendance(text, float8, float8, text) TO anon, authenticated;
