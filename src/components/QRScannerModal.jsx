import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import jsQR from 'jsqr'
import { supabase } from '../lib/supabase'
import { 
  X, 
  Camera, 
  Upload, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  MapPin, 
  MapPinOff, 
  SwitchCamera, 
  Image as ImageIcon,
  Clock,
  LogIn,
  LogOut
} from 'lucide-react'

// Simple audio feedback via Web Audio API
const playBeep = (isSuccess = true) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (isSuccess) {
      // Pleasant double chirp
      osc.frequency.setValueAtTime(650, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.12)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
      osc.start()
      osc.stop(ctx.currentTime + 0.25)
    } else {
      // Low alert buzz
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(250, ctx.currentTime)
      gain.gain.setValueAtTime(0.25, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    }
  } catch {
    // Ignore audio permission or browser restriction errors
  }
}

// Reverse geocode coordinates to human-readable address with graceful fallback
const reverseGeocode = async (lat, lon) => {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: { 'Accept-Language': 'en' },
        signal: controller.signal
      }
    )
    clearTimeout(timeoutId)
    if (res.ok) {
      const data = await res.json()
      if (data && data.address) {
        const addr = data.address
        const building = addr.amenity || addr.building || addr.office || addr.government || ''
        const road = addr.road || addr.street || ''
        const barangay = addr.suburb || addr.neighbourhood || addr.village || addr.quarter || ''
        const municipality = addr.municipality || addr.city || addr.town || ''
        const province = addr.province || addr.state || ''

        const parts = [building, road, barangay, municipality, province].filter(Boolean)
        if (parts.length > 0) {
          return parts.slice(0, 3).join(', ')
        }
        if (data.display_name) {
          return data.display_name.split(',').slice(0, 3).join(', ')
        }
      }
    }
  } catch (err) {
    console.warn('Geocoding request failed or timed out:', err)
  }
  return `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`
}

// Blazing-fast, DOM-independent QR code decoder from image file:
// 1. Hardware BarcodeDetector API (C++/GPU, < 15ms)
// 2. High-speed jsQR on scaled Canvas ImageData (< 25ms)
// 3. Fallback to full resolution jsQR if downscale misses small modules
const decodeQrFromImage = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl)

      // 1. Hardware BarcodeDetector if available
      if ('BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
          const barcodes = await detector.detect(img)
          if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
            resolve(barcodes[0].rawValue.trim())
            return
          }
        } catch (e) {
          console.warn('BarcodeDetector pass failed, trying jsQR:', e)
        }
      }

      // 2. High-speed jsQR on canvas
      try {
        const maxDim = 1000
        let { width, height } = img

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, width, height)

        const imageData = ctx.getImageData(0, 0, width, height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        })

        if (code && code.data) {
          resolve(code.data.trim())
          return
        }

        // 3. If scaled didn't catch it and image was resized, try original resolution
        if (img.width !== width || img.height !== height) {
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
          const rawImageData = ctx.getImageData(0, 0, img.width, img.height)
          const rawCode = jsQR(rawImageData.data, rawImageData.width, rawImageData.height, {
            inversionAttempts: 'attemptBoth',
          })
          if (rawCode && rawCode.data) {
            resolve(rawCode.data.trim())
            return
          }
        }
      } catch (canvasErr) {
        console.warn('Canvas jsQR error:', canvasErr)
      }

      reject(new Error('No QR code detected'))
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image file'))
    }

    img.src = objectUrl
  })
}

