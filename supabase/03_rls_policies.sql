-- Row Level Security Policies for profiles table

-- Disable RLS on profiles temporarily to fix profile loading
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Row Level Security Policies for attendance_records table

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Scanners and admins can view all attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "No direct insert for users" ON public.attendance_records;
DROP POLICY IF EXISTS "No direct update for users" ON public.attendance_records;
DROP POLICY IF EXISTS "No delete for users" ON public.attendance_records;

-- Users can read their own attendance records
CREATE POLICY "Users can view own attendance"
  ON public.attendance_records FOR SELECT
  USING (user_id = auth.uid());

-- Scanner and admin roles can read all attendance records
CREATE POLICY "Scanners and admins can view all attendance"
  ON public.attendance_records FOR SELECT
  USING (true);

-- Users cannot insert attendance records directly (only via RPC function)
CREATE POLICY "No direct insert for users"
  ON public.attendance_records FOR INSERT
  WITH CHECK (false);

-- Users cannot update attendance records directly
CREATE POLICY "No direct update for users"
  ON public.attendance_records FOR UPDATE
  WITH CHECK (false);

-- Users cannot delete attendance records
CREATE POLICY "No delete for users"
  ON public.attendance_records FOR DELETE
  USING (false);
