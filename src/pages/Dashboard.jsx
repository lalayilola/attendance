import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LiveClock } from '../components/LiveClock'
import { AttendanceCalendar } from '../components/AttendanceCalendar'
import { QRScannerModal } from '../components/QRScannerModal'
import { supabase } from '../lib/supabase'
import { 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  LogIn, 
  LogOut, 
  QrCode, 
  Sun, 
  Sunset,
  Users,
  History,
  Shield,
  UserCheck,
  Hourglass,
  Search,
  Calendar,
  MapPin
} from 'lucide-react'

export function Dashboard() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  // User state
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerMode, setScannerMode] = useState('TIME IN')
  const [stats, setStats] = useState({
    totalHours: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0
  })

  // Admin state
  const [adminStats, setAdminStats] = useState({
    totalStaff: 0,
    presentToday: 0,
    currentlyIn: 0,
    pendingApprovals: 0
  })
  const [todayStaffData, setTodayStaffData] = useState([])
  const [staffSearch, setStaffSearch] = useState('')

  useEffect(() => {
    if (profile) {
      if (isAdmin) {
        fetchAdminDashboard()
      } else {
        fetchUserAttendance()
      }
    }
  }, [profile, isAdmin])

  const handleOpenScanner = (mode) => {
    setScannerMode(mode)
    setScannerOpen(true)
  }

  // ==========================================
  // STAFF / USER LOGIC
  // ==========================================
  const fetchUserAttendance = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', profile.id)
        .order('time_in', { ascending: false })

      if (error) throw error
      setAttendanceRecords(data || [])
      calculateUserStats(data || [])
    } catch (error) {
      console.error('Error fetching attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateUserStats = (records) => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const monthRecords = records.filter(record => {
      const recordDate = new Date(record.time_in)
      return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear
    })

    const uniqueDays = new Set(monthRecords.map(r => new Date(r.time_in).toDateString()))
    
    let totalHours = 0
    let presentDays = 0
    let lateDays = 0

    uniqueDays.forEach(dayStr => {
      const dayRecords = monthRecords.filter(r => new Date(r.time_in).toDateString() === dayStr)
      const hasCompleteRecords = dayRecords.every(r => r.time_out)
      
      if (hasCompleteRecords) {
        presentDays++
        dayRecords.forEach(record => {
          if (record.time_in && record.time_out) {
            const inTime = new Date(record.time_in)
            const outTime = new Date(record.time_out)
            totalHours += (outTime - inTime) / (1000 * 60 * 60)
          }
          
          const hour = new Date(record.time_in).getHours()
          if (hour >= 9) {
            lateDays++
          }
        })
      }
    })

    const workingDays = new Set()
    for (let i = 1; i <= now.getDate(); i++) {
      const date = new Date(currentYear, currentMonth, i)
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        workingDays.add(date.toDateString())
      }
    }

    setStats({
      totalHours: totalHours.toFixed(1),
      presentDays,
      absentDays: workingDays.size - presentDays,
      lateDays
    })
  }

  // Today's Morning and Afternoon status for current user (Philippine Time)
  const todaySessions = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
    const todayRecords = attendanceRecords.filter(r => {
      if (!r.time_in) return false
      return new Date(r.time_in).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) === today
    })

    const amRec = todayRecords.find(r => {
      const hour = parseInt(new Date(r.time_in).toLocaleTimeString('en-US', {
        hour: '2-digit',
        hour12: false,
        timeZone: 'Asia/Manila'
      }), 10)
      return hour < 12
    })

    const pmRec = todayRecords.find(r => {
      const hour = parseInt(new Date(r.time_in).toLocaleTimeString('en-US', {
        hour: '2-digit',
        hour12: false,
        timeZone: 'Asia/Manila'
      }), 10)
      return hour >= 12
    })

    const fmt = (d) => d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' }) : null

    return {
      amIn: fmt(amRec?.time_in),
      amOut: fmt(amRec?.time_out),
      pmIn: fmt(pmRec?.time_in),
      pmOut: fmt(pmRec?.time_out),
    }
  }, [attendanceRecords])

  // ==========================================
  // ADMIN LOGIC
  // ==========================================
  const fetchAdminDashboard = async () => {
    try {
      setLoading(true)

      // 1. Fetch profiles
      const { data: profilesData, error: profError } = await supabase
        .from('profiles')
        .select('*')
      if (profError) throw profError

      const allProfiles = profilesData || []
      const staffProfiles = allProfiles.filter(p => p.role === 'user')
      const approvedStaff = staffProfiles.filter(p => p.status === 'approved')
      const pendingStaff = staffProfiles.filter(p => p.status === 'pending')

      const profileMap = new Map(allProfiles.map(p => [p.id, p]))

      // 2. Fetch today's attendance records (Philippine Time)
      const todayDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
      const { data: recData, error: recError } = await supabase
        .from('attendance_records')
        .select('*')
        .gte('time_in', `${todayDateStr}T00:00:00+08:00`)
        .order('time_in', { ascending: false })

      if (recError) throw recError

      const todayRecords = recData || []

      // Calculate distinct staff present today
      const presentStaffIds = new Set(todayRecords.map(r => r.user_id))

      // Staff currently on duty (time_out is null on their latest record)
      const openSessions = todayRecords.filter(r => !r.time_out)
      const currentlyOnDuty = new Set(openSessions.map(r => r.user_id))

      setAdminStats({
        totalStaff: approvedStaff.length,
        presentToday: presentStaffIds.size,
        currentlyIn: currentlyOnDuty.size,
        pendingApprovals: pendingStaff.length
      })

      // Group today's records by staff user
      const userDayMap = {}
      todayRecords.forEach(rec => {
        const uProfile = profileMap.get(rec.user_id)
        // Skip records belonging to admins if any
        if (uProfile?.role === 'admin') return

        if (!userDayMap[rec.user_id]) {
          userDayMap[rec.user_id] = {
            user_id: rec.user_id,
            user: uProfile || { full_name: 'Unknown Staff', email: '' },
            morningRecord: null,
            afternoonRecord: null
          }
        }

        const hour = parseInt(new Date(rec.time_in).toLocaleTimeString('en-US', {
          hour: '2-digit',
          hour12: false,
          timeZone: 'Asia/Manila'
        }), 10)

        if (hour < 12) {
          if (!userDayMap[rec.user_id].morningRecord) {
            userDayMap[rec.user_id].morningRecord = rec
          }
        } else {
          if (!userDayMap[rec.user_id].afternoonRecord) {
            userDayMap[rec.user_id].afternoonRecord = rec
          }
        }
      })

      setTodayStaffData(Object.values(userDayMap))
    } catch (error) {
      console.error('Error fetching admin dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTodayStaff = useMemo(() => {
    if (!staffSearch.trim()) return todayStaffData
    const q = staffSearch.toLowerCase()
    return todayStaffData.filter(item => 
      item.user?.full_name?.toLowerCase().includes(q) ||
      item.user?.email?.toLowerCase().includes(q) ||
      item.user?.department?.toLowerCase().includes(q) ||
      item.user?.position?.toLowerCase().includes(q)
    )
  }, [todayStaffData, staffSearch])

  const formatClock = (dateString) => {
    if (!dateString) return '--:--'
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila'
    })
  }

  const renderClockWithLocation = (timeStr, record, isTimeIn = true) => {
    if (!timeStr) return <span className="text-gray-400">--:--</span>

    const locName = isTimeIn ? record?.time_in_location : record?.time_out_location
    const lat = isTimeIn ? record?.time_in_latitude : record?.time_out_latitude
    const lng = isTimeIn ? record?.time_in_longitude : record?.time_out_longitude
    const hasCoords = lat !== null && lat !== undefined && lng !== null && lng !== undefined
    const displayLoc = locName || (hasCoords ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : null)

    return (
      <div className="flex flex-col items-center">
        <span className={isTimeIn ? 'text-emerald-700 font-bold' : 'text-blue-700 font-bold'}>
          {formatClock(timeStr)}
        </span>
        {displayLoc && (
          hasCoords ? (
            <a
              href={`https://www.google.com/maps?q=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 mt-0.5 text-[10px] text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1 py-0.2 rounded transition-colors max-w-[110px] truncate font-normal"
              title={`${displayLoc} (Click to open map)`}
              onClick={(e) => e.stopPropagation()}
            >
              <MapPin className="w-2.5 h-2.5 flex-shrink-0 text-emerald-600" />
              <span className="truncate">{displayLoc}</span>
            </a>
          ) : (
            <span
              className="inline-flex items-center gap-0.5 mt-0.5 text-[10px] text-gray-600 bg-gray-100 px-1 py-0.2 rounded max-w-[110px] truncate font-normal"
              title={displayLoc}
            >
              <MapPin className="w-2.5 h-2.5 flex-shrink-0 text-gray-400" />
              <span className="truncate">{displayLoc}</span>
            </span>
          )
        )}
      </div>
    )
  }

  // ==========================================
  // RENDER: ADMIN VIEW
  // ==========================================
  if (isAdmin) {
    return (
      <div className="space-y-6 sm:space-y-8 animate-fade-in">
        {/* Admin Welcome Header */}
        <div className="bg-gradient-to-r from-primary-700 via-primary-800 to-primary-900 rounded-lg sm:rounded-xl p-5 sm:p-8 text-white shadow-md">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 sm:mb-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-white/20 text-white uppercase tracking-wider">
                  <Shield size={12} /> Administrator Portal
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                Welcome, {profile?.full_name?.split(' ')[0] || 'Admin'}!
              </h1>
              <p className="text-primary-100 text-xs sm:text-sm mt-1">
                Municipality Staff Attendance & Live Monitoring Overview
              </p>
            </div>
            <LiveClock />
          </div>
        </div>

        {/* Admin Quick Action Hub */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Administrative Actions</h2>
              <p className="text-xs sm:text-sm text-gray-500">Review staff attendance records or manage employee registrations</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-primary-50 text-primary-700 border border-primary-200 self-start sm:self-auto">
              Admin Portal
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Link
              to="/history"
              className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3.5 px-4 rounded-md font-bold text-xs sm:text-sm hover:from-primary-700 hover:to-primary-800 transition-all active:scale-[0.98] shadow-sm hover:shadow-md cursor-pointer tracking-wide text-center"
            >
              <History className="w-4 h-4 sm:w-5 sm:h-5" />
              Overall Attendance History
            </Link>

            <Link
              to="/admin"
              className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3.5 px-4 rounded-md font-bold text-xs sm:text-sm hover:from-purple-700 hover:to-purple-800 transition-all active:scale-[0.98] shadow-sm hover:shadow-md cursor-pointer tracking-wide text-center"
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              Manage Staff & Approvals
            </Link>
          </div>
        </div>

        {/* Admin Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 sm:p-6 text-white shadow-md">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <Users className="w-6 h-6 sm:w-7 sm:h-7 opacity-85" />
              <span className="text-2xl sm:text-3xl font-bold">{adminStats.totalStaff}</span>
            </div>
            <p className="text-blue-100 text-xs sm:text-sm font-medium">Approved Staff</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-4 sm:p-6 text-white shadow-md">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <UserCheck className="w-6 h-6 sm:w-7 sm:h-7 opacity-85" />
              <span className="text-2xl sm:text-3xl font-bold">{adminStats.presentToday}</span>
            </div>
            <p className="text-emerald-100 text-xs sm:text-sm font-medium">Present Today</p>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-4 sm:p-6 text-white shadow-md">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <Clock className="w-6 h-6 sm:w-7 sm:h-7 opacity-85" />
              <span className="text-2xl sm:text-3xl font-bold">{adminStats.currentlyIn}</span>
            </div>
            <p className="text-amber-100 text-xs sm:text-sm font-medium">Currently On Duty</p>
          </div>

          <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-lg p-4 sm:p-6 text-white shadow-md">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <Hourglass className="w-6 h-6 sm:w-7 sm:h-7 opacity-85" />
              <span className="text-2xl sm:text-3xl font-bold">{adminStats.pendingApprovals}</span>
            </div>
            <p className="text-rose-100 text-xs sm:text-sm font-medium">Pending Approvals</p>
          </div>
        </div>

        {/* Today's Staff Attendance Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                  Today's Staff Activity
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Real-time Civil Service DTR attendance logged today (Philippine Standard Time)
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search staff name..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-md animate-pulse"></div>
              ))}
            </div>
          ) : filteredTodayStaff.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
              <Clock className="w-12 h-12 text-gray-300 mb-2" />
              <p className="font-semibold text-gray-700">No staff attendance recorded yet today</p>
              <p className="text-xs text-gray-400 mt-1">Staff will appear here automatically as they scan their QR code</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 text-xs border-b border-gray-200">
                    <th className="py-3 px-4 text-left font-bold">Staff Member</th>
                    <th className="py-3 px-3 text-center font-bold">
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <Sun size={12} /> Morning In
                      </span>
                    </th>
                    <th className="py-3 px-3 text-center font-bold">
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <Sun size={12} /> Morning Out
                      </span>
                    </th>
                    <th className="py-3 px-3 text-center font-bold">
                      <span className="inline-flex items-center gap-1 text-blue-700">
                        <Sunset size={12} /> Afternoon In
                      </span>
                    </th>
                    <th className="py-3 px-3 text-center font-bold">
                      <span className="inline-flex items-center gap-1 text-blue-700">
                        <Sunset size={12} /> Afternoon Out
                      </span>
                    </th>
                    <th className="py-3 px-4 text-center font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                  {filteredTodayStaff.map((item) => {
                    const amIn = formatClock(item.morningRecord?.time_in)
                    const amOut = formatClock(item.morningRecord?.time_out)
                    const pmIn = formatClock(item.afternoonRecord?.time_in)
                    const pmOut = formatClock(item.afternoonRecord?.time_out)

                    const isCurrentlyIn = 
                      (item.morningRecord?.time_in && !item.morningRecord?.time_out) ||
                      (item.afternoonRecord?.time_in && !item.afternoonRecord?.time_out)

                    return (
                      <tr key={item.user_id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-xs flex-shrink-0">
                              {item.user?.full_name ? item.user.full_name[0].toUpperCase() : 'U'}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 leading-tight">
                                {item.user?.full_name || 'Staff Member'}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
                                {item.user?.department && (
                                  <span className="font-semibold text-primary-700 bg-primary-50 px-1.5 py-0.2 rounded border border-primary-200/60">
                                    {item.user.department}
                                  </span>
                                )}
                                {item.user?.position && (
                                  <span className="text-gray-600 font-medium">
                                    • {item.user.position}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-gray-700">
                          {renderClockWithLocation(item.morningRecord?.time_in, item.morningRecord, true)}
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-gray-700">
                          {renderClockWithLocation(item.morningRecord?.time_out, item.morningRecord, false)}
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-gray-700">
                          {renderClockWithLocation(item.afternoonRecord?.time_in, item.afternoonRecord, true)}
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-gray-700">
                          {renderClockWithLocation(item.afternoonRecord?.time_out, item.afternoonRecord, false)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isCurrentlyIn ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> On Duty
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200">
                              Timed Out
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ==========================================
  // RENDER: STAFF / USER VIEW
  // ==========================================
  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-lg sm:rounded-xl p-5 sm:p-8 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2 tracking-tight">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}!
            </h1>
            <p className="text-primary-100 text-sm sm:text-base">Here's your attendance overview</p>
          </div>
          <LiveClock />
        </div>
      </div>

      {/* Quick Actions (Placed right below Welcome and Clock) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-5">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Quick Actions</h2>
            <p className="text-xs sm:text-sm text-gray-500">Scan QR directly from another phone or upload an image</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-primary-50 text-primary-700 border border-primary-200 self-start sm:self-auto">
            <QrCode className="w-3.5 h-3.5" /> Auto-Scanner
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <button 
            onClick={() => handleOpenScanner('TIME IN')}
            className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white py-3.5 px-5 rounded-md font-bold text-sm hover:from-emerald-700 hover:to-green-700 transition-all active:scale-[0.98] shadow-sm hover:shadow-md cursor-pointer tracking-wide"
          >
            <LogIn className="w-5 h-5" />
            TIME IN
          </button>
          <button 
            onClick={() => handleOpenScanner('TIME OUT')}
            className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white py-3.5 px-5 rounded-md font-bold text-sm hover:from-rose-700 hover:to-red-700 transition-all active:scale-[0.98] shadow-sm hover:shadow-md cursor-pointer tracking-wide"
          >
            <LogOut className="w-5 h-5" />
            TIME OUT
          </button>
        </div>

        {/* Today's Morning & Afternoon Session Status */}
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className={`p-2.5 rounded-md border ${
            todaySessions.amIn ? 'bg-emerald-50/70 border-emerald-200' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Sun size={11} className="text-amber-500" /> Morning In
              </span>
              {todaySessions.amIn && <CheckCircle size={12} className="text-emerald-600" />}
            </div>
            <span className={`font-bold text-sm ${todaySessions.amIn ? 'text-emerald-900' : 'text-gray-400'}`}>
              {todaySessions.amIn || '--:--'}
            </span>
          </div>

          <div className={`p-2.5 rounded-md border ${
            todaySessions.amOut ? 'bg-emerald-50/70 border-emerald-200' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Sun size={11} className="text-amber-500" /> Morning Out
              </span>
              {todaySessions.amOut && <CheckCircle size={12} className="text-emerald-600" />}
            </div>
            <span className={`font-bold text-sm ${todaySessions.amOut ? 'text-emerald-900' : 'text-gray-400'}`}>
              {todaySessions.amOut || '--:--'}
            </span>
          </div>

          <div className={`p-2.5 rounded-md border ${
            todaySessions.pmIn ? 'bg-blue-50/70 border-blue-200' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Sunset size={11} className="text-orange-500" /> Afternoon In
              </span>
              {todaySessions.pmIn && <CheckCircle size={12} className="text-blue-600" />}
            </div>
            <span className={`font-bold text-sm ${todaySessions.pmIn ? 'text-blue-900' : 'text-gray-400'}`}>
              {todaySessions.pmIn || '--:--'}
            </span>
          </div>

          <div className={`p-2.5 rounded-md border ${
            todaySessions.pmOut ? 'bg-blue-50/70 border-blue-200' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Sunset size={11} className="text-orange-500" /> Afternoon Out
              </span>
              {todaySessions.pmOut && <CheckCircle size={12} className="text-blue-600" />}
            </div>
            <span className={`font-bold text-sm ${todaySessions.pmOut ? 'text-blue-900' : 'text-gray-400'}`}>
              {todaySessions.pmOut || '--:--'}
            </span>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-5 sm:p-6 text-white shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <Clock className="w-7 h-7 sm:w-8 sm:h-8 opacity-80" />
            <span className="text-2xl sm:text-3xl font-bold">{stats.totalHours}h</span>
          </div>
          <p className="text-blue-100 text-xs sm:text-sm font-medium">Total Hours This Month</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-5 sm:p-6 text-white shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 opacity-80" />
            <span className="text-2xl sm:text-3xl font-bold">{stats.presentDays}</span>
          </div>
          <p className="text-emerald-100 text-xs sm:text-sm font-medium">Days Present</p>
        </div>

        <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-lg p-5 sm:p-6 text-white shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 opacity-80" />
            <span className="text-2xl sm:text-3xl font-bold">{stats.absentDays}</span>
          </div>
          <p className="text-rose-100 text-xs sm:text-sm font-medium">Days Absent</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-5 sm:p-6 text-white shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <TrendingUp className="w-7 h-7 sm:w-8 sm:h-8 opacity-80" />
            <span className="text-2xl sm:text-3xl font-bold">{stats.lateDays}</span>
          </div>
          <p className="text-amber-100 text-xs sm:text-sm font-medium">Late Arrivals</p>
        </div>
      </div>

      {/* Attendance Calendar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-5 sm:mb-6 tracking-tight">Attendance Calendar</h2>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent"></div>
          </div>
        ) : (
          <AttendanceCalendar attendanceRecords={attendanceRecords} />
        )}
      </div>

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={scannerOpen}
        initialMode={scannerMode}
        onClose={() => setScannerOpen(false)}
        onSuccess={() => {
          fetchUserAttendance()
        }}
      />
    </div>
  )
}
