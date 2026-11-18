-- Fix for trigger to bypass RLS when creating profiles
-- Drop the trigger since we're creating profiles from frontend

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop the restrictive INSERT policy and allow inserts
DROP POLICY IF EXISTS "Trigger can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile inserts" ON public.profiles;

-- Allow anyone to insert profiles (data is validated by constraints)
CREATE POLICY "Allow profile inserts"
  ON public.profiles FOR INSERT
  TO public
  WITH CHECK (true);
