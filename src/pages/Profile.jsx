import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { User, MapPin, Phone, Camera, Lock, Save, CheckCircle, AlertCircle, Building2, Briefcase } from 'lucide-react'

export function Profile() {
  const { profile, user, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  
  // Profile form state
  const [formData, setFormData] = useState({
    full_name: '',
    department: '',
    position: '',
    address: '',
    phone: '',
    profile_picture: ''
  })
  
  // Password change form state
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  })

  // Synchronize formData whenever profile changes/loads
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        department: profile.department || '',
        position: profile.position || '',
        address: profile.address || '',
        phone: profile.phone || '',
        profile_picture: profile.profile_picture || ''
      })
    }
  }, [profile])

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    if (!profile?.id) {
      setMessage({ type: 'error', text: 'No active profile found to update.' })
      return
    }

    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          department: formData.department.trim(),
          position: formData.position.trim(),
          address: formData.address.trim(),
          phone: formData.phone.trim(),
          profile_picture: formData.profile_picture
        })
        .eq('id', profile.id)

      if (error) throw error

      if (refreshProfile) {
        await refreshProfile()
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' })
    } catch (error) {
      console.error('Profile update error:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' })
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' })
      setLoading(false)
      return
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (error) throw error

      setMessage({ type: 'success', text: 'Password changed successfully!' })
      setPasswordData({ newPassword: '', confirmPassword: '' })
    } catch (error) {
      console.error('Password change error:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to change password' })
    } finally {
      setLoading(false)
    }
  }

  // Client-side image compression: converts to clean lightweight Data URL
  // Eliminates dependency on unconfigured or paid storage buckets!
  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    setMessage({ type: '', text: '' })

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDimension = 300
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // Compress to JPEG with 85% quality (~20KB)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setFormData(prev => ({ ...prev, profile_picture: compressedDataUrl }))
        setMessage({ type: 'success', text: 'Photo selected! Click "SAVE CHANGES" below to apply it.' })
        setLoading(false)
      }

      img.onerror = () => {
        setMessage({ type: 'error', text: 'Failed to process selected image file.' })
        setLoading(false)
      }

      img.src = event.target.result
    }

    reader.onerror = () => {
      setMessage({ type: 'error', text: 'Failed to read image file.' })
      setLoading(false)
    }

    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Profile Settings</h1>
        <p className="text-gray-600 text-sm mt-1">Manage your account information and preferences</p>
      </div>

      {message.text && (
        <div className={`flex items-center gap-2.5 p-3.5 rounded-md text-xs sm:text-sm font-semibold animate-slide-up ${
          message.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Profile Information Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-5 sm:mb-6 flex items-center gap-2">
          <User className="w-5 h-5 text-primary-600" />
          Personal Information
        </h2>

        <form onSubmit={handleProfileSubmit} className="space-y-5">
          {/* Profile Picture */}
          <div className="flex items-center gap-5 sm:gap-6">
            <div className="relative">
              {formData.profile_picture ? (
                <img
                  src={formData.profile_picture}
                  alt="Profile"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-md object-cover border-2 border-gray-200 shadow-sm"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-md bg-gray-100 flex items-center justify-center border-2 border-gray-200 text-gray-400">
                  <User className="w-10 h-10" />
                </div>
              )}
              <label 
                className="absolute -bottom-1 -right-1 bg-primary-600 text-white p-2 rounded-md cursor-pointer hover:bg-primary-700 transition-colors shadow-md active:scale-95"
                title="Upload Photo"
              >
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 mb-0.5">Profile Picture</p>
              <p className="text-xs text-gray-500">Tap camera icon to select a photo from your device</p>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              placeholder="e.g. Juan Dela Cruz"
              required
            />
          </div>

          {/* Department & Position */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-gray-500" />
                Department / Office
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                placeholder="e.g. Municipal Health Office, Treasury..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-gray-500" />
                Position / Designation
              </label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                placeholder="e.g. Administrative Officer..."
              />
            </div>
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={user?.email || profile?.email || ''}
              disabled
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed text-sm"
            />
            <p className="text-[11px] text-gray-400 mt-1">Email is linked to your login credentials</p>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Address
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              placeholder="Enter your residence / department address"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              Phone / Mobile Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              placeholder="e.g. 0912 345 6789"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-md font-bold text-xs sm:text-sm hover:bg-primary-700 transition-colors disabled:opacity-50 tracking-wide shadow-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {loading ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </form>
      </div>

      {/* Change Password Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-5 sm:mb-6 flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary-600" />
          Change Password
        </h2>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              New Password
            </label>
            <input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              placeholder="Enter new password (min. 6 characters)"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              placeholder="Confirm new password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-md font-bold text-xs sm:text-sm hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed tracking-wide shadow-sm cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            {loading ? 'CHANGING...' : 'CHANGE PASSWORD'}
          </button>
        </form>
      </div>
    </div>
  )
}
