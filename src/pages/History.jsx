import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { History as HistoryIcon, Calendar, Clock, AlertCircle, Download, Search, Filter, ChevronDown, CheckCircle, Clock as ClockIcon, TrendingUp, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { generateDTRPDF } from '../utils/generateDTRPDF'

export function History() {
  const { profile } = useAuth()
  const [attendance, setAttendance] = useState([])
  const [filteredAttendance, setFilteredAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const stats = {
    totalRecords: attendance.length,
    totalHours: attendance.reduce((sum, record) => {
      if (record.time_in && record.time_out) {
        const inTime = new Date(record.time_in)
        const outTime = new Date(record.time_out)
        return sum + (outTime - inTime) / (1000 * 60 * 60)
      }
      return sum
    }, 0).toFixed(1),
    attendanceRate: attendance.length > 0 
      ? ((attendance.filter(r => r.time_out).length / attendance.length) * 100).toFixed(0)
      : 0,
    avgDailyHours: attendance.length > 0
      ? (attendance.reduce((sum, record) => {
          if (record.time_in && record.time_out) {
            const inTime = new Date(record.time_in)
            const outTime = new Date(record.time_out)
            return sum + (outTime - inTime) / (1000 * 60 * 60)
          }
          return sum
        }, 0) / attendance.length).toFixed(1)
      : 0
  }

  useEffect(() => {
    if (profile) {
      fetchAttendance()
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      setStartDate(firstDay.toISOString().split('T')[0])
      setEndDate(lastDay.toISOString().split('T')[0])
    }
  }, [profile])

  useEffect(() => {
    filterAndSortAttendance()
  }, [attendance, searchTerm, statusFilter, sortBy, sortOrder])

  const fetchAttendance = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', profile.id)
        .order('time_in', { ascending: false })

      if (error) throw error
      setAttendance(data || [])
    } catch (error) {
      console.error('Error fetching attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterAndSortAttendance = () => {
    let filtered = [...attendance]

    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'completed') {
        filtered = filtered.filter(r => r.time_out)
      } else if (statusFilter === 'in-progress') {
        filtered = filtered.filter(r => !r.time_out)
      }
    }

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(record => {
        const dateStr = new Date(record.time_in).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric'
        }).toLowerCase()
        return dateStr.includes(term)
      })
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'date') {
        comparison = new Date(a.time_in) - new Date(b.time_in)
      } else if (sortBy === 'time-in') {
        comparison = new Date(a.time_in) - new Date(b.time_in)
      } else if (sortBy === 'time-out') {
        comparison = new Date(a.time_out || 0) - new Date(b.time_out || 0)
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    setFilteredAttendance(filtered)
    setCurrentPage(1)
  }

  const handleDownloadDTR = async () => {
    if (!startDate || !endDate) {
      alert('Please select start and end dates')
      return
    }

    setGeneratingPDF(true)
    try {
      const filteredAttendance = attendance.filter(record => {
        const recordDate = new Date(record.time_in)
        const start = new Date(startDate)
        const end = new Date(endDate)
        end.setHours(23, 59, 59)
        return recordDate >= start && recordDate <= end
      })

      if (filteredAttendance.length === 0) {
        alert('No attendance records found for the selected date range')
        setGeneratingPDF(false)
        return
      }

      generateDTRPDF(profile, filteredAttendance, startDate, endDate)
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

  const formatTime = (dateString) => {
    if (!dateString) return '--:--'
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila'
    })
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Manila'
    })
  }

  const getStatusBadge = (record) => {
    if (record.time_out) {
      const hour = new Date(record.time_in).getHours()
      const isLate = hour >= 9
      return (
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
          isLate ? 'text-yellow-700 bg-yellow-50' : 'text-green-700 bg-green-50'
        }`}>
          {isLate ? <TrendingUp className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
          {isLate ? 'Late' : 'Completed'}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium text-blue-700 bg-blue-50">
        <ClockIcon className="w-3 h-3" />
        In Progress
      </span>
    )
  }

  const paginatedData = filteredAttendance.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const totalPages = Math.ceil(filteredAttendance.length / itemsPerPage)

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Attendance History</h1>
        <p className="text-gray-600 mt-1">View all your attendance records</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <FileText className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.totalRecords}</span>
          </div>
          <p className="text-blue-100 font-medium">Total Records</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.totalHours}h</span>
          </div>
          <p className="text-purple-100 font-medium">Total Hours</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.attendanceRate}%</span>
          </div>
          <p className="text-green-100 font-medium">Attendance Rate</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.avgDailyHours}h</span>
          </div>
          <p className="text-orange-100 font-medium">Avg Daily Hours</p>
        </div>
      </div>

      {/* Download DTR Section */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Download DTR Form 48</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleDownloadDTR}
            disabled={generatingPDF || !startDate || !endDate}
            className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            {generatingPDF ? 'Generating...' : 'Download DTR'}
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-wrap gap-4 flex-1">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by date..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="in-progress">In Progress</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="date">Sort by Date</option>
              <option value="time-in">Sort by Time In</option>
              <option value="time-out">Sort by Time Out</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronDown className={`w-5 h-5 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
              {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setPresetRange(7)} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">This Week</button>
            <button onClick={() => setPresetRange(30)} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">This Month</button>
            <button onClick={() => setPresetRange(90)} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Last 3 Months</button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Showing {filteredAttendance.length} records
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : filteredAttendance.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <AlertCircle className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg font-medium">No attendance records found</p>
            <p className="text-sm mt-2">Try adjusting your filters or scan your QR code to start tracking attendance</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-primary-600 to-primary-700 text-white">
                    <th className="text-left py-4 px-4 font-semibold rounded-tl-lg">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Date
                      </div>
                    </th>
                    <th className="text-left py-4 px-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Time In
                      </div>
                    </th>
                    <th className="text-left py-4 px-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Time Out
                      </div>
                    </th>
                    <th className="text-left py-4 px-4 font-semibold rounded-tr-lg">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((record, index) => (
                    <tr 
                      key={record.id} 
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors animate-slide-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="py-4 px-4 text-gray-900 font-medium">{formatDate(record.time_in)}</td>
                      <td className="py-4 px-4 text-gray-900">{formatTime(record.time_in)}</td>
                      <td className="py-4 px-4 text-gray-900">{formatTime(record.time_out)}</td>
                      <td className="py-4 px-4">{getStatusBadge(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAttendance.length)} of {filteredAttendance.length} records
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        currentPage === i + 1
                          ? 'bg-primary-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
