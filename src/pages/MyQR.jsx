import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Download, Share2, QrCode, AlertCircle, Shield, User, CheckCircle } from 'lucide-react'
import { useRef, useState } from 'react'

export function MyQR() {
  const { profile } = useAuth()
  const qrRef = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const [feedback, setFeedback] = useState('')

  const getQRBlob = () => {
    return new Promise((resolve, reject) => {
      const container = qrRef.current
      if (!container) return reject(new Error('QR element not ready'))

      // Find the actual <svg> element (inside ref div)
      const svgElement = container.querySelector('svg') || (container.tagName?.toLowerCase() === 'svg' ? container : null)
      if (!svgElement) return reject(new Error('SVG element not found'))

      const clonedSvg = svgElement.cloneNode(true)
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      clonedSvg.setAttribute('width', '600')
      clonedSvg.setAttribute('height', '600')

      const svgXml = new XMLSerializer().serializeToString(clonedSvg)
      const svgBlob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' })
      const blobUrl = URL.createObjectURL(svgBlob)

      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 600
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')

        // Pure white background for high scan contrast
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, size, size)
        ctx.drawImage(img, 0, 0, size, size)
        URL.revokeObjectURL(blobUrl)

        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob conversion failed'))
        }, 'image/png')
      }

      img.onerror = () => {
        URL.revokeObjectURL(blobUrl)
        // Fallback to SVG blob
        resolve(svgBlob)
      }

      img.src = blobUrl
    })
  }

  const downloadQR = async () => {
    try {
      setDownloading(true)
      const blob = await getQRBlob()
      const isPng = blob.type === 'image/png'
      const ext = isPng ? 'png' : 'svg'
      const url = URL.createObjectURL(blob)
      const cleanName = (profile?.full_name || 'attendance-qr').replace(/\s+/g, '-').toLowerCase()

      const link = document.createElement('a')
      link.href = url
      link.download = `qr-code-${cleanName}.${ext}`
      document.body.appendChild(link)
      link.click()

      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        setDownloading(false)
        setFeedback('QR code downloaded successfully!')
        setTimeout(() => setFeedback(''), 3500)
      }, 300)
    } catch (err) {
      console.error('Download error:', err)
      setDownloading(false)
      setFeedback('Failed to download QR code. Please try taking a screenshot.')
    }
  }

  const shareQR = async () => {
    try {
      const blob = await getQRBlob()
      const cleanName = (profile?.full_name || 'attendance').replace(/\s+/g, '-').toLowerCase()
      const file = new File([blob], `qr-code-${cleanName}.png`, { type: 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Attendance QR Code',
          text: `Attendance QR code for ${profile?.full_name}`,
        })
      } else {
        downloadQR()
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        downloadQR()
      }
    }
  }

  if (profile?.role === 'admin') {
    return (
      <div className="max-w-xl mx-auto py-10 px-4 text-center animate-fade-in">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-4">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto text-purple-600 shadow-inner">
            <Shield size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Administrator Account</h2>
          <p className="text-gray-600 text-sm max-w-md mx-auto leading-relaxed">
            As an administrator, you manage staff and oversee municipality attendance records. Admin accounts do not have an attendance QR code and do not log time in or time out.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/history"
              className="w-full sm:w-auto px-5 py-2.5 rounded-md bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm transition-all shadow-sm"
            >
              View Staff Attendance Logs
            </Link>
            <Link
              to="/admin"
              className="w-full sm:w-auto px-5 py-2.5 rounded-md border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-sm transition-all"
            >
              Manage Staff Directory
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!profile?.qr_token) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">My QR Code</h1>
          <p className="text-gray-600 text-sm mt-1">Your unique attendance QR code</p>
        </div>
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <AlertCircle className="w-12 h-12 mb-3 text-amber-500" />
          <p className="font-bold text-gray-800">QR code not available</p>
          <p className="text-xs text-gray-500 mt-1">Please ensure your profile is approved and loaded</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">My QR Code</h1>
        <p className="text-gray-600 text-sm mt-1">Your unique attendance QR code</p>
      </div>

      {feedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md flex items-center gap-2 text-emerald-800 text-xs sm:text-sm font-semibold animate-slide-up">
          <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* QR Code Card */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg sm:rounded-xl shadow-md p-6 sm:p-8 text-white">
          <div className="flex flex-col items-center">
            {/* Decorative frame */}
            <div className="relative bg-white p-5 sm:p-6 rounded-md shadow-lg mb-6 border-2 border-primary-300">
              <div className="absolute -top-2.5 -left-2.5 w-6 h-6 border-t-4 border-l-4 border-primary-400"></div>
              <div className="absolute -top-2.5 -right-2.5 w-6 h-6 border-t-4 border-r-4 border-primary-400"></div>
              <div className="absolute -bottom-2.5 -left-2.5 w-6 h-6 border-b-4 border-l-4 border-primary-400"></div>
              <div className="absolute -bottom-2.5 -right-2.5 w-6 h-6 border-b-4 border-r-4 border-primary-400"></div>
              
              <div ref={qrRef} className="inline-block bg-white">
                <QRCodeSVG
                  value={profile.qr_token}
                  size={240}
                  level="H"
                  includeMargin={true}
                  fgColor="#1a1f4d"
                  bgColor="#ffffff"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 justify-center w-full max-w-xs">
              <button
                onClick={downloadQR}
                disabled={downloading}
                className="flex-1 flex items-center justify-center gap-2 bg-white text-primary-700 py-3 px-5 rounded-md font-bold text-xs sm:text-sm hover:bg-primary-50 transition-all active:scale-[0.98] shadow-md tracking-wide disabled:opacity-50 cursor-pointer"
              >
                <Download size={18} />
                {downloading ? 'SAVING...' : 'DOWNLOAD QR'}
              </button>

              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={shareQR}
                  className="p-3 bg-white/20 hover:bg-white/30 text-white rounded-md transition-colors"
                  title="Share or Save to Photos"
                >
                  <Share2 size={18} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* User Info Card */}
        <div className="space-y-5">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-md flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Employee Information</h2>
            </div>
            
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-md p-3.5 border border-gray-100">
                <p className="text-xs text-gray-500 mb-0.5">Full Name</p>
                <p className="text-base font-bold text-gray-900">{profile.full_name}</p>
              </div>
              
              <div className="bg-gray-50 rounded-md p-3.5 border border-gray-100">
                <p className="text-xs text-gray-500 mb-0.5">Email</p>
                <p className="text-base font-bold text-gray-900">{profile.email}</p>
              </div>

              {profile.department && (
                <div className="bg-gray-50 rounded-md p-3.5 border border-gray-100">
                  <p className="text-xs text-gray-500 mb-0.5">Department / Office</p>
                  <p className="text-base font-bold text-gray-900">{profile.department}</p>
                </div>
              )}

              {profile.position && (
                <div className="bg-gray-50 rounded-md p-3.5 border border-gray-100">
                  <p className="text-xs text-gray-500 mb-0.5">Position / Designation</p>
                  <p className="text-base font-bold text-gray-900">{profile.position}</p>
                </div>
              )}
            </div>
          </div>

          {/* Instructions Card */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-sm border border-blue-200 p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0">
                <QrCode className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-base font-bold text-gray-900">How to use your QR code</h3>
            </div>
            
            <ul className="space-y-2 text-xs text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Show this QR code to the scanner on another phone or scanner device</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>The scanner will record your TIME IN or TIME OUT</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Download or screenshot this QR to your gallery for quick offline access</span>
              </li>
            </ul>
          </div>

          {/* Security Notice */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg shadow-sm border border-amber-200 p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-500 rounded-md flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-0.5">Security Notice</h3>
                <p className="text-gray-700 text-xs">Keep your QR code secure and do not share it with others. It uniquely identifies your attendance record.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
