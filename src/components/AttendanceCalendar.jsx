import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function AttendanceCalendar({ attendanceRecords }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calendarDays, setCalendarDays] = useState([])

  useEffect(() => {
    generateCalendarDays()
  }, [currentDate, attendanceRecords])

  const generateCalendarDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDay = firstDay.getDay()
    const totalDays = lastDay.getDate()

    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startDay; i++) {
      days.push({ day: null, status: 'empty' })
    }
    
    // Add days of the month
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = new Date(year, month, day).toDateString()
      const dayRecords = attendanceRecords.filter(record => 
        new Date(record.time_in).toDateString() === dateStr
      )
      
      let status = 'none'
      if (dayRecords.length > 0) {
        const hasCompleteRecords = dayRecords.every(r => r.time_out)
        const hasLateArrival = dayRecords.some(r => {
          const hour = new Date(r.time_in).getHours()
          return hour >= 9 // Consider late if after 9 AM
        })
        
        if (hasCompleteRecords) {
          status = hasLateArrival ? 'late' : 'present'
        } else {
          status = 'incomplete'
        }
      }
      
      days.push({ day, status, date: new Date(year, month, day) })
    }
    
    setCalendarDays(days)
  }

  const getDayColor = (status) => {
    switch (status) {
      case 'present':
        return 'bg-green-500 text-white hover:bg-green-600'
      case 'late':
        return 'bg-yellow-500 text-white hover:bg-yellow-600'
      case 'incomplete':
        return 'bg-blue-500 text-white hover:bg-blue-600'
      case 'none':
        return 'bg-gray-100 text-gray-400 hover:bg-gray-200'
      default:
        return 'bg-transparent'
    }
  }

  const getDayLabel = (status) => {
    switch (status) {
      case 'present':
        return 'Present'
      case 'late':
        return 'Late'
      case 'incomplete':
        return 'Incomplete'
      case 'none':
        return 'Absent'
      default:
        return ''
    }
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={`
              aspect-square flex items-center justify-center rounded-lg text-sm font-medium
              transition-all duration-200 cursor-pointer
              ${getDayColor(day.status)}
              ${day.day ? 'hover:scale-105' : ''}
            `}
            title={getDayLabel(day.status)}
          >
            {day.day || ''}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500"></div>
          <span className="text-sm text-gray-600">Present</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500"></div>
          <span className="text-sm text-gray-600">Late</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-500"></div>
          <span className="text-sm text-gray-600">Incomplete</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-100"></div>
          <span className="text-sm text-gray-600">Absent</span>
        </div>
      </div>
    </div>
  )
}
