-- PostgreSQL RPC function for secure attendance recording
-- This function handles TIME IN and TIME OUT logic with server-side validation
-- Only scanner and admin roles can call this function

CREATE OR REPLACE FUNCTION public.record_attendance(p_qr_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_last_record_id UUID;
  v_last_time_out TIMESTAMP WITH TIME ZONE;
  v_current_time TIMESTAMP WITH TIME ZONE;
  v_cooldown_seconds INTEGER := 5; -- 5 second cooldown to prevent duplicate scans
  v_result JSONB;
BEGIN
  -- Set current time to server time
  v_current_time := NOW();
  
  -- Validate that the caller has scanner or admin role
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  IF v_user_role NOT IN ('scanner', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Only scanner and admin roles can record attendance'
    );
  END IF;
  
  -- Find user by QR token
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE qr_token = p_qr_token;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid QR token'
    );
  END IF;
  
  -- Check for cooldown: find the most recent attendance record for this user
  SELECT id, time_out INTO v_last_record_id, v_last_time_out
  FROM public.attendance_records
  WHERE user_id = v_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If there's a recent record, check cooldown
  IF v_last_record_id IS NOT NULL THEN
    IF v_last_time_out IS NULL THEN
      -- Open session exists, check if it's too recent
      IF EXTRACT(EPOCH FROM (v_current_time - (
        SELECT created_at FROM public.attendance_records WHERE id = v_last_record_id
      ))) < v_cooldown_seconds THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Please wait a moment before scanning again'
        );
      END IF;
    ELSE
      -- Closed session exists, check if it's too recent
      IF EXTRACT(EPOCH FROM (v_current_time - v_last_time_out)) < v_cooldown_seconds THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Please wait a moment before scanning again'
        );
      END IF;
    END IF;
  END IF;
  
  -- Check if user has an open attendance session (time_in without time_out)
  SELECT id INTO v_last_record_id
  FROM public.attendance_records
  WHERE user_id = v_user_id AND time_out IS NULL
  ORDER BY time_in DESC
  LIMIT 1;
  
  IF v_last_record_id IS NOT NULL THEN
    -- User has an open session, record TIME OUT
    UPDATE public.attendance_records
    SET time_out = v_current_time
    WHERE id = v_last_record_id;
    
    -- Get user name for response
    v_result := jsonb_build_object(
      'success', true,
      'action', 'TIME OUT',
      'timestamp', v_current_time,
      'user_id', v_user_id,
      'message', 'Time out recorded successfully'
    );
  ELSE
    -- User has no open session, record TIME IN
    INSERT INTO public.attendance_records (user_id, time_in)
    VALUES (v_user_id, v_current_time);
    
    v_result := jsonb_build_object(
      'success', true,
      'action', 'TIME IN',
      'timestamp', v_current_time,
      'user_id', v_user_id,
      'message', 'Time in recorded successfully'
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.record_attendance(TEXT) TO authenticated;
