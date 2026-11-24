import { useState, useEffect } from 'react'
import { Clock, Calendar } from 'lucide-react'

export function LiveClock() {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      
      // Format time in HH:MM:SS AM/PM
      const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila'
      })
      
      // Format date
      const dateString = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Manila'
      })
      
      setTime(timeString)
      setDate(dateString)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-md sm:rounded-lg shadow-sm border border-primary-200 p-5 sm:p-7">
      <div className="flex items-center justify-center gap-2.5 sm:gap-4 mb-2 sm:mb-3">
        <Calendar className="w-5 h-5 text-primary-600" />
        <span className="text-gray-700 font-semibold text-sm sm:text-base">{date}</span>
      </div>
      <div className="flex items-center justify-center gap-2.5 sm:gap-4">
        <Clock className="w-6 h-6 sm:w-7 sm:h-7 text-primary-600" />
        <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-primary-800 tracking-wider">{time}</span>
      </div>
      <p className="text-center text-primary-700 mt-3 font-bold text-xs sm:text-sm tracking-wide">PHILIPPINE STANDARD TIME</p>
      <p className="text-center text-primary-500 text-[11px] sm:text-xs mt-0.5">Asia/Manila Timezone</p>
    </div>
  )
}
