import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  LayoutDashboard, 
  QrCode, 
  History, 
  User, 
  LogOut, 
  Clock, 
  CheckCircle, 
  Users, 
  Hourglass,
  Shield 
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [todayStatus, setTodayStatus] = useState({ 
    morningIn: false, 
    morningOut: false,
    afternoonIn: false,
    afternoonOut: false 
  })

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      fetchTodayStatus()
    }
  }, [profile])

  const fetchTodayStatus = async () => {
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', profile.id)
        .gte('time_in', `${today}T00:00:00+08:00`)
        .order('time_in', { ascending: true })

      if (data && data.length > 0) {
        let mIn = false, mOut = false, aIn = false, aOut = false
        data.forEach(r => {
          const hour = parseInt(new Date(r.time_in).toLocaleTimeString('en-US', {
            hour: '2-digit',
            hour12: false,
            timeZone: 'Asia/Manila'
          }), 10)

          if (hour < 12) {
            mIn = true
            if (r.time_out) mOut = true
          } else {
            aIn = true
            if (r.time_out) aOut = true
          }
        })

        setTodayStatus({
          morningIn: mIn,
          morningOut: mOut,
          afternoonIn: aIn,
          afternoonOut: aOut
        })
      }
    } catch (error) {
      console.error('Error fetching today status:', error)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navItems = profile?.role === 'admin'
    ? [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/history', icon: History, label: 'Staff Logs' },
        { path: '/admin', icon: Users, label: 'Staff' },
        { path: '/profile', icon: User, label: 'Profile' },
      ]
    : [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/my-qr', icon: QrCode, label: 'My QR' },
        { path: '/history', icon: History, label: 'History' },
        { path: '/profile', icon: User, label: 'Profile' },
      ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Header Bar across all devices */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Logo / Municipality Branding */}
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <img
              src="/Municipality of Malimono Seal.png"
              alt="Municipality of Malimono Seal"
              className="w-10 h-10 sm:w-11 sm:h-11 object-contain drop-shadow-sm transition-transform group-hover:scale-105"
            />
            <div>
              <h1 className="text-base sm:text-lg font-black text-gray-900 leading-tight tracking-tight group-hover:text-primary-700 transition-colors">
                Municipality of Malimono
              </h1>
              <p className="text-[11px] sm:text-xs font-semibold text-primary-700">
                Attendance Monitoring System
              </p>
            </div>
          </Link>

          {/* User Quick Info & Sign Out */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Today's status mini chips / Admin Badge */}
            {profile?.role === 'admin' ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold shadow-sm">
                <Shield size={13} className="text-purple-600" /> Administrator
              </span>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 text-xs">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border font-semibold ${
                  todayStatus.morningIn && todayStatus.morningOut
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : todayStatus.morningIn
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-gray-100 border-gray-200 text-gray-500'
                }`}>
                  AM: {todayStatus.morningIn ? (todayStatus.morningOut ? 'Done' : 'Timed In') : 'Pending'}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border font-semibold ${
                  todayStatus.afternoonIn && todayStatus.afternoonOut
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : todayStatus.afternoonIn
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-gray-100 border-gray-200 text-gray-500'
                }`}>
                  PM: {todayStatus.afternoonIn ? (todayStatus.afternoonOut ? 'Done' : 'Timed In') : 'Pending'}
                </span>
              </div>
            )}

            {/* Profile Avatar & Name */}
            <Link 
              to="/profile" 
              className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
              title="View Profile"
            >
              <div className="w-8 h-8 rounded-md bg-primary-100 flex items-center justify-center text-primary-700 font-bold overflow-hidden border border-primary-200">
                {profile?.profile_picture ? (
                  <img src={profile.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  profile?.full_name ? profile.full_name[0].toUpperCase() : 'U'
                )}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-gray-900 leading-tight truncate max-w-[120px]">
                  {profile?.full_name?.split(' ')[0]}
                </p>
                <span className="text-[10px] font-semibold text-gray-500 uppercase">
                  {profile?.role}
                </span>
              </div>
            </Link>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="p-2 sm:px-3 sm:py-1.5 text-rose-600 hover:bg-rose-50 rounded-md border border-rose-200 hover:border-rose-300 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              title="Sign Out"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3.5 sm:p-6 lg:p-8 pb-28 sm:pb-28">
        {profile?.status === 'pending' && location.pathname !== '/profile' ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="w-16 h-16 bg-amber-100 rounded-lg flex items-center justify-center mb-5">
              <Hourglass className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Account Pending Approval</h2>
            <p className="text-gray-600 text-sm max-w-md">
              Your account has been registered and is awaiting approval from an administrator.
              You'll be able to access attendance features once approved.
            </p>
            <p className="text-xs text-gray-500 mt-4">
              You can still view and update your <Link to="/profile" className="text-primary-600 font-bold hover:underline">profile</Link>.
            </p>
          </div>
        ) : (
          children
        )}
      </main>

      {/* Persistent Bottom Navigation Bar (Across all devices) */}
      <nav 
        aria-label="Bottom Navigation" 
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
      >
        <div className="max-w-2xl mx-auto px-2 sm:px-6">
          <div className="flex items-center justify-around py-1.5 sm:py-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex-1 flex flex-col items-center justify-center py-1 sm:py-1.5 px-2 rounded-md transition-all duration-150 relative group
                    ${isActive 
                      ? 'text-primary-600 font-bold bg-primary-50/70' 
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/70 font-medium'
                    }
                  `}
                >
                  {/* Active Indicator Top Line */}
                  {isActive && (
                    <span className="absolute -top-1.5 sm:-top-2 w-8 h-1 bg-primary-600 rounded-sm"></span>
                  )}

                  <Icon 
                    size={20} 
                    className={`transition-transform duration-150 ${isActive ? 'scale-110 text-primary-600' : 'group-hover:scale-105'}`} 
                  />
                  <span className="text-[11px] sm:text-xs tracking-tight mt-0.5">
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}
