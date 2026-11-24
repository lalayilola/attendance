import { Link } from 'react-router-dom'
import { QrCode, Clock, Shield, Smartphone, ArrowRight, CheckCircle } from 'lucide-react'

export function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src="/malimono bg.jpg" 
            alt="Malimono Background" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary-900/90 to-primary-800/85"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-8">
              <Shield className="w-5 h-5 text-white" />
              <span className="text-white text-sm font-medium">Secure & Efficient</span>
            </div>
            
            <img 
              src="/Municipality of Malimono Seal.png" 
              alt="Municipality of Malimono Logo" 
              className="w-32 h-32 sm:w-40 sm:h-40 mx-auto mb-8 object-contain drop-shadow-lg"
            />
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              MUNICIPALITY OF MALIMONO
            </h1>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-primary-100 mb-8">
              QR - BASED ATTENDANCE MONITORING SYSTEM
            </h2>
            
            <p className="text-lg sm:text-xl text-primary-100 max-w-3xl mx-auto mb-12">
              Modern attendance tracking powered by QR code technology. Fast, accurate, and hassle-free time management for the Municipality of Malimono.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 bg-white text-primary-600 px-8 py-4 rounded-xl font-semibold hover:bg-primary-50 transition-all transform hover:scale-105 shadow-lg"
              >
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 bg-primary-700 text-white px-8 py-4 rounded-xl font-semibold hover:bg-primary-800 transition-all transform hover:scale-105 border-2 border-primary-500"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Why Choose Our System?
          </h3>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Experience the future of attendance management with cutting-edge QR technology
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center mb-6">
              <QrCode className="w-7 h-7 text-primary-600" />
            </div>
            <h4 className="text-xl font-semibold text-gray-900 mb-3">Unique QR Codes</h4>
            <p className="text-gray-600">
              Each user receives a unique, secure QR code that serves as their digital identity for attendance tracking.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-6">
              <Clock className="w-7 h-7 text-green-600" />
            </div>
            <h4 className="text-xl font-semibold text-gray-900 mb-3">Real-Time Tracking</h4>
            <p className="text-gray-600">
              Instant time-in and time-out recording with accurate timestamps in Philippine Standard Time.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
              <Smartphone className="w-7 h-7 text-blue-600" />
            </div>
            <h4 className="text-xl font-semibold text-gray-900 mb-3">Mobile Friendly</h4>
            <p className="text-gray-600">
              Access your dashboard, view QR codes, and check attendance history from any device.
            </p>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Simple, fast, and efficient attendance tracking in three easy steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                1
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">Register</h4>
              <p className="text-gray-600">
                Create your account and receive your unique QR code instantly
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                2
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">Scan</h4>
              <p className="text-gray-600">
                Present your QR code to the scanner for time-in or time-out
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                3
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">Track</h4>
              <p className="text-gray-600">
                View your complete attendance history anytime from your dashboard
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Key Benefits
            </h3>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-300 flex-shrink-0 mt-1" />
              <div>
                <h5 className="text-white font-semibold mb-1">Fast & Accurate</h5>
                <p className="text-primary-100 text-sm">Instant attendance recording</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-300 flex-shrink-0 mt-1" />
              <div>
                <h5 className="text-white font-semibold mb-1">Secure System</h5>
                <p className="text-primary-100 text-sm">Encrypted QR tokens</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-300 flex-shrink-0 mt-1" />
              <div>
                <h5 className="text-white font-semibold mb-1">Easy to Use</h5>
                <p className="text-primary-100 text-sm">User-friendly interface</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-300 flex-shrink-0 mt-1" />
              <div>
                <h5 className="text-white font-semibold mb-1">24/7 Access</h5>
                <p className="text-primary-100 text-sm">View records anytime</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Ready to Get Started?
          </h3>
          <p className="text-lg text-gray-600 mb-8">
            Join the modern attendance system today and experience hassle-free time tracking
          </p>
          <Link
            to="/register"
            className="inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-primary-700 transition-all transform hover:scale-105 shadow-lg"
          >
            Create Your Account
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            © 2024 Municipality of Malimono. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
