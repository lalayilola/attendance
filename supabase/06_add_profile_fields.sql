-- Add additional profile fields for user profile page
-- This migration adds address, phone, and profile_picture fields to the profiles table

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS profile_picture TEXT;
