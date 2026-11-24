import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { UserPlus, Eye, EyeOff, AlertCircle, CheckCircle, Building2, Briefcase } from 'lucide-react'

export function Register() {
  const [fullName, setFullName] = useState('')
  const [department, setDepartment] = useState('')
  const [position, setPosition] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const { error } = await signUp(email, password, fullName, department.trim(), position.trim())
      if (error) throw error
      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (error) {
      setError(error.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-3 sm:p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 sm:p-8">
          <div className="text-center mb-6 sm:mb-8">
            <Link to="/" className="inline-block group mb-3">
              <img
                src="/Municipality of Malimono Seal.png"
                alt="Municipality of Malimono Seal"
                className="w-20 h-20 sm:w-24 sm:h-24 mx-auto object-contain drop-shadow-md transition-transform group-hover:scale-105"
              />
            </Link>
            <p className="text-xs font-bold text-primary-700 uppercase tracking-wider mb-1">
              Municipality of Malimono
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Create Account</h1>
            <p className="text-gray-600 text-xs sm:text-sm mt-1">Register to get your QR code</p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-rose-700 font-medium">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-md flex items-start gap-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-emerald-700 font-medium">
                Account created successfully! It will be activated once an admin approves it. Redirecting to login...
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label htmlFor="fullName" className="block text-xs font-semibold text-gray-700 mb-1.5">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
                placeholder="e.g. Clifford Epis"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div>
                <label htmlFor="department" className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                  <Building2 size={13} className="text-gray-500" /> Department / Office
                </label>
                <input
                  id="department"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
                  placeholder="e.g. Treasury Office, RHU..."
                />
              </div>

              <div>
                <label htmlFor="position" className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                  <Briefcase size={13} className="text-gray-500" /> Position / Designation
                </label>
                <input
                  id="position"
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
                  placeholder="e.g. Administrative Officer..."
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors pr-11 text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold text-gray-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors pr-11 text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-2.5 px-4 rounded-md font-bold text-xs sm:text-sm hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm tracking-wide"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  CREATING ACCOUNT...
                </>
              ) : (
                'CREATE ACCOUNT'
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-bold hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
