import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  History as HistoryIcon,
  Calendar,
  Clock,
  AlertCircle,
  Download,
  Search,
  ChevronDown,
  CheckCircle,
  Clock as ClockIcon,
  TrendingUp,
  Sun,
  Sunset,
  User,
  Users,
  Shield,
  FileSpreadsheet,
  MapPin
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { generateDTRPDF } from '../utils/generateDTRPDF'

export function History() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [attendance, setAttendance] = useState([])
  const [staffProfiles, setStaffProfiles] = useState([])
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'completed' | 'in-progress'
  const [sortOrder, setSortOrder] = useState('desc') // 'desc' | 'asc'
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    if (profile) {
      fetchAttendance()
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      setStartDate(firstDay.toISOString().split('T')[0])
      setEndDate(lastDay.toISOString().split('T')[0])
    }
  }, [profile, isAdmin])

  const fetchAttendance = async () => {
    try {
      setLoading(true)

      if (isAdmin) {
        // Fetch all staff profiles
        const { data: profData, error: profErr } = await supabase
          .from('profiles')
          .select('id, full_name, email, role, phone, address')
          .eq('role', 'user')
          .order('full_name', { ascending: true })

        if (profErr) throw profErr
        setStaffProfiles(profData || [])

        // Fetch all attendance records
        const { data: recData, error: recErr } = await supabase
          .from('attendance_records')
          .select('*')
          .order('time_in', { ascending: false })

        if (recErr) throw recErr
        setAttendance(recData || [])
      } else {
        // Fetch current user's attendance records
        const { data, error } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('user_id', profile.id)
          .order('time_in', { ascending: false })

        if (error) throw error
        setAttendance(data || [])
      }
    } catch (error) {
      console.error('Error fetching attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  // Group raw attendance records by calendar date (Morning vs Afternoon)
  const groupedDays = useMemo(() => {
    const groups = {}
    const profileMap = new Map(staffProfiles.map(p => [p.id, p]))

    attendance.forEach((record) => {
      if (!record.time_in) return

      const dateObj = new Date(record.time_in)
      const dateKey = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) // 'YYYY-MM-DD'

      const recordUser = isAdmin ? profileMap.get(record.user_id) : profile
      // Skip if record belongs to an admin
      if (isAdmin && recordUser?.role === 'admin') return

      const groupKey = isAdmin ? `${dateKey}_${record.user_id}` : dateKey

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          user_id: record.user_id,
          user: recordUser || { full_name: 'Unknown Staff', email: '' },
          dateKey,
          dateObj,
          morningRecord: null,
          afternoonRecord: null,
          records: []
        }
      }

      groups[groupKey].records.push(record)

      const hour = parseInt(dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        hour12: false,
        timeZone: 'Asia/Manila'
      }), 10)

      if (hour < 12) {
        if (!groups[groupKey].morningRecord || new Date(record.time_in) < new Date(groups[groupKey].morningRecord.time_in)) {
          groups[groupKey].morningRecord = record
        }
      } else {
        if (!groups[groupKey].afternoonRecord || new Date(record.time_in) < new Date(groups[groupKey].afternoonRecord.time_in)) {
          groups[groupKey].afternoonRecord = record
        }
      }
    })

    return Object.values(groups).map((day) => {
      let morningHours = 0
      let afternoonHours = 0

      if (day.morningRecord?.time_in && day.morningRecord?.time_out) {
        morningHours = (new Date(day.morningRecord.time_out) - new Date(day.morningRecord.time_in)) / (1000 * 60 * 60)
      }

      if (day.afternoonRecord?.time_in && day.afternoonRecord?.time_out) {
        afternoonHours = (new Date(day.afternoonRecord.time_out) - new Date(day.afternoonRecord.time_in)) / (1000 * 60 * 60)
      }

      const totalHours = morningHours + afternoonHours

      const hasOpenSession =
        (day.morningRecord && !day.morningRecord.time_out) ||
        (day.afternoonRecord && !day.afternoonRecord.time_out)

      let status = 'in-progress'
      let statusLabel = 'In Progress'

      if (hasOpenSession) {
        status = 'in-progress'
        statusLabel = 'In Progress'
      } else if (day.morningRecord?.time_out && day.afternoonRecord?.time_out) {
        status = 'completed'
        statusLabel = 'Full Day'
      } else if (day.morningRecord?.time_out && !day.afternoonRecord) {
        status = 'completed'
        statusLabel = 'Morning Only'
      } else if (!day.morningRecord && day.afternoonRecord?.time_out) {
        status = 'completed'
        statusLabel = 'Afternoon Only'
      }

      return {
        ...day,
        morningHours,
        afternoonHours,
        totalHours: totalHours > 0 ? totalHours : 0,
        status,
        statusLabel,
        formattedDate: day.dateObj.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'Asia/Manila'
        })
      }
    })
  }, [attendance, staffProfiles, isAdmin, profile])

  // Filtered and sorted days
  const filteredDays = useMemo(() => {
    let result = [...groupedDays]

    // Admin staff filter
    if (isAdmin && selectedStaffFilter !== 'all') {
      result = result.filter(day => day.user_id === selectedStaffFilter)
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(day => day.status === statusFilter)
    }

    // Search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      result = result.filter(day => {
        const dateMatch = day.formattedDate.toLowerCase().includes(q)
        const staffMatch = isAdmin && (
          day.user?.full_name?.toLowerCase().includes(q) ||
          day.user?.email?.toLowerCase().includes(q) ||
          day.user?.department?.toLowerCase().includes(q) ||
          day.user?.position?.toLowerCase().includes(q)
        )
        return dateMatch || staffMatch
      })
    }

    // Date range filter
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      end.setHours(23, 59, 59)

      result = result.filter(day => {
        return day.dateObj >= start && day.dateObj <= end
      })
    }

    // Sort order
    result.sort((a, b) => {
      const timeA = a.dateObj.getTime()
      const timeB = b.dateObj.getTime()
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA
    })

    return result
  }, [groupedDays, statusFilter, searchTerm, startDate, endDate, sortOrder, isAdmin, selectedStaffFilter])

  // Overview statistics
  const stats = useMemo(() => {
    const totalDays = filteredDays.length
    const totalHours = filteredDays.reduce((acc, d) => acc + d.totalHours, 0)
    const completedDays = filteredDays.filter(d => d.status === 'completed').length
    const attendanceRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0
    const avgDailyHours = totalDays > 0 ? (totalHours / totalDays).toFixed(1) : 0

    return {
      totalDays,
      totalHours: totalHours.toFixed(1),
      attendanceRate,
      avgDailyHours
    }
  }, [filteredDays])

  // DTR PDF Generator
  const handleDownloadDTR = async () => {
    try {
      setGeneratingPDF(true)

      let targetUser = profile

      if (isAdmin) {
        if (selectedStaffFilter === 'all') {
          alert('Please select a specific employee from the "Filter by Staff" dropdown to generate their Civil Service Form 48 (DTR).')
          setGeneratingPDF(false)
          return
        }
        targetUser = staffProfiles.find(p => p.id === selectedStaffFilter)
      }

      if (!targetUser) {
        alert('Employee profile not found.')
        setGeneratingPDF(false)
        return
      }

      const userRecords = attendance.filter(r => r.user_id === targetUser.id)
      const start = new Date(startDate)
      const end = new Date(endDate)
      end.setHours(23, 59, 59)

      const filteredAttendance = userRecords.filter(record => {
        const recordDate = new Date(record.time_in)
        return recordDate >= start && recordDate <= end
      })

      if (filteredAttendance.length === 0) {
        alert(`No attendance records found for ${targetUser.full_name} in the selected date range.`)
        setGeneratingPDF(false)
        return
      }

      generateDTRPDF(targetUser, filteredAttendance, startDate, endDate)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please try again.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  const setPresetRange = (days) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  const handleExportCSV = () => {
    if (filteredDays.length === 0) {
      alert('No attendance records to export.')
      return
    }

    const headers = [
      'Employee Name',
      'Email',
      'Department',
      'Position',
      'Date',
      'Morning In',
      'Morning In Location',
      'Morning Out',
      'Morning Out Location',
      'Afternoon In',
      'Afternoon In Location',
      'Afternoon Out',
      'Afternoon Out Location',
      'Morning Hours',
      'Afternoon Hours',
      'Total Hours',
      'Status'
    ]

    const rows = filteredDays.map(day => {
      const amInLoc = day.morningRecord?.time_in_location || (day.morningRecord?.time_in_latitude ? `${day.morningRecord.time_in_latitude}, ${day.morningRecord.time_in_longitude}` : '')
      const amOutLoc = day.morningRecord?.time_out_location || (day.morningRecord?.time_out_latitude ? `${day.morningRecord.time_out_latitude}, ${day.morningRecord.time_out_longitude}` : '')
      const pmInLoc = day.afternoonRecord?.time_in_location || (day.afternoonRecord?.time_in_latitude ? `${day.afternoonRecord.time_in_latitude}, ${day.afternoonRecord.time_in_longitude}` : '')
      const pmOutLoc = day.afternoonRecord?.time_out_location || (day.afternoonRecord?.time_out_latitude ? `${day.afternoonRecord.time_out_latitude}, ${day.afternoonRecord.time_out_longitude}` : '')

      return [
        `"${(day.user?.full_name || 'Staff').replace(/"/g, '""')}"`,
        `"${(day.user?.email || '').replace(/"/g, '""')}"`,
        `"${(day.user?.department || 'N/A').replace(/"/g, '""')}"`,
        `"${(day.user?.position || 'N/A').replace(/"/g, '""')}"`,
        `"${day.formattedDate || day.dateKey || ''}"`,
        `"${formatTime(day.morningRecord?.time_in)}"`,
        `"${amInLoc.replace(/"/g, '""')}"`,
        `"${formatTime(day.morningRecord?.time_out)}"`,
        `"${amOutLoc.replace(/"/g, '""')}"`,
        `"${formatTime(day.afternoonRecord?.time_in)}"`,
        `"${pmInLoc.replace(/"/g, '""')}"`,
        `"${formatTime(day.afternoonRecord?.time_out)}"`,
        `"${pmOutLoc.replace(/"/g, '""')}"`,
        (day.morningHours || 0).toFixed(2),
        (day.afternoonHours || 0).toFixed(2),
        (day.totalHours || 0).toFixed(2),
        `"${day.statusLabel || day.status || ''}"`
      ]
    })

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const fileSuffix = startDate && endDate ? `${startDate}_to_${endDate}` : new Date().toISOString().split('T')[0]
    link.download = `attendance_export_${fileSuffix}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const formatTime = (dateString) => {
    if (!dateString) return '--:--'
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila'
    })
  }

  const renderTimeWithLocation = (timeStr, record, isTimeIn = true) => {
    if (!timeStr) return <span className="text-gray-400">--:--</span>

    const locName = isTimeIn ? record?.time_in_location : record?.time_out_location
    const lat = isTimeIn ? record?.time_in_latitude : record?.time_out_latitude
    const lng = isTimeIn ? record?.time_in_longitude : record?.time_out_longitude
    const hasCoords = lat !== null && lat !== undefined && lng !== null && lng !== undefined
    const displayLoc = locName || (hasCoords ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : null)

    return (
      <div className="flex flex-col items-center">
        <span className={isTimeIn ? 'text-emerald-700 font-bold' : 'text-blue-700 font-bold'}>
          {formatTime(timeStr)}
        </span>
        {displayLoc && (
          hasCoords ? (
            <a
              href={`https://www.google.com/maps?q=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 mt-1 text-[10px] text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded transition-colors max-w-[130px] truncate shadow-2xs font-normal"
              title={`${displayLoc} (Click to open map)`}
              onClick={(e) => e.stopPropagation()}
            >
              <MapPin className="w-2.5 h-2.5 flex-shrink-0 text-emerald-600" />
              <span className="truncate">{displayLoc}</span>
            </a>
          ) : (
            <span
              className="inline-flex items-center gap-0.5 mt-1 text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded max-w-[130px] truncate font-normal"
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

  const getDayStatusBadge = (day) => {
    if (day.status === 'in-progress') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200">
          <ClockIcon className="w-3 h-3" /> In Progress
        </span>
      )
    }
    if (day.statusLabel === 'Full Day') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200">
          <CheckCircle className="w-3 h-3" /> Full Day
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold text-purple-800 bg-purple-50 border border-purple-200">
        <CheckCircle className="w-3 h-3" /> {day.statusLabel}
      </span>
    )
  }

  const paginatedData = filteredDays.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const totalPages = Math.ceil(filteredDays.length / itemsPerPage)

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">
              <Shield size={12} /> Admin Mode
            </span>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mt-1">
          {isAdmin ? 'Staff Attendance History' : 'My Attendance History'}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          {isAdmin
            ? 'Overall municipality staff attendance records with Morning (AM) and Afternoon (PM) sessions'
            : 'Daily Morning & Afternoon attendance records with Philippine Standard Time'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-5 sm:p-6 text-white shadow-md">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <Calendar className="w-7 h-7 sm:w-8 sm:h-8 opacity-80" />
            <span className="text-2xl sm:text-3xl font-bold">{stats.totalDays}</span>
          </div>
          <p className="text-blue-100 text-xs sm:text-sm font-medium">
            {isAdmin ? 'Total Daily Records' : 'Logged Days'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-5 sm:p-6 text-white shadow-md">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <Clock className="w-7 h-7 sm:w-8 sm:h-8 opacity-80" />
            <span className="text-2xl sm:text-3xl font-bold">{stats.totalHours}h</span>
          </div>
          <p className="text-purple-100 text-xs sm:text-sm font-medium">Total Hours Logged</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-5 sm:p-6 text-white shadow-md">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 opacity-80" />
            <span className="text-2xl sm:text-3xl font-bold">{stats.attendanceRate}%</span>
          </div>
          <p className="text-emerald-100 text-xs sm:text-sm font-medium">Completion Rate</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-5 sm:p-6 text-white shadow-md">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <TrendingUp className="w-7 h-7 sm:w-8 sm:h-8 opacity-80" />
            <span className="text-2xl sm:text-3xl font-bold">{stats.avgDailyHours}h</span>
          </div>
          <p className="text-amber-100 text-xs sm:text-sm font-medium">Avg Hours Per Day</p>
        </div>
      </div>

      {/* Download DTR Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 tracking-tight">
          Download DTR Form 48 (Civil Service Standard)
        </h2>
        <div className="flex flex-wrap gap-4 items-end">
          {/* Admin Employee Selector */}
          {isAdmin && (
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Select Staff for DTR
              </label>
              <select
                value={selectedStaffFilter}
                onChange={(e) => {
                  setSelectedStaffFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3.5 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm font-medium"
              >
                <option value="all">-- Select an Employee to Generate DTR --</option>
                {staffProfiles.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.full_name} ({staff.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
          </div>

          <button
            onClick={handleDownloadDTR}
            disabled={generatingPDF || !startDate || !endDate}
            className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-md font-bold text-xs sm:text-sm hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Download className="w-4 h-4" />
            {generatingPDF ? 'Generating...' : 'DOWNLOAD DTR (PDF)'}
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredDays.length === 0}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-md font-bold text-xs sm:text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            title="Export all filtered attendance records to CSV/Excel format"
          >
            <FileSpreadsheet className="w-4 h-4" />
            EXPORT ALL (CSV)
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-wrap gap-3 flex-1 w-full">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={isAdmin ? "Search by staff name or date..." : "Search by date (e.g. Nov 21)..."}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-9 pr-3.5 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Filter by Staff (Admin only) */}
            {isAdmin && (
              <select
                value={selectedStaffFilter}
                onChange={(e) => {
                  setSelectedStaffFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-3.5 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm font-medium"
              >
                <option value="all">All Staff Members ({staffProfiles.length})</option>
                {staffProfiles.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.full_name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="px-3.5 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="in-progress">In Progress</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
              {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setPresetRange(7)} className="px-3 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">This Week</button>
            <button onClick={() => setPresetRange(30)} className="px-3 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">This Month</button>
            <button onClick={() => setPresetRange(90)} className="px-3 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">Last 3 Months</button>
          </div>
        </div>
      </div>

      {/* Main Records Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Showing {filteredDays.length} attendance record{filteredDays.length !== 1 ? 's' : ''}
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : filteredDays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <AlertCircle className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg font-medium">No attendance records found</p>
            <p className="text-sm mt-2">
              {isAdmin
                ? 'Try adjusting your date range or staff filter'
                : 'Try adjusting your filters or scan your QR code to record attendance'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-primary-600 to-primary-700 text-white text-xs">
                    {isAdmin && (
                      <th className="py-3.5 px-4 font-bold text-left rounded-tl-lg" rowSpan={2}>
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4" /> Staff Member
                        </div>
                      </th>
                    )}
                    <th className={`py-3.5 px-4 font-bold text-left ${!isAdmin ? 'rounded-tl-lg' : 'border-l border-white/20'}`} rowSpan={2}>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" /> Date
                      </div>
                    </th>
                    <th className="py-2.5 px-3 font-bold text-center border-l border-white/20" colSpan={2}>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/20 uppercase tracking-wider text-[10px]">
                        <Sun className="w-3 h-3 text-amber-300" /> Morning (AM)
                      </span>
                    </th>
                    <th className="py-2.5 px-3 font-bold text-center border-l border-white/20" colSpan={2}>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/20 uppercase tracking-wider text-[10px]">
                        <Sunset className="w-3 h-3 text-orange-300" /> Afternoon (PM)
                      </span>
                    </th>
                    <th className="py-3.5 px-4 font-bold text-center border-l border-white/20" rowSpan={2}>
                      Total Hours
                    </th>
                    <th className="py-3.5 px-4 font-bold text-center border-l border-white/20 rounded-tr-lg" rowSpan={2}>
                      Status
                    </th>
                  </tr>
                  <tr className="bg-primary-800 text-white/90 text-[11px] font-semibold border-t border-primary-600/40">
                    <th className="py-1.5 px-3 text-center border-l border-primary-700/50">Time In</th>
                    <th className="py-1.5 px-3 text-center border-l border-primary-700/50">Time Out</th>
                    <th className="py-1.5 px-3 text-center border-l border-primary-700/50">Time In</th>
                    <th className="py-1.5 px-3 text-center border-l border-primary-700/50">Time Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {paginatedData.map((day, index) => (
                    <tr
                      key={day.groupKey || `${day.dateKey}_${day.user_id}`}
                      className="hover:bg-gray-50 transition-colors animate-slide-up"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      {/* Admin Staff Column */}
                      {isAdmin && (
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-xs flex-shrink-0">
                              {day.user?.full_name ? day.user.full_name[0].toUpperCase() : 'U'}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 leading-tight">
                                {day.user?.full_name || 'Staff Member'}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
                                {day.user?.department && (
                                  <span className="font-semibold text-primary-700 bg-primary-50 px-1.5 py-0.2 rounded border border-primary-200/60">
                                    {day.user.department}
                                  </span>
                                )}
                                {day.user?.position && (
                                  <span className="text-gray-600 font-medium">
                                    • {day.user.position}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      )}

                      <td className="py-3.5 px-4 text-gray-900 font-semibold whitespace-nowrap">
                        {day.formattedDate}
                      </td>

                      {/* Morning AM */}
                      <td className="py-3.5 px-3 text-center text-gray-700 font-medium border-l border-gray-100 bg-amber-50/20">
                        {renderTimeWithLocation(day.morningRecord?.time_in, day.morningRecord, true)}
                      </td>
                      <td className="py-3.5 px-3 text-center text-gray-700 font-medium border-l border-gray-100 bg-amber-50/20">
                        {renderTimeWithLocation(day.morningRecord?.time_out, day.morningRecord, false)}
                      </td>

                      {/* Afternoon PM */}
                      <td className="py-3.5 px-3 text-center text-gray-700 font-medium border-l border-gray-100 bg-blue-50/20">
                        {renderTimeWithLocation(day.afternoonRecord?.time_in, day.afternoonRecord, true)}
                      </td>
                      <td className="py-3.5 px-3 text-center text-gray-700 font-medium border-l border-gray-100 bg-blue-50/20">
                        {renderTimeWithLocation(day.afternoonRecord?.time_out, day.afternoonRecord, false)}
                      </td>

                      {/* Hours */}
                      <td className="py-3.5 px-4 text-center font-bold text-gray-900 border-l border-gray-100">
                        {day.totalHours > 0 ? `${day.totalHours.toFixed(1)}h` : '--'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center border-l border-gray-100">
                        {getDayStatusBadge(day)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-3">
              {paginatedData.map((day, index) => (
                <div
                  key={day.groupKey || `${day.dateKey}_${day.user_id}`}
                  className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-3 animate-slide-up"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  {isAdmin && (
                    <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
                      <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-xs flex-shrink-0">
                        {day.user?.full_name ? day.user.full_name[0].toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-xs truncate">
                          {day.user?.full_name || 'Staff Member'}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">
                          {day.user?.department ? `${day.user.department} • ` : ''}{day.user?.position || day.user?.email}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary-600" />
                      <span className="font-bold text-gray-900 text-xs sm:text-sm">{day.formattedDate}</span>
                    </div>
                    {getDayStatusBadge(day)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Morning Box */}
                    <div className="bg-amber-50/60 border border-amber-200/60 rounded-md p-2.5">
                      <div className="flex items-center gap-1 text-amber-800 font-bold mb-1.5 text-[10px] uppercase tracking-wider">
                        <Sun className="w-3.5 h-3.5 text-amber-600" /> Morning (AM)
                      </div>
                      <div className="space-y-1.5 text-gray-700 text-[11px]">
                        <div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">In:</span>
                            <span className="font-bold text-gray-900">{formatTime(day.morningRecord?.time_in)}</span>
                          </div>
                          {(day.morningRecord?.time_in_location || day.morningRecord?.time_in_latitude) && (
                            <p className="text-[10px] text-emerald-700 flex items-center gap-0.5 truncate mt-0.5" title={day.morningRecord.time_in_location}>
                              <MapPin size={10} className="flex-shrink-0" />
                              <span className="truncate">{day.morningRecord.time_in_location || `${day.morningRecord.time_in_latitude}, ${day.morningRecord.time_in_longitude}`}</span>
                            </p>
                          )}
                        </div>
                        <div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">Out:</span>
                            <span className="font-bold text-gray-900">{formatTime(day.morningRecord?.time_out)}</span>
                          </div>
                          {(day.morningRecord?.time_out_location || day.morningRecord?.time_out_latitude) && (
                            <p className="text-[10px] text-blue-700 flex items-center gap-0.5 truncate mt-0.5" title={day.morningRecord.time_out_location}>
                              <MapPin size={10} className="flex-shrink-0" />
                              <span className="truncate">{day.morningRecord.time_out_location || `${day.morningRecord.time_out_latitude}, ${day.morningRecord.time_out_longitude}`}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Afternoon Box */}
                    <div className="bg-blue-50/60 border border-blue-200/60 rounded-md p-2.5">
                      <div className="flex items-center gap-1 text-blue-800 font-bold mb-1.5 text-[10px] uppercase tracking-wider">
                        <Sunset className="w-3.5 h-3.5 text-blue-600" /> Afternoon (PM)
                      </div>
                      <div className="space-y-1.5 text-gray-700 text-[11px]">
                        <div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">In:</span>
                            <span className="font-bold text-gray-900">{formatTime(day.afternoonRecord?.time_in)}</span>
                          </div>
                          {(day.afternoonRecord?.time_in_location || day.afternoonRecord?.time_in_latitude) && (
                            <p className="text-[10px] text-emerald-700 flex items-center gap-0.5 truncate mt-0.5" title={day.afternoonRecord.time_in_location}>
                              <MapPin size={10} className="flex-shrink-0" />
                              <span className="truncate">{day.afternoonRecord.time_in_location || `${day.afternoonRecord.time_in_latitude}, ${day.afternoonRecord.time_in_longitude}`}</span>
                            </p>
                          )}
                        </div>
                        <div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">Out:</span>
                            <span className="font-bold text-gray-900">{formatTime(day.afternoonRecord?.time_out)}</span>
                          </div>
                          {(day.afternoonRecord?.time_out_location || day.afternoonRecord?.time_out_latitude) && (
                            <p className="text-[10px] text-blue-700 flex items-center gap-0.5 truncate mt-0.5" title={day.afternoonRecord.time_out_location}>
                              <MapPin size={10} className="flex-shrink-0" />
                              <span className="truncate">{day.afternoonRecord.time_out_location || `${day.afternoonRecord.time_out_latitude}, ${day.afternoonRecord.time_out_longitude}`}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs text-gray-500">
                    <span>Duration:</span>
                    <span className="font-bold text-primary-700">
                      {day.totalHours > 0 ? `${day.totalHours.toFixed(1)} hrs` : '--'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                <p className="text-xs sm:text-sm text-gray-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredDays.length)} of {filteredDays.length} records
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3.5 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3.5 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
