import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { LiveClock } from '../components/LiveClock'
import { AttendanceCalendar } from '../components/AttendanceCalendar'
import { supabase } from '../lib/supabase'
import { Clock, Calendar, CheckCircle, AlertTriangle, TrendingUp, LogIn, LogOut } from 'lucide-react'

export function Dashboard() {
  const { profile } = useAuth()
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalHours: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0
  })

  useEffect(() => {
    if (profile) {
      fetchAttendance()
    }
  }, [profile])

  const fetchAttendance = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', profile.id)
        .order('time_in', { ascending: false })

      if (error) throw error
      setAttendanceRecords(data || [])
      calculateStats(data || [])
    } catch (error) {
      console.error('Error fetching attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (records) => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const monthRecords = records.filter(record => {
      const recordDate = new Date(record.time_in)
      return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear
    })

    // Get unique days
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
          
          // Check if late (after 9 AM)
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
      if (date.getDay() !== 0 && date.getDay() !== 6) { // Exclude weekends
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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold mb-2">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}!
            </h1>
            <p className="text-primary-100 text-lg">Here's your attendance overview</p>
          </div>
          <LiveClock />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.totalHours}h</span>
          </div>
          <p className="text-blue-100 font-medium">Total Hours This Month</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.presentDays}</span>
          </div>
          <p className="text-green-100 font-medium">Days Present</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <AlertTriangle className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.absentDays}</span>
          </div>
          <p className="text-red-100 font-medium">Days Absent</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.lateDays}</span>
          </div>
          <p className="text-yellow-100 font-medium">Late Arrivals</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button className="flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-green-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 shadow-md hover:shadow-lg">
            <LogIn className="w-6 h-6" />
            Time In
          </button>
          <button className="flex items-center justify-center gap-3 bg-gradient-to-r from-red-500 to-red-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-red-600 hover:to-red-700 transition-all transform hover:scale-105 shadow-md hover:shadow-lg">
            <LogOut className="w-6 h-6" />
            Time Out
          </button>
        </div>
      </div>

      {/* Attendance Calendar */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Attendance Calendar</h2>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <AttendanceCalendar attendanceRecords={attendanceRecords} />
        )}
      </div>
    </div>
  )
}