export function QRScannerModal({ isOpen, onClose, initialMode = 'TIME IN', onSuccess }) {
  const [activeTab, setActiveTab] = useState('camera') // 'camera' | 'upload'
  const [mode, setMode] = useState(initialMode || 'TIME IN')
  const [facingMode, setFacingMode] = useState('environment') // 'environment' (back) | 'user' (front)
  const [cameraActive, setCameraActive] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [location, setLocation] = useState(null)
  const [locationName, setLocationName] = useState('')
  const [locationLoading, setLocationLoading] = useState(true)
  const [locationError, setLocationError] = useState('')
  const [hasGeofence, setHasGeofence] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const html5QrCodeRef = useRef(null)
  const fileInputRef = useRef(null)
  const isStoppingRef = useRef(false)
  const isSubmittingRef = useRef(false)

  // Request location permission & coordinates
  const requestLocation = () => {
    setLocationLoading(true)
    setLocationError('')

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser or device.')
      setLocationLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 0),
        }
        setLocation(coords)
        setLocationLoading(false)
        setLocationError('')

        // Reverse geocode asynchronously
        const placeName = await reverseGeocode(coords.latitude, coords.longitude)
        setLocationName(placeName)
      },
      (err) => {
        setLocationLoading(false)
        setLocation(null)
        if (err.code === 1) { // PERMISSION_DENIED
          setLocationError('Location permission was denied. Please allow location access in your browser or device settings to proceed with attendance.')
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          setLocationError('GPS signal unavailable. Please ensure location/GPS is turned ON on your phone/device.')
        } else if (err.code === 3) { // TIMEOUT
          setLocationError('GPS location request timed out. Please tap retry to try again.')
        } else {
          setLocationError(err.message || 'Unable to retrieve location.')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    )
  }

  // Sync initialMode & request location when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode || 'TIME IN')
      setResult(null)
      setError('')
      setProcessing(false)
      setProcessingStatus('')
      setPreviewImage(null)
      setActiveTab('camera')
      isSubmittingRef.current = false
      requestLocation()
    } else {
      stopCameraScanner()
    }
  }, [isOpen, initialMode])

  // Continuous geolocation update once granted
  useEffect(() => {
    if (!isOpen || !location) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation((prev) => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 0),
        }))
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [isOpen, !!location])

  // Geofence check
  useEffect(() => {
    if (!isOpen) return

    const checkGeofence = async () => {
      try {
        const { count, error } = await supabase
          .from('scanner_locations')
          .select('*', { count: 'exact', head: true })
        if (!error && (count || 0) > 0) {
          setHasGeofence(true)
        } else {
          setHasGeofence(false)
        }
      } catch {
        setHasGeofence(false)
      }
    }
    checkGeofence()
  }, [isOpen])

  // Handle Camera Startup & Teardown (only starts if location is granted)
  useEffect(() => {
    if (!isOpen || activeTab !== 'camera' || result || !location) {
      stopCameraScanner()
      return
    }

    // Short delay to ensure container DOM is ready
    const timer = setTimeout(() => {
      startCameraScanner()
    }, 250)

    return () => {
      clearTimeout(timer)
      stopCameraScanner()
    }
  }, [isOpen, activeTab, facingMode, result, !!location])

  const startCameraScanner = async () => {
    if (isStoppingRef.current) return
    setError('')

    const element = document.getElementById('qr-reader-modal')
    if (!element) return

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader-modal')
      }

      // If already scanning, stop first
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop()
      }

      const config = {
        fps: 12,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const edge = Math.min(viewfinderWidth, viewfinderHeight) * 0.72
          return { width: Math.round(edge), height: Math.round(edge) }
        },
        aspectRatio: 1.0,
      }

      await html5QrCodeRef.current.start(
        { facingMode: facingMode },
        config,
        handleCameraDecoded,
        () => {} // scan failure ignored per frame
      )

      setCameraActive(true)
    } catch (err) {
      console.warn('Failed to start camera:', err)
      setCameraActive(false)
      setError('Could not access camera. Please ensure camera permissions are allowed, or switch to Upload QR.')
    }
  }

  const stopCameraScanner = async () => {
    if (!html5QrCodeRef.current) return
    if (isStoppingRef.current) return

    try {
      isStoppingRef.current = true
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop()
      }
      setCameraActive(false)
    } catch (err) {
      console.warn('Error stopping camera:', err)
    } finally {
      isStoppingRef.current = false
    }
  }

  const toggleFacingMode = async () => {
    await stopCameraScanner()
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }

  // Centralized Attendance Submission logic with mandatory location
  const submitAttendance = async (rawQrToken) => {
    const token = (rawQrToken || '').trim()
    if (!token) {
      playBeep(false)
      setError('Invalid QR code scanned.')
      return
    }

    if (!location) {
      playBeep(false)
      setError('Location permission is required before recording attendance. Please enable location.')
      return
    }

    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setProcessing(true)
    setError('')
    setProcessingStatus(`Recording ${mode}...`)

    try {
      const locDisplay = locationName || `Lat: ${location.latitude.toFixed(5)}, Lon: ${location.longitude.toFixed(5)}`
      const rpcParams = {
        p_qr_token: token,
        p_action: mode,
        p_latitude: location.latitude,
        p_longitude: location.longitude,
        p_location_name: locDisplay,
      }

      const { data, error: rpcError } = await supabase.rpc('record_attendance', rpcParams)

      if (rpcError) throw rpcError

      if (data && data.success) {
        playBeep(true)
        setResult({
          ...data,
          location: data.location || locDisplay
        })
        await stopCameraScanner()

        if (onSuccess) {
          onSuccess(data)
        }
      } else {
        playBeep(false)
        setError(data?.error || 'Attendance verification failed.')
      }
    } catch (err) {
      playBeep(false)
      setError(err.message || 'An error occurred while recording attendance.')
    } finally {
      setProcessing(false)
      setProcessingStatus('')
      isSubmittingRef.current = false
    }
  }

  // Continuous Camera Scan Frame Callback
  const handleCameraDecoded = async (decodedText) => {
    if (isSubmittingRef.current || processing || result) return
    await submitAttendance(decodedText)
  }

  // Ultra-fast Upload QR Code handler
  const handleFileUpload = async (file) => {
    if (!file) return

    setError('')
    setResult(null)
    setProcessing(true)
    setProcessingStatus('Analyzing QR code...')

    // Show image preview immediately
    const objectUrl = URL.createObjectURL(file)
    setPreviewImage(objectUrl)

    try {
      // Ensure camera is stopped before file processing
      await stopCameraScanner()

      // High-speed DOM-independent QR decode (Native BarcodeDetector -> jsQR Canvas)
      const decodedText = await decodeQrFromImage(file)

      if (decodedText) {
        await submitAttendance(decodedText)
      } else {
        throw new Error('No QR code detected')
      }
    } catch (err) {
      console.warn('File scan error:', err)
      playBeep(false)
      setError('Could not detect a valid QR code in this image. Please upload a clear photo or screenshot of the QR code.')
      setProcessing(false)
      setProcessingStatus('')
      isSubmittingRef.current = false
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  const handleResetForNextScan = () => {
    setResult(null)
    setError('')
    setPreviewImage(null)
    if (activeTab === 'camera') {
      startCameraScanner()
    }
  }

  const handleClose = async () => {
    await stopCameraScanner()
    if (previewImage) {
      URL.revokeObjectURL(previewImage)
    }
    onClose()
  }

  if (!isOpen) return null

  const isTimeInMode = mode === 'TIME IN'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-lg bg-white rounded-lg sm:rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className={`px-5 py-3.5 flex items-center justify-between text-white transition-colors duration-200 ${
          isTimeInMode 
            ? 'bg-gradient-to-r from-emerald-600 to-green-600' 
            : 'bg-gradient-to-r from-rose-600 to-red-600'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-md backdrop-blur-sm">
              {isTimeInMode ? <LogIn className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold tracking-tight">QR Attendance</h3>
                <span className="text-[11px] px-2 py-0.5 font-bold uppercase rounded bg-white/25 tracking-wider">
                  {mode}
                </span>
              </div>
              <p className="text-xs text-white/90">Scan another phone or upload QR image</p>
            </div>
          </div>
          
          <button
            onClick={handleClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-md transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Selector Tabs (Time In / Time Out) */}
        <div className="p-2.5 bg-gray-50 border-b border-gray-200 flex gap-2">
          <button
            onClick={() => setMode('TIME IN')}
            className={`flex-1 py-2 px-3 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition-all tracking-wide ${
              mode === 'TIME IN'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            <LogIn size={14} />
            TIME IN
          </button>
          <button
            onClick={() => setMode('TIME OUT')}
            className={`flex-1 py-2 px-3 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition-all tracking-wide ${
              mode === 'TIME OUT'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            <LogOut size={14} />
            TIME OUT
          </button>
        </div>

        {/* Scan Method Switcher: Direct Camera vs Upload */}
        <div className="px-5 pt-3.5 pb-1.5">
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-md">
            <button
              onClick={() => {
                setActiveTab('camera')
                setError('')
              }}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-all ${
                activeTab === 'camera'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Camera size={15} />
              Scan with Camera
            </button>
            <button
              onClick={async () => {
                await stopCameraScanner()
                setActiveTab('upload')
                setError('')
              }}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-all ${
                activeTab === 'upload'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Upload size={15} />
              Upload QR Image
            </button>
          </div>
        </div>

        {/* Main Scanner Container */}
        <div className="p-5 flex-1 overflow-y-auto">
          {/* Result Card Overlay */}
          {result ? (
            <div className="text-center py-3 space-y-4 animate-fade-in">
              <div className={`w-16 h-16 mx-auto rounded-lg flex items-center justify-center shadow-md ${
                result.action === 'TIME IN' 
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                  : 'bg-blue-100 text-blue-700 border border-blue-300'
              }`}>
                <CheckCircle className="w-10 h-10" />
              </div>

              <div>
                <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold tracking-wider uppercase mb-1.5 ${
                  result.action === 'TIME IN'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {result.session ? `${result.session} ` : ''}{result.action} RECORDED
                </span>
                <h4 className="text-xl sm:text-2xl font-black text-gray-900">{result.name || 'Employee'}</h4>
                <p className="text-xs text-gray-500 mt-0.5">{result.message}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-200 text-left space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="text-gray-500">Recorded At:</span>
                  <span className="font-bold text-gray-800">
                    {new Date(result.timestamp).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="text-gray-500">Date:</span>
                  <span className="font-bold text-gray-800">
                    {new Date(result.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="text-gray-500">Scan Location:</span>
                  <span className="font-bold text-emerald-800 flex items-center gap-1 max-w-[200px] truncate" title={result.location || locationName}>
                    <MapPin size={13} className="text-emerald-600 flex-shrink-0" />
                    <span className="truncate">{result.location || locationName || 'Recorded'}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Status:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle size={14} /> Verified & Saved
                  </span>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={handleResetForNextScan}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md font-bold text-xs sm:text-sm transition-colors"
                >
                  <RefreshCw size={15} />
                  Scan Another
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 py-2.5 px-3 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-bold text-xs sm:text-sm shadow-sm transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : !location ? (
            /* Location Permission Screen (Enforced before scanning) */
            <div className="py-6 px-3 sm:px-4 text-center space-y-4 animate-fade-in">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center shadow-inner ${
                locationError 
                  ? 'bg-rose-100 text-rose-600' 
                  : 'bg-primary-100 text-primary-600 animate-pulse'
              }`}>
                {locationError ? <MapPinOff className="w-8 h-8" /> : <MapPin className="w-8 h-8" />}
              </div>

              <div>
                <h4 className="text-lg font-bold text-gray-900">
                  {locationLoading 
                    ? 'Acquiring GPS Location...' 
                    : locationError 
                      ? 'Location Permission Required' 
                      : 'Enable Location to Scan'}
                </h4>
                <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto mt-1">
                  {locationLoading
                    ? 'Please grant location permission if prompted by your browser to verify your attendance presence.'
                    : locationError
                      ? locationError
                      : 'Civil Service DTR guidelines require recording your verified physical location when scanning Time In or Time Out.'}
                </p>
              </div>

              {locationError && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left text-xs text-amber-900 space-y-1.5 max-w-sm mx-auto shadow-sm">
                  <p className="font-bold flex items-center gap-1.5 text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    How to allow location access:
                  </p>
                  <ol className="list-decimal list-inside space-y-0.5 text-amber-800 text-[11px] pl-0.5">
                    <li>Click the <strong>Lock / Settings icon</strong> in your browser address bar</li>
                    <li>Set <strong>Location</strong> permission to <strong>Allow</strong></li>
                    <li>Click the <strong>Try Again</strong> button below</li>
                  </ol>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={requestLocation}
                  disabled={locationLoading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {locationLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Acquiring Location...
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4" />
                      {locationError ? 'Try Again' : 'Allow Location Access'}
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2">
                <p className="text-[11px] text-gray-400">
                  Your coordinates will only be recorded alongside your {mode} attendance stamp.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Verified Location Banner */}
              <div className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-md flex items-center justify-between text-xs text-emerald-900 shadow-sm animate-fade-in">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span className="font-bold flex-shrink-0 text-emerald-900">Location:</span>
                  <span className="truncate text-emerald-800 font-medium" title={locationName || `${location.latitude}, ${location.longitude}`}>
                    {locationName || `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}
                  </span>
                </div>
                {location.accuracy > 0 && (
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100/70 px-1.5 py-0.5 rounded flex-shrink-0 ml-2">
                    ±{location.accuracy}m
                  </span>
                )}
              </div>

              {/* Camera Scanner View */}
              {activeTab === 'camera' && (
                <div className="space-y-3">
                  <div className="relative bg-black rounded-md overflow-hidden aspect-square flex items-center justify-center shadow-inner">
                    {/* Html5Qrcode Reader Mount Target */}
                    <div id="qr-reader-modal" className="w-full h-full"></div>

                    {/* Laser and Frame Overlay with sharp corners */}
                    {cameraActive && !processing && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="relative w-48 h-48 sm:w-56 sm:h-56 border-2 border-white/60 overflow-hidden">
                          {/* Corner Markers - Sharp */}
                          <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-emerald-400"></div>
                          <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-emerald-400"></div>
                          <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-emerald-400"></div>
                          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-emerald-400"></div>
                          
                          {/* Animated Scan Line */}
                          <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-scan-laser"></div>
                        </div>
                      </div>
                    )}

                    {/* Camera Control Overlays */}
                    {cameraActive && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
                        <button
                          onClick={toggleFacingMode}
                          className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-md backdrop-blur-md transition-transform active:scale-95 shadow-md border border-white/20"
                          title="Flip camera (front / back)"
                        >
                          <SwitchCamera size={16} />
                        </button>
                      </div>
                    )}

                    {/* Loading / Processing Indicator */}
                    {processing && (
                      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent mb-2.5"></div>
                        <p className="font-bold text-xs sm:text-sm">Processing QR Code...</p>
                        <p className="text-[11px] text-white/70 mt-0.5">{processingStatus || `Recording ${mode}...`}</p>
                      </div>
                    )}

                    {!cameraActive && !processing && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-gray-400 z-10">
                        <Camera className="w-10 h-10 mb-2 text-gray-500 animate-pulse" />
                        <p className="text-xs sm:text-sm font-semibold text-gray-300">Starting camera...</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Allow camera access if prompted</p>
                      </div>
                    )}
                  </div>

                  <p className="text-center text-[11px] text-gray-500">
                    Aim camera at another phone's screen or printed QR badge
                  </p>
                </div>
              )}

              {/* Upload QR View */}
              {activeTab === 'upload' && (
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0])
                      }
                    }}
                  />

                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-md p-6 sm:p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                      dragOver
                        ? 'border-primary-500 bg-primary-50/50 scale-[1.01]'
                        : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                    }`}
                  >
                    {previewImage ? (
                      <div className="flex flex-col items-center">
                        <img
                          src={previewImage}
                          alt="QR Code Preview"
                          className="w-32 h-32 sm:w-36 sm:h-36 object-contain rounded-md border border-gray-200 shadow-sm mb-3"
                        />
                        <span className="text-xs text-primary-600 font-bold hover:underline">
                          Choose a different image
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="w-14 h-14 bg-primary-50 text-primary-600 rounded-md flex items-center justify-center mb-3 shadow-sm border border-primary-100">
                          <ImageIcon className="w-7 h-7" />
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 text-center">
                          Upload QR Code Image
                        </h4>
                        <p className="text-xs text-gray-500 text-center mt-1">
                          PNG, JPG, WEBP, or screenshot from another phone
                        </p>
                        <span className="mt-3.5 px-3.5 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-100 transition-colors">
                          Choose from Photos / Gallery
                        </span>
                      </>
                    )}
                  </div>

                  {processing && (
                    <div className="flex items-center justify-center gap-2 p-3 bg-primary-50 rounded-md text-primary-700 text-xs font-semibold">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-600 border-t-transparent"></div>
                      <span>{processingStatus || `Analyzing QR code and recording ${mode}...`}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2.5 text-rose-700 text-xs animate-slide-up">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                  <div className="flex-1">
                    <p className="font-bold">{error}</p>
                    {activeTab === 'upload' && (
                      <p className="mt-0.5 text-rose-600/80">Make sure the QR code is clearly visible and not blurry.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Status & Location Pill */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                <div className="flex items-center gap-1">
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                    <MapPin size={12} />
                    GPS Location Attached
                  </span>
                </div>

                <span className="text-gray-400">
                  Target: <strong className={isTimeInMode ? 'text-emerald-600' : 'text-rose-600'}>{mode}</strong>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
