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

#### Database Setup

Go to your Supabase project's SQL Editor and run the file `supabase/setup.sql`. It creates everything needed: the `profiles` and `attendance_records` tables, indexes, Row Level Security policies, and the `record_attendance` RPC function. The script is idempotent and safe to re-run.

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

## User Roles & Approval

Every registered account has a **role** (`user` or `admin`) and a **status** (`pending` or `approved`). New registrations default to `user` + `pending`.

### Pending accounts
- Can log in and view their profile only
- Cannot access the dashboard, QR code, history, or scanner
- Attendance cannot be recorded for them

### Approved users (role: `user`)
- Can view own profile, QR code, and attendance history
- Can access the QR scanner and record attendance

### Admins (role: `admin`)
- All user permissions
- Can view all profiles and attendance records
- Can approve pending registrations
- Can download DTR (daily time record) PDF reports

**Approving accounts**: Pending users can be approved from the Admin page, or via SQL:

```sql
UPDATE public.profiles SET status = 'approved' WHERE email = 'user@example.com';
```

**Making an admin**:

```sql
UPDATE public.profiles SET role = 'admin', status = 'approved' WHERE email = 'admin@example.com';
```

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
