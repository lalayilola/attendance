import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  LayoutDashboard, 
  QrCode, 
  History, 
  Scan, 
  User, 
  LogOut, 
  Menu,
  X,
  Clock,
  CheckCircle,
  ChevronDown
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [todayStatus, setTodayStatus] = useState({ hasTimeIn: false, hasTimeOut: false })

  useEffect(() => {
    if (profile) {
      fetchTodayStatus()
    }
  }, [profile])

  const fetchTodayStatus = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', profile.id)
        .gte('time_in', today)
        .order('time_in', { ascending: false })

      if (data && data.length > 0) {
        setTodayStatus({
          hasTimeIn: true,
          hasTimeOut: data.some(r => r.time_out)
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

  const mainNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/my-qr', icon: QrCode, label: 'My QR Code' },
    { path: '/history', icon: History, label: 'Attendance History' },
  ]

  const accountNavItems = [
    { path: '/profile', icon: User, label: 'Profile' },
  ]

  if (profile?.role === 'scanner' || profile?.role === 'admin') {
    mainNavItems.push({ path: '/scanner', icon: Scan, label: 'QR Scanner' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-primary-800">Attendance System</h1>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 transform transition-all duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:h-screen lg:sticky lg:top-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col h-full max-h-screen">
            {/* User Profile Card */}
            <div className="p-6 bg-gradient-to-br from-primary-600 to-primary-800">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
                  {profile?.profile_picture ? (
                    <img 
                      src={profile.profile_picture} 
                      alt="Profile" 
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-primary-600" />
                  )}
                </div>
                <div className="flex-1 text-white">
                  <h2 className="font-bold text-lg truncate">{profile?.full_name}</h2>
                  <p className="text-primary-100 text-sm truncate">{profile?.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-white/20 rounded-full text-xs capitalize">
                    {profile?.role}
                  </span>
                </div>
              </div>
            </div>

            {/* Today's Status Mini */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Today's Status</p>
              <div className="flex gap-2">
                <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg ${
                  todayStatus.hasTimeIn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-xs font-medium">Time In</span>
                </div>
                <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg ${
                  todayStatus.hasTimeOut ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-medium">Time Out</span>
                </div>
              </div>
            </div>

            {/* Main Navigation */}
            <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-4">Main Menu</p>
                <div className="space-y-1">
                  {mainNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname === item.path
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`
                          flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                          ${isActive 
                            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg' 
                            : 'text-gray-700 hover:bg-gray-100'
                          }
                        `}
                      >
                        <Icon 
                          size={20} 
                          className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} 
                        />
                        <span className="font-medium">{item.label}</span>
                        {isActive && <ChevronDown className="ml-auto w-4 h-4" />}
                      </Link>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-4">Account</p>
                <div className="space-y-1">
                  {accountNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname === item.path
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`
                          flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                          ${isActive 
                            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg' 
                            : 'text-gray-700 hover:bg-gray-100'
                          }
                        `}
                      >
                        <Icon 
                          size={20} 
                          className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} 
                        />
                        <span className="font-medium">{item.label}</span>
                        {isActive && <ChevronDown className="ml-auto w-4 h-4" />}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </nav>

            {/* Sign Out */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 group"
              >
                <LogOut size={20} className="group-hover:scale-110 transition-transform duration-200" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {/* Municipality Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-6 text-white shadow-lg mb-6">
            <h1 className="text-2xl font-bold">Municipality of Malimono</h1>
            <p className="text-primary-100 mt-1">Attendance Monitoring System</p>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
