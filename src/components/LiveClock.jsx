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
    <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl shadow-sm border border-primary-200 p-8">
      <div className="flex items-center justify-center gap-4 mb-4">
        <Calendar className="w-6 h-6 text-primary-600" />
        <span className="text-gray-700 font-medium text-lg">{date}</span>
      </div>
      <div className="flex items-center justify-center gap-4">
        <Clock className="w-8 h-8 text-primary-600" />
        <span className="text-5xl font-bold text-primary-800 tracking-wider">{time}</span>
      </div>
      <p className="text-center text-primary-600 mt-4 font-semibold">PHILIPPINE STANDARD TIME</p>
      <p className="text-center text-primary-500 text-sm mt-1">Asia/Manila Timezone</p>
    </div>
  )
}
