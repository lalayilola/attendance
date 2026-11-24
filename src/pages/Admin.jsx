import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { generateDTRPDF } from '../utils/generateDTRPDF'
import {
  Users, Search, User, Mail, Calendar, Clock, Download,
  CheckCircle, AlertCircle, TrendingUp, FileText, Building2,
  Phone, ArrowLeft, Clock as ClockIcon, UserCheck, Hourglass,
  Sun, Sunset, Trash2, Edit3, FileSpreadsheet, X, CheckSquare, Square,
  MapPin
} from 'lucide-react'

export function Admin() {
  const { profile: adminProfile } = useAuth()
  const [employees, setEmployees] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])

  // Quick edit Department / Position modal
  const [editingEmp, setEditingEmp] = useState(null)
  const [editDept, setEditDept] = useState('')
  const [editPos, setEditPos] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

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

  const approveEmployee = async (emp, e) => {
    e.stopPropagation()
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'approved' })
        .eq('id', emp.id)
      if (error) throw error
      setEmployees(prev => prev.map(p => p.id === emp.id ? { ...p, status: 'approved' } : p))
      if (selectedEmployee?.id === emp.id) {
        setSelectedEmployee(prev => ({ ...prev, status: 'approved' }))
      }
    } catch (error) {
      console.error('Error approving employee:', error)
      alert('Failed to approve employee. Please try again.')
    }
  }

  const rejectOrDeleteEmployee = async (emp, e) => {
    if (e) e.stopPropagation()
    const isPending = emp.status !== 'approved'
    const confirmMsg = isPending
      ? `Reject and delete pending registration for "${emp.full_name}"?`
      : `Delete employee account for "${emp.full_name}"? All associated attendance records will also be deleted.`

    if (!window.confirm(confirmMsg)) return

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', emp.id)

      if (error) throw error

      setEmployees(prev => prev.filter(p => p.id !== emp.id))
      setSelectedIds(prev => prev.filter(id => id !== emp.id))
      if (selectedEmployee?.id === emp.id) {
        setSelectedEmployee(null)
      }
    } catch (error) {
      console.error('Error deleting employee:', error)
      alert('Failed to delete employee: ' + (error.message || 'Unknown error'))
    }
  }

  const toggleSelect = (id, e) => {
    if (e) e.stopPropagation()
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    const visibleIds = filteredEmployees.map(e => e.id)
    const allSelected = visibleIds.every(id => selectedIds.includes(id))
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)))
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return
    const pendingCount = employees.filter(e => selectedIds.includes(e.id) && e.status !== 'approved').length
    const count = selectedIds.length
    if (!window.confirm(`Approve ${count} selected employee account${count > 1 ? 's' : ''}?`)) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'approved' })
        .in('id', selectedIds)

      if (error) throw error

      setEmployees(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, status: 'approved' } : p))
      setSelectedIds([])
      alert(`Successfully approved ${count} account${count > 1 ? 's' : ''}.`)
    } catch (error) {
      console.error('Bulk approve error:', error)
      alert('Failed to bulk approve: ' + (error.message || 'Unknown error'))
    }
  }

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return
    const count = selectedIds.length
    if (!window.confirm(`Reject and delete ${count} selected account${count > 1 ? 's' : ''}? This action cannot be undone.`)) return

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .in('id', selectedIds)

      if (error) throw error

      setEmployees(prev => prev.filter(p => !selectedIds.includes(p.id)))
      setSelectedIds([])
      if (selectedEmployee && selectedIds.includes(selectedEmployee.id)) {
        setSelectedEmployee(null)
      }
      alert(`Successfully removed ${count} account${count > 1 ? 's' : ''}.`)
    } catch (error) {
      console.error('Bulk delete error:', error)
      alert('Failed to bulk delete: ' + (error.message || 'Unknown error'))
    }
  }

  const openEditModal = (emp, e) => {
    if (e) e.stopPropagation()
    setEditingEmp(emp)
    setEditDept(emp.department || '')
    setEditPos(emp.position || '')
  }

  const handleSaveEmpEdit = async (e) => {
    e.preventDefault()
    if (!editingEmp) return
    setSavingEdit(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          department: editDept.trim(),
          position: editPos.trim()
        })
        .eq('id', editingEmp.id)

      if (error) throw error

      setEmployees(prev => prev.map(p => p.id === editingEmp.id ? { ...p, department: editDept.trim(), position: editPos.trim() } : p))
      if (selectedEmployee?.id === editingEmp.id) {
        setSelectedEmployee(prev => ({ ...prev, department: editDept.trim(), position: editPos.trim() }))
      }
      setEditingEmp(null)
    } catch (error) {
      console.error('Error saving department/position:', error)
      alert('Failed to update: ' + (error.message || 'Please make sure columns exist in database.'))
    } finally {
      setSavingEdit(false)
    }
  }

  const exportEmployeesToCSV = () => {
    const headers = ['Full Name', 'Email', 'Department', 'Position', 'Role', 'Status', 'Phone', 'Address', 'Joined Date']
    const rows = employees.map(e => [
      `"${(e.full_name || '').replace(/"/g, '""')}"`,
      `"${(e.email || '').replace(/"/g, '""')}"`,
      `"${(e.department || '').replace(/"/g, '""')}"`,
      `"${(e.position || '').replace(/"/g, '""')}"`,
      `"${e.role || 'user'}"`,
      `"${e.status || 'pending'}"`,
      `"${(e.phone || '').replace(/"/g, '""')}"`,
      `"${(e.address || '').replace(/"/g, '""')}"`,
      `"${e.created_at ? new Date(e.created_at).toLocaleDateString() : ''}"`
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `employees_directory_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportEmployeeAttendanceCSV = () => {
    if (!selectedEmployee) return
    const headers = [
      'Employee Name',
      'Department',
      'Position',
      'Date',
      'Time In',
      'Time In Location',
      'Time Out',
      'Time Out Location',
      'Hours Worked',
      'Status'
    ]
    const rows = filteredRecords.map(r => {
      const inTime = r.time_in ? new Date(r.time_in) : null
      const outTime = r.time_out ? new Date(r.time_out) : null
      const hours = inTime && outTime ? ((outTime - inTime) / (1000 * 60 * 60)).toFixed(2) : '0.00'
      const inLoc = r.time_in_location || (r.time_in_latitude ? `${r.time_in_latitude}, ${r.time_in_longitude}` : '')
      const outLoc = r.time_out_location || (r.time_out_latitude ? `${r.time_out_latitude}, ${r.time_out_longitude}` : '')
      return [
        `"${selectedEmployee.full_name.replace(/"/g, '""')}"`,
        `"${(selectedEmployee.department || 'N/A').replace(/"/g, '""')}"`,
        `"${(selectedEmployee.position || 'N/A').replace(/"/g, '""')}"`,
        `"${inTime ? inTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) : ''}"`,
        `"${inTime ? inTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila' }) : ''}"`,
        `"${inLoc.replace(/"/g, '""')}"`,
        `"${outTime ? outTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila' }) : ''}"`,
        `"${outLoc.replace(/"/g, '""')}"`,
        hours,
        `"${outTime ? 'Completed' : 'In Progress'}"`
      ]
    })
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance_${selectedEmployee.full_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Render Time with location badge & Google Maps link
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
              className="inline-flex items-center gap-1 mt-1 text-[10px] text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded transition-colors max-w-[130px] truncate shadow-2xs font-normal"
              title={`${displayLoc} (Click to open map)`}
              onClick={(e) => e.stopPropagation()}
            >
              <MapPin className="w-2.5 h-2.5 flex-shrink-0 text-emerald-600" />
              <span className="truncate">{displayLoc}</span>
            </a>
          ) : (
            <span
              className="inline-flex items-center gap-1 mt-1 text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded max-w-[130px] truncate font-normal"
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
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${isLate ? 'text-yellow-700 bg-yellow-50' : 'text-green-700 bg-green-50'
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

  // Group employee records into Morning and Afternoon sessions per day
  const groupedEmployeeDays = useMemo(() => {
    const groups = {}

    filteredRecords.forEach((record) => {
      if (!record.time_in) return
      const dateObj = new Date(record.time_in)
      const dateKey = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateKey,
          dateObj,
          morningRecord: null,
          afternoonRecord: null,
          records: []
        }
      }

      groups[dateKey].records.push(record)

      const hour = parseInt(dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        hour12: false,
        timeZone: 'Asia/Manila'
      }), 10)

      if (hour < 12) {
        if (!groups[dateKey].morningRecord || new Date(record.time_in) < new Date(groups[dateKey].morningRecord.time_in)) {
          groups[dateKey].morningRecord = record
        }
      } else {
        if (!groups[dateKey].afternoonRecord || new Date(record.time_in) < new Date(groups[dateKey].afternoonRecord.time_in)) {
          groups[dateKey].afternoonRecord = record
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
  }, [filteredRecords])

  const recordStats = {
    totalRecords: groupedEmployeeDays.length,
    totalHours: groupedEmployeeDays.reduce((sum, d) => sum + d.totalHours, 0).toFixed(1),
    completed: groupedEmployeeDays.filter(d => d.status === 'completed').length
  }

  const paginatedDays = groupedEmployeeDays.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  const totalPages = Math.ceil(groupedEmployeeDays.length / itemsPerPage)

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
                  <button
                    onClick={(e) => openEditModal(selectedEmployee, e)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <Edit3 size={12} /> Edit Role
                  </button>
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
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-sm capitalize">
                {selectedEmployee.role}
              </span>
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${selectedEmployee.status === 'approved'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
                }`}>
                {selectedEmployee.status === 'approved' ? 'Approved' : 'Pending Approval'}
              </span>
              {selectedEmployee.status !== 'approved' && (
                <button
                  onClick={(e) => approveEmployee(selectedEmployee, e)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white text-primary-700 text-sm font-medium rounded-lg hover:bg-primary-50 transition-colors"
                >
                  <UserCheck className="w-4 h-4" />
                  Approve
                </button>
              )}
            </div>
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
              className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Download className="w-5 h-5" />
              {generatingPDF ? 'Generating...' : 'Download DTR'}
            </button>
            <button
              onClick={exportEmployeeAttendanceCSV}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              title="Export filtered records to CSV"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Export CSV
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
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-primary-600 to-primary-700 text-white text-xs">
                      <th className="py-3.5 px-4 font-bold text-left rounded-tl-lg" rowSpan={2}>
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
                        Hours
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
                    {paginatedDays.map((day) => (
                      <tr
                        key={day.dateKey}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3.5 px-4 text-gray-900 font-semibold whitespace-nowrap">{day.formattedDate}</td>
                        <td className="py-3.5 px-3 text-center text-gray-700 font-medium border-l border-gray-100 bg-amber-50/20">
                          {renderTimeWithLocation(day.morningRecord?.time_in, day.morningRecord, true)}
                        </td>
                        <td className="py-3.5 px-3 text-center text-gray-700 font-medium border-l border-gray-100 bg-amber-50/20">
                          {renderTimeWithLocation(day.morningRecord?.time_out, day.morningRecord, false)}
                        </td>
                        <td className="py-3.5 px-3 text-center text-gray-700 font-medium border-l border-gray-100 bg-blue-50/20">
                          {renderTimeWithLocation(day.afternoonRecord?.time_in, day.afternoonRecord, true)}
                        </td>
                        <td className="py-3.5 px-3 text-center text-gray-700 font-medium border-l border-gray-100 bg-blue-50/20">
                          {renderTimeWithLocation(day.afternoonRecord?.time_out, day.afternoonRecord, false)}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-gray-900 border-l border-gray-100">
                          {day.totalHours > 0 ? `${day.totalHours.toFixed(1)}h` : '--'}
                        </td>
                        <td className="py-3.5 px-4 text-center border-l border-gray-100">
                          {day.status === 'in-progress' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200">
                              <ClockIcon className="w-3 h-3" /> In Progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200">
                              <CheckCircle className="w-3 h-3" /> {day.statusLabel}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
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
                        className={`px-4 py-2 rounded-lg transition-colors ${currentPage === i + 1
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Staff Management</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Oversee municipal employees, review roles, and approve registrations
          </p>
        </div>
        <button
          onClick={exportEmployeesToCSV}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-md font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
          title="Download complete employee directory in CSV format"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export Staff Directory (CSV)
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-5 sm:p-6 text-white shadow-md">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <Users className="w-7 h-7 sm:w-8 sm:h-8 opacity-80" />
            <span className="text-2xl sm:text-3xl font-bold">{employees.length}</span>
          </div>
          <p className="text-blue-100 text-xs sm:text-sm font-medium">Total Staff</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-5 sm:p-6 text-white shadow-md">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 opacity-80" />
            <span className="text-2xl sm:text-3xl font-bold">{employees.filter(e => e.role === 'user').length}</span>
          </div>
          <p className="text-emerald-100 text-xs sm:text-sm font-medium">Regular Employees</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-5 sm:p-6 text-white shadow-md">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <Hourglass className="w-7 h-7 sm:w-8 sm:h-8 opacity-80" />
            <span className="text-2xl sm:text-3xl font-bold">{employees.filter(e => e.status !== 'approved').length}</span>
          </div>
          <p className="text-amber-100 text-xs sm:text-sm font-medium">Pending Approvals</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-5 sm:p-6 text-white shadow-md">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <User className="w-7 h-7 sm:w-8 sm:h-8 opacity-80" />
            <span className="text-2xl sm:text-3xl font-bold">{employees.filter(e => e.role === 'admin').length}</span>
          </div>
          <p className="text-purple-100 text-xs sm:text-sm font-medium">Administrators</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees by name, email, department, or position..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-slide-up shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-primary-900">
            <CheckSquare className="w-4 h-4 text-primary-600" />
            <span>{selectedIds.length} employee{selectedIds.length !== 1 ? 's' : ''} selected</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleBulkApprove}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <UserCheck size={14} /> Approve Selected
            </button>
            <button
              onClick={handleBulkReject}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Trash2 size={14} /> Reject / Delete Selected
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-md text-xs font-semibold transition-all cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Employee Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
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
                <tr className="bg-gradient-to-r from-primary-600 to-primary-700 text-white text-xs">
                  <th className="py-3 px-3 text-center w-10 rounded-tl-lg">
                    <input
                      type="checkbox"
                      onChange={toggleSelectAll}
                      checked={filteredEmployees.length > 0 && filteredEmployees.every(e => selectedIds.includes(e.id))}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                      title="Select all"
                    />
                  </th>
                  <th className="text-left py-3.5 px-4 font-semibold">Employee</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Department / Position</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Contact</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Role</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Status</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Joined</th>
                  <th className="text-center py-3.5 px-4 font-semibold rounded-tr-lg">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredEmployees.map((emp) => {
                  const isChecked = selectedIds.includes(emp.id)
                  return (
                    <tr
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp)}
                      className={`border-b border-gray-100 hover:bg-primary-50/60 cursor-pointer transition-colors ${isChecked ? 'bg-primary-50/40' : ''
                        }`}
                    >
                      <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => toggleSelect(emp.id, e)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {emp.profile_picture ? (
                            <img
                              src={emp.profile_picture}
                              alt="Profile"
                              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 bg-primary-100 text-primary-700 font-bold rounded-full flex items-center justify-center text-xs flex-shrink-0">
                              {emp.full_name ? emp.full_name[0].toUpperCase() : 'U'}
                            </div>
                          )}
                          <div>
                            <span className="text-gray-900 font-bold block">{emp.full_name}</span>
                            <span className="text-xs text-gray-400">{emp.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <div>
                            <p className="text-gray-900 font-medium">
                              {emp.department ? (
                                <span className="bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded text-xs font-semibold border border-primary-200/50">
                                  {emp.department}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic text-xs">No Department</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">{emp.position || 'No Position'}</p>
                          </div>
                          <button
                            onClick={(e) => openEditModal(emp, e)}
                            className="p-1 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded transition-colors"
                            title="Edit Department / Position"
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-gray-800 text-xs flex items-center gap-1">
                          <Mail className="w-3 h-3 text-gray-400" /> {emp.email}
                        </p>
                        {emp.phone && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-gray-400" /> {emp.phone}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold capitalize ${emp.role === 'admin'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                          {emp.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold ${emp.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                          {emp.status === 'approved' ? (
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Hourglass className="w-3 h-3 text-amber-600" />
                          )}
                          {emp.status === 'approved' ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 text-xs">
                        {emp.created_at
                          ? new Date(emp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {emp.status !== 'approved' && (
                            <button
                              onClick={(e) => approveEmployee(emp, e)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 transition-colors shadow-sm"
                              title="Approve Account"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Approve
                            </button>
                          )}
                          <button
                            onClick={(e) => openEditModal(emp, e)}
                            className="p-1.5 text-gray-500 hover:text-primary-700 hover:bg-primary-50 rounded transition-colors"
                            title="Edit Role / Department"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={(e) => rejectOrDeleteEmployee(emp, e)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                            title={emp.status === 'approved' ? "Delete Employee Account" : "Reject & Delete Registration"}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Department & Position Modal */}
      {editingEmp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary-600" />
                <h3 className="font-bold text-gray-900 text-base">Assign Department & Position</h3>
              </div>
              <button
                onClick={() => setEditingEmp(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Updating role details for <strong className="text-gray-900">{editingEmp.full_name}</strong> ({editingEmp.email})
            </p>

            <form onSubmit={handleSaveEmpEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Department / Office
                </label>
                <input
                  type="text"
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                  placeholder="e.g. Treasury Office, RHU, Engineering..."
                  required
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Position / Designation
                </label>
                <input
                  type="text"
                  value={editPos}
                  onChange={(e) => setEditPos(e.target.value)}
                  placeholder="e.g. Administrative Officer, Nurse..."
                  required
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-xs font-bold disabled:opacity-50 transition-colors shadow-sm"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
