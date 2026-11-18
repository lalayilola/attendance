import { useAuth } from '../contexts/AuthContext'
import { QRCodeSVG } from 'qrcode.react'
import { Download, QrCode, AlertCircle, Shield, User } from 'lucide-react'
import { useRef } from 'react'

export function MyQR() {
  const { profile } = useAuth()
  const qrRef = useRef(null)

  const downloadQR = () => {
    const svg = qrRef.current
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      
      const pngFile = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.href = pngFile
      downloadLink.download = `qr-code-${profile?.full_name?.replace(/\s+/g, '-').toLowerCase()}.png`
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  if (!profile?.qr_token) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My QR Code</h1>
          <p className="text-gray-600 mt-1">Your unique attendance QR code</p>
        </div>
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <AlertCircle className="w-12 h-12 mb-4" />
          <p>QR code not available</p>
          <p className="text-sm mt-2">Please ensure your profile is loaded correctly</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My QR Code</h1>
        <p className="text-gray-600 mt-1">Your unique attendance QR code</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* QR Code Card */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl shadow-xl p-8 text-white">
          <div className="flex flex-col items-center">
            {/* Decorative frame */}
            <div className="relative bg-white p-6 rounded-2xl shadow-2xl mb-6 border-4 border-primary-300">
              <div className="absolute -top-3 -left-3 w-8 h-8 border-t-4 border-l-4 border-primary-400 rounded-tl-lg"></div>
              <div className="absolute -top-3 -right-3 w-8 h-8 border-t-4 border-r-4 border-primary-400 rounded-tr-lg"></div>
              <div className="absolute -bottom-3 -left-3 w-8 h-8 border-b-4 border-l-4 border-primary-400 rounded-bl-lg"></div>
              <div className="absolute -bottom-3 -right-3 w-8 h-8 border-b-4 border-r-4 border-primary-400 rounded-br-lg"></div>
              
              <div ref={qrRef}>
                <QRCodeSVG
                  value={profile.qr_token}
                  size={256}
                  level="H"
                  includeMargin={true}
                  fgColor="#1a1f4d"
                  bgColor="#ffffff"
                />
              </div>
            </div>

            <button
              onClick={downloadQR}
              className="flex items-center gap-2 bg-white text-primary-600 py-3 px-8 rounded-xl font-semibold hover:bg-primary-50 transition-all transform hover:scale-105 shadow-lg"
            >
              <Download size={20} />
              Download QR Code
            </button>
          </div>
        </div>

        {/* User Info Card */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Employee Information</h2>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-1">Full Name</p>
                <p className="text-lg font-semibold text-gray-900">{profile.full_name}</p>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-1">Email</p>
                <p className="text-lg font-semibold text-gray-900">{profile.email}</p>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-1">Role</p>
                <p className="text-lg font-semibold text-gray-900 capitalize">{profile.role}</p>
              </div>
            </div>
          </div>

          {/* Instructions Card */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-lg border border-blue-200 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <QrCode className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">How to use your QR code</h3>
            </div>
            
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-gray-700">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span>Show this QR code to the attendance scanner</span>
              </li>
              <li className="flex items-start gap-3 text-gray-700">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span>The scanner will record your TIME IN or TIME OUT</span>
              </li>
              <li className="flex items-start gap-3 text-gray-700">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span>Download it for offline access</span>
              </li>
            </ul>
          </div>

          {/* Security Notice */}
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl shadow-lg border border-yellow-200 p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Security Notice</h3>
                <p className="text-gray-700 text-sm">Keep your QR code secure and don't share it with others. It contains your unique attendance token.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
