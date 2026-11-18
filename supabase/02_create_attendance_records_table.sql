-- Create attendance_records table
-- This table stores attendance tracking with time_in and time_out

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  time_in TIMESTAMP WITH TIME ZONE NOT NULL,
  time_out TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index on user_id for fast user-specific queries
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_id ON public.attendance_records(user_id);

-- Create index on time_in for date-based queries
CREATE INDEX IF NOT EXISTS idx_attendance_records_time_in ON public.attendance_records(time_in DESC);

-- Create composite index for finding open attendance sessions
CREATE INDEX IF NOT EXISTS idx_attendance_records_open_session ON public.attendance_records(user_id, time_out) 
WHERE time_out IS NULL;

-- Enable Row Level Security
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
