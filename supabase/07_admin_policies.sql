-- Admin dashboard support
-- These policies are inert while RLS is disabled on profiles (see 03_rls_policies.sql),
-- but ensure correct access if RLS is re-enabled later.

-- Users can always view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Admins can view all profiles (for the employee management page)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Attendance records: restrict the "view all" policy to scanner/admin roles.
-- (Previously it allowed any authenticated user to read every record.)
DROP POLICY IF EXISTS "Scanners and admins can view all attendance" ON public.attendance_records;
CREATE POLICY "Scanners and admins can view all attendance"
  ON public.attendance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('scanner', 'admin')
    )
  );

-- NOTE: To make a user an admin, run (replace with the user's id/email):
--   UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@example.com';
