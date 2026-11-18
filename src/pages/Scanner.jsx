import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { useAuth } from '../contexts/AuthContext'
import { LiveClock } from '../components/LiveClock'
import { supabase } from '../lib/supabase'
import { Scan, Camera, CameraOff, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'

export function Scanner() {
  const { profile } = useAuth()
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(console.error)
      }
    }
  }, [])

  const startScanner = async () => {
    try {
      setError('')
      setResult(null)
      
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('reader')
      }

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      }

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        config,
        onScanSuccess,
        onScanFailure
      )

      setScanning(true)
    } catch (err) {
      setError('Failed to start camera. Please ensure camera permissions are granted.')
      console.error('Camera start error:', err)
    }
  }

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current && scanning) {
        await html5QrCodeRef.current.stop()
        setScanning(false)
      }
    } catch (err) {
      console.error('Camera stop error:', err)
    }
  }

  const onScanSuccess = async (decodedText) => {
    if (processing) return
    
    setProcessing(true)
    setError('')
    
    try {
      // Call the Supabase RPC function
      const { data, error } = await supabase.rpc('record_attendance', {
        p_qr_token: decodedText
      })

      if (error) throw error

      if (data.success) {
        setResult(data)
        
        // Stop scanner temporarily to prevent rapid rescans
        await stopScanner()
        
        // Auto-resume after 3 seconds
        setTimeout(() => {
          setResult(null)
          setProcessing(false)
        }, 3000)
      } else {
        setError(data.error || 'Failed to record attendance')
        setProcessing(false)
      }
    } catch (err) {
      setError(err.message || 'Failed to record attendance')
      setProcessing(false)
    }
  }

  const onScanFailure = (error) => {
    // Ignore scan failures (no QR code in frame)
    // This is expected behavior
  }

  const formatTime = (dateString) => {
    if (!dateString) return '--:--'
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila'
    })
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Manila'
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">QR Scanner</h1>
        <p className="text-gray-600 mt-1">Scan QR codes to record attendance</p>
      </div>

      <LiveClock />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Camera</h2>
            <div className="flex items-center gap-2">
              {scanning ? (
                <span className="flex items-center gap-1 text-green-600 text-sm">
                  <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                  Active
                </span>
              ) : (
                <span className="flex items-center gap-1 text-gray-500 text-sm">
                  <div className="w-2 h-2 bg-gray-500 rounded-full" />
                  Inactive
                </span>
              )}
            </div>
          </div>

          <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
            <div id="reader" className="w-full"></div>
            
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                <CameraOff className="w-16 h-16 mb-4" />
                <p className="text-center px-4">Camera is not active</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            {!scanning ? (
              <button
                onClick={startScanner}
                disabled={processing}
                className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Camera size={20} />
                Start Camera
              </button>
            ) : (
              <button
                onClick={stopScanner}
                disabled={processing}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CameraOff size={20} />
                Stop Camera
              </button>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Result Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Scan Result</h2>

          {processing && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
              <p className="text-gray-600">Processing QR code...</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className={`p-6 rounded-lg border-2 ${
                result.action === 'TIME IN' 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center justify-center gap-3 mb-4">
                  {result.action === 'TIME IN' ? (
                    <CheckCircle className="w-12 h-12 text-green-600" />
                  ) : (
                    <CheckCircle className="w-12 h-12 text-blue-600" />
                  )}
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{result.action}</p>
                    <p className="text-gray-600">Recorded Successfully</p>
                  </div>
                </div>

                <div className="space-y-3 mt-6">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium text-gray-900">{formatDate(result.timestamp)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Time:</span>
                    <span className="font-medium text-gray-900">{formatTime(result.timestamp)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-medium ${
                      result.action === 'TIME IN' ? 'text-green-600' : 'text-blue-600'
                    }`}>
                      {result.message}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-center text-sm text-gray-500">
                <RefreshCw className="w-4 h-4 inline mr-1" />
                Scanner will resume automatically in 3 seconds
              </div>
            </div>
          )}

          {!result && !processing && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Scan className="w-16 h-16 mb-4" />
              <p className="text-center px-4">No scan result yet</p>
              <p className="text-sm mt-2">Start the camera and scan a QR code</p>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-3">Scanner Instructions</h3>
        <ul className="space-y-2 text-blue-800">
          <li className="flex items-start gap-2">
            <span className="font-bold">1.</span>
            <span>Click "Start Camera" to activate the device camera</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">2.</span>
            <span>Position the QR code within the camera frame</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">3.</span>
            <span>The scanner will automatically detect and process the QR code</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">4.</span>
            <span>First scan records TIME IN, second scan records TIME OUT</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">5.</span>
            <span>Wait 3 seconds between scans to prevent duplicate records</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
