import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { generateDTRPDF } from '../utils/generateDTRPDF'
import {
  Users, Search, User, Mail, Calendar, Clock, Download,
  CheckCircle, AlertCircle, TrendingUp, FileText, Building2,
  Phone, ArrowLeft, Clock as ClockIcon
} from 'lucide-react'

export function Admin() {
  const { profile: adminProfile } = useAuth()
  const [employees, setEmployees] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState(null)

  const [employeeRecords, setEmployeeRecords] = useState([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeRecords(selectedEmployee.id)
    }
  }, [selectedEmployee])

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true })

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Error fetching employees:', error)
    } finally {
      setLoadingEmployees(false)
    }
  }

  const fetchEmployeeRecords = async (userId) => {
    try {
      setLoadingRecords(true)
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', userId)
        .order('time_in', { ascending: false })

      if (error) throw error
      setEmployeeRecords(data || [])
      setCurrentPage(1)
    } catch (error) {
      console.error('Error fetching employee records:', error)
    } finally {
      setLoadingRecords(false)
    }
  }

  const filteredEmployees = employees.filter(emp => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      emp.full_name?.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term) ||
      emp.department?.toLowerCase().includes(term) ||
      emp.position?.toLowerCase().includes(term)
    )
  })

  const filteredRecords = employeeRecords.filter(record => {
    if (!startDate && !endDate) return true
    const recordDate = new Date(record.time_in)
    const start = startDate ? new Date(startDate) : null
    const end = endDate ? new Date(endDate) : null
    if (end) end.setHours(23, 59, 59)
    if (start && recordDate < start) return false
    if (end && recordDate > end) return false
    return true
  })

  const handleDownloadDTR = () => {
    if (!selectedEmployee) return
    if (!startDate || !endDate) {
      alert('Please select start and end dates')
      return
    }
    if (filteredRecords.length === 0) {
      alert('No attendance records found for the selected date range')
      return
    }
    setGeneratingPDF(true)
    try {
      generateDTRPDF(selectedEmployee, filteredRecords, startDate, endDate)
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

  const recordStats = {
    totalRecords: filteredRecords.length,
    totalHours: filteredRecords.reduce((sum, record) => {
      if (record.time_in && record.time_out) {
        return sum + (new Date(record.time_out) - new Date(record.time_in)) / (1000 * 60 * 60)
      }
      return sum
    }, 0).toFixed(1),
    completed: filteredRecords.filter(r => r.time_out).length
  }

  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage)

  // Employee detail view
  if (selectedEmployee) {
    return (
      <div className="space-y-8 animate-fade-in">
        {/* Employee Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-8 text-white shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedEmployee(null)}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
                {selectedEmployee.profile_picture ? (
                  <img
                    src={selectedEmployee.profile_picture}
                    alt="Profile"
                    className="w-14 h-14 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-primary-600" />
                )}
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold">{selectedEmployee.full_name}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-primary-100 text-sm">
                  {selectedEmployee.position && <span>{selectedEmployee.position}</span>}
                  {selectedEmployee.department && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" /> {selectedEmployee.department}
                    </span>
                  )}
                  {selectedEmployee.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" /> {selectedEmployee.phone}
                    </span>
                  )}
                </div>
                <p className="text-primary-100 text-sm mt-1 flex items-center gap-1">
                  <Mail className="w-4 h-4" /> {selectedEmployee.email}
                </p>
              </div>
            </div>
            <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-sm capitalize self-start sm:self-auto">
              {selectedEmployee.role}
            </span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <FileText className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">{recordStats.totalRecords}</span>
            </div>
            <p className="text-blue-100 font-medium">Total Records</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Clock className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">{recordStats.totalHours}h</span>
            </div>
            <p className="text-purple-100 font-medium">Total Hours</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">{recordStats.completed}</span>
            </div>
            <p className="text-green-100 font-medium">Completed Days</p>
          </div>
        </div>

        {/* Date Filters + DTR */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Attendance Records</h2>
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
              disabled={generatingPDF}
              className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              {generatingPDF ? 'Generating...' : 'Download DTR'}
            </button>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setPresetRange(7)} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">This Week</button>
            <button onClick={() => setPresetRange(30)} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">This Month</button>
            <button onClick={() => { setStartDate(''); setEndDate('') }} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">All Records</button>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Showing {filteredRecords.length} records
              </h2>
            </div>
          </div>

          {loadingRecords ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <AlertCircle className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium">No attendance records found</p>
              <p className="text-sm mt-2">This employee has no time in/out records for the selected period</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-primary-600 to-primary-700 text-white">
                      <th className="text-left py-4 px-4 font-semibold rounded-tl-lg">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" /> Date
                        </div>
                      </th>
                      <th className="text-left py-4 px-4 font-semibold">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" /> Time In
                        </div>
                      </th>
                      <th className="text-left py-4 px-4 font-semibold">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" /> Time Out
                        </div>
                      </th>
                      <th className="text-left py-4 px-4 font-semibold">
                        Hours
                      </th>
                      <th className="text-left py-4 px-4 font-semibold rounded-tr-lg">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.map((record) => {
                      const hours = record.time_in && record.time_out
                        ? ((new Date(record.time_out) - new Date(record.time_in)) / (1000 * 60 * 60)).toFixed(2)
                        : null
                      return (
                        <tr
                          key={record.id}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          <td className="py-4 px-4 text-gray-900 font-medium">{formatDate(record.time_in)}</td>
                          <td className="py-4 px-4 text-gray-900">{formatTime(record.time_in)}</td>
                          <td className="py-4 px-4 text-gray-900">{formatTime(record.time_out)}</td>
                          <td className="py-4 px-4 text-gray-900">{hours ? `${hours}h` : '--'}</td>
                          <td className="py-4 px-4">{getStatusBadge(record)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredRecords.length)} of {filteredRecords.length} records
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

  // Employee list view
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Employee Management</h1>
        <p className="text-gray-600 mt-1">Oversee all employees and their attendance records</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{employees.length}</span>
          </div>
          <p className="text-blue-100 font-medium">Total Employees</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{employees.filter(e => e.role === 'user').length}</span>
          </div>
          <p className="text-green-100 font-medium">Regular Employees</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{employees.filter(e => e.role === 'scanner').length}</span>
          </div>
          <p className="text-purple-100 font-medium">Scanners</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <User className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{employees.filter(e => e.role === 'admin').length}</span>
          </div>
          <p className="text-yellow-100 font-medium">Admins</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees by name, email, department, or position..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Showing {filteredEmployees.length} of {employees.length} employees
            </h2>
          </div>
        </div>

        {loadingEmployees ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <AlertCircle className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg font-medium">No employees found</p>
            <p className="text-sm mt-2">Try adjusting your search terms</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-primary-600 to-primary-700 text-white">
                  <th className="text-left py-4 px-4 font-semibold rounded-tl-lg">Employee</th>
                  <th className="text-left py-4 px-4 font-semibold">Department / Position</th>
                  <th className="text-left py-4 px-4 font-semibold">Contact</th>
                  <th className="text-left py-4 px-4 font-semibold">Role</th>
                  <th className="text-left py-4 px-4 font-semibold rounded-tr-lg">Joined</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className="border-b border-gray-100 hover:bg-primary-50 cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {emp.profile_picture ? (
                          <img
                            src={emp.profile_picture}
                            alt="Profile"
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-primary-600" />
                          </div>
                        )}
                        <span className="text-gray-900 font-medium">{emp.full_name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-gray-900">{emp.department || 'N/A'}</p>
                      <p className="text-sm text-gray-500">{emp.position || 'N/A'}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-gray-900 flex items-center gap-1 text-sm">
                        <Mail className="w-3.5 h-3.5 text-gray-400" /> {emp.email}
                      </p>
                      {emp.phone && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Phone className="w-3.5 h-3.5 text-gray-400" /> {emp.phone}
                        </p>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium capitalize ${
                        emp.role === 'admin'
                          ? 'bg-yellow-50 text-yellow-700'
                          : emp.role === 'scanner'
                            ? 'bg-purple-50 text-purple-700'
                            : 'bg-blue-50 text-blue-700'
                      }`}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-gray-600 text-sm">
                      {emp.created_at
                        ? new Date(emp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
