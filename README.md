# QR Code-Based Attendance Monitoring System

A fully functional attendance monitoring system built with React, Vite, Tailwind CSS, and Supabase. Users receive unique QR codes for attendance tracking via TIME IN/TIME OUT scans.

## Features

- **User Authentication**: Secure registration and login with Supabase Auth
- **Unique QR Codes**: Each user gets a cryptographically generated unique QR token
- **Attendance Tracking**: TIME IN/TIME OUT recording with server-side validation
- **Live Clock**: Real-time clock displaying Asia/Manila timezone
- **Role-Based Access**: User, Scanner, and Admin roles with appropriate permissions
- **Attendance History**: View personal attendance records with pagination
- **Responsive Design**: Works on desktop and mobile devices
- **Secure Database**: Row Level Security (RLS) policies and PostgreSQL RPC functions

## Technology Stack

- **Frontend**: React.js, Vite, JavaScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **QR Generation**: qrcode.react
- **QR Scanning**: html5-qrcode

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Supabase project (free tier works)

## Setup Instructions

### 1. Database Setup

Go to your Supabase project's SQL Editor and execute the following SQL files in order:

#### File 1: `supabase/01_create_profiles_table.sql`
Creates the profiles table and trigger for automatic profile creation on user signup.

#### File 2: `supabase/02_create_attendance_records_table.sql`
Creates the attendance_records table for tracking TIME IN/TIME OUT.

#### File 3: `supabase/03_rls_policies.sql`
Implements Row Level Security policies to protect user data.

#### File 4: `supabase/04_record_attendance_rpc.sql`
Creates the PostgreSQL RPC function for secure attendance recording.

**Important**: Execute these files in the exact order shown above.

### 2. Environment Variables

Create a `.env` file in the project root and add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

To get these values:
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the Project URL and anon/public key

**Never expose your service_role key in frontend code.**

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Development Server

```bash
npm run dev
```

Open your browser to the URL shown in the terminal (usually `http://localhost:5173`).

## User Roles

### User (Default)
- Can view own profile
- Can view own QR code
- Can view own attendance history
- Cannot access scanner

### Scanner
- All user permissions
- Can access QR scanner
- Can record attendance for any user

### Admin
- All scanner permissions
- Can view all profiles
- Can view all attendance records

**Note**: New registrations default to the "user" role. To assign scanner or admin roles, manually update the `role` field in the Supabase `profiles` table.

## How It Works

### Registration Flow
1. User registers with email, password, and full name
2. Supabase Auth creates the user account
3. Database trigger automatically creates a profile
4. A unique QR token is generated and stored
5. User can log in and view their QR code

### Attendance Flow
1. User shows their QR code to an authorized scanner
2. Scanner uses the QR Scanner page with device camera
3. System validates the QR token against the database
4. If no open session exists → Records TIME IN
5. If open session exists → Records TIME OUT
6. Server-side timestamp is used (not browser time)
7. 5-second cooldown prevents duplicate scans

### Security Features
- Row Level Security on all tables
- Users can only read their own data
- Scanner operations require scanner/admin role
- Attendance recording uses secure PostgreSQL RPC function
- Server-side validation prevents unauthorized access
- QR tokens are cryptographically random and opaque

## Database Schema

### profiles
- `id` (UUID, references auth.users)
- `full_name` (TEXT)
- `email` (TEXT)
- `role` (TEXT: user/scanner/admin)
- `qr_token` (TEXT, unique)
- `created_at` (TIMESTAMP)

### attendance_records
- `id` (UUID)
- `user_id` (UUID, references profiles)
- `time_in` (TIMESTAMP)
- `time_out` (TIMESTAMP, nullable)
- `created_at` (TIMESTAMP)

## Testing the Application

### Test User Registration
1. Navigate to `/register`
2. Fill in full name, email, and password
3. Submit the form
4. Log in with the new account

### Test QR Code Display
1. Log in as a user
2. Navigate to "My QR Code"
3. Verify the QR code is displayed
4. Test the download functionality

### Test Attendance Recording
1. Manually update a user's role to "scanner" in Supabase
2. Log in as the scanner user
3. Navigate to "QR Scanner"
4. Start the camera
5. Scan a user's QR code
6. Verify TIME IN is recorded
7. Scan the same QR code again
8. Verify TIME OUT is recorded
9. Check the user's attendance history

### Test Attendance History
1. Log in as a regular user
2. Navigate to "Attendance History"
3. Verify all attendance records are displayed
4. Test pagination if you have many records

## Troubleshooting

### Camera Not Working
- Ensure camera permissions are granted in your browser
- Try using HTTPS (required for camera access in production)
- Check browser console for error messages

### Supabase Connection Issues
- Verify your `.env` file has correct values
- Ensure your Supabase project is active
- Check that RLS policies are correctly configured

### QR Code Not Scanning
- Ensure good lighting
- Hold the QR code steady within the camera frame
- Check that the QR code is not damaged or blurry

### Attendance Not Recording
- Verify the scanner user has "scanner" or "admin" role
- Check that the RPC function is correctly created
- Review Supabase logs for errors

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. Deploy the `dist` folder to your hosting provider (Vercel, Netlify, etc.)

3. Ensure your environment variables are set in production

4. Use HTTPS for camera access to work properly

## License

MIT
