import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function generateDTRPDF(profile, attendanceRecords, startDate, endDate) {
  const doc = new jsPDF('p', 'mm', 'legal')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  
  // Header
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Republic of the Philippines', pageWidth / 2, 15, { align: 'center' })
  doc.text('MUNICIPALITY OF MALIMONO', pageWidth / 2, 22, { align: 'center' })
  doc.text('Province of Surigao del Norte', pageWidth / 2, 29, { align: 'center' })
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('DAILY TIME RECORD', pageWidth / 2, 40, { align: 'center' })
  
  // Employee Information
  const startY = 50
  const leftCol = 20
  const rightCol = 100
  const lineHeight = 8
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Name:', leftCol, startY)
  doc.setFont('helvetica', 'normal')
  doc.text(profile?.full_name || 'N/A', leftCol + 25, startY)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Position:', rightCol, startY)
  doc.setFont('helvetica', 'normal')
  doc.text(profile?.position || 'N/A', rightCol + 25, startY)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Department/Office:', leftCol, startY + lineHeight)
  doc.setFont('helvetica', 'normal')
  doc.text(profile?.department || 'N/A', leftCol + 45, startY + lineHeight)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Period:', rightCol, startY + lineHeight)
  doc.setFont('helvetica', 'normal')
  const periodText = `${formatDate(startDate)} to ${formatDate(endDate)}`
  doc.text(periodText, rightCol + 20, startY + lineHeight)
  
  // Generate calendar data
  const calendarData = generateCalendarData(attendanceRecords, startDate, endDate)
  
  // Table headers
  const tableHeaders = [
    'Day',
    'AM',
    '',
    'PM',
    '',
    'Undertime',
    'Hours Worked'
  ]
  
  const tableColumnStyles = {
    0: { cellWidth: 15, halign: 'center' },
    1: { cellWidth: 20, halign: 'center' },
    2: { cellWidth: 20, halign: 'center' },
    3: { cellWidth: 20, halign: 'center' },
    4: { cellWidth: 20, halign: 'center' },
    5: { cellWidth: 25, halign: 'center' },
    6: { cellWidth: 25, halign: 'center' }
  }
  
  // Table data
  const tableBody = calendarData.map(day => [
    day.date,
    day.amIn,
    day.amOut,
    day.pmIn,
    day.pmOut,
    day.undertime,
    day.hoursWorked
  ])
  
  // Add total row
  const totalHours = calendarData.reduce((sum, day) => sum + (day.hoursWorked || 0), 0)
  tableBody.push([
    { content: 'TOTAL', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: totalHours.toFixed(1), styles: { fontStyle: 'bold' } }
  ])
  
  // Generate table
  autoTable(doc, {
    startY: startY + lineHeight * 3,
    head: [tableHeaders],
    body: tableBody,
    columnStyles: tableColumnStyles,
    styles: {
      fontSize: 9,
      cellPadding: 2,
      valign: 'middle'
    },
    headStyles: {
      fillColor: [200, 200, 200],
      fontStyle: 'bold',
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    theme: 'grid'
  })
  
  // Signature section
  const signatureY = doc.lastAutoTable.finalY + 20
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('I CERTIFY ON MY HONOR THAT THIS IS MY TRUE AND CORRECT DAILY TIME RECORD', pageWidth / 2, signatureY, { align: 'center' })
  
  const sigLineY = signatureY + 25
  const sigLeft = 30
  const sigRight = 110
  
  doc.line(sigLeft, sigLineY, sigLeft + 50, sigLineY)
  doc.line(sigRight, sigLineY, sigRight + 50, sigLineY)
  
  doc.setFont('helvetica', 'normal')
  doc.text('RATING OF OFFICIALS', sigLeft + 10, sigLineY + 5)
  doc.text('Employee Signature', sigRight + 10, sigLineY + 5)
  
  doc.setFontSize(9)
  doc.text('(Over Initials)', sigLeft + 20, sigLineY + 10)
  
  // Verification section
  const verifyY = sigLineY + 25
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('VERIFICATION', pageWidth / 2, verifyY, { align: 'center' })
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const verifyText = `This is to certify that the above is a true and correct report of the hours of work performed by ${profile?.full_name || 'the employee'} during the period indicated.`
  const splitText = doc.splitTextToSize(verifyText, pageWidth - 40)
  doc.text(splitText, 20, verifyY + 10)
  
  const verifySigY = verifyY + 25
  doc.line(30, verifySigY, 80, verifySigY)
  doc.text('Supervisor', 40, verifySigY + 5)
  
  // Save PDF
  const fileName = `DTR_${profile?.full_name?.replace(/\s+/g, '_')}_${formatDate(startDate)}_${formatDate(endDate)}.pdf`
  doc.save(fileName)
}

function generateCalendarData(attendanceRecords, startDate, endDate) {
  const data = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  // Group attendance records by date
  const recordsByDate = {}
  attendanceRecords.forEach(record => {
    const date = new Date(record.time_in).toDateString()
    if (!recordsByDate[date]) {
      recordsByDate[date] = []
    }
    recordsByDate[date].push(record)
  })
  
  // Generate day by day
  let currentDate = new Date(start)
  while (currentDate <= end) {
    const dateStr = currentDate.toDateString()
    const dayRecords = recordsByDate[dateStr] || []
    
    // Find morning and afternoon records
    const morningRecord = dayRecords.find(r => {
      const hour = new Date(r.time_in).getHours()
      return hour < 12
    })
    
    const afternoonRecord = dayRecords.find(r => {
      const hour = new Date(r.time_in).getHours()
      return hour >= 12
    })
    
    const dayData = {
      date: formatDate(currentDate),
      amIn: morningRecord ? formatTime(morningRecord.time_in) : '',
      amOut: morningRecord ? formatTime(morningRecord.time_out) : '',
      pmIn: afternoonRecord ? formatTime(afternoonRecord.time_in) : '',
      pmOut: afternoonRecord ? formatTime(afternoonRecord.time_out) : '',
      undertime: '',
      hoursWorked: calculateHours(morningRecord, afternoonRecord)
    }
    
    data.push(dayData)
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return data
}

function formatDate(date) {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  })
}

function formatTime(dateString) {
  if (!dateString) return ''
  const d = new Date(dateString)
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

function calculateHours(morningRecord, afternoonRecord) {
  let totalHours = 0
  
  if (morningRecord && morningRecord.time_in && morningRecord.time_out) {
    const inTime = new Date(morningRecord.time_in)
    const outTime = new Date(morningRecord.time_out)
    totalHours += (outTime - inTime) / (1000 * 60 * 60)
  }
  
  if (afternoonRecord && afternoonRecord.time_in && afternoonRecord.time_out) {
    const inTime = new Date(afternoonRecord.time_in)
    const outTime = new Date(afternoonRecord.time_out)
    totalHours += (outTime - inTime) / (1000 * 60 * 60)
  }
  
  return totalHours > 0 ? totalHours : 0
}
