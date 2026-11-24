import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    try {
      console.log('Fetching profile for user:', userId)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) {
        console.error('Profile fetch error:', error)
        throw error
      }
      console.log('Profile fetched:', data)
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email, password, fullName, department = '', position = '') => {
    // First, sign up the user with email confirmation disabled
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          department: department,
          position: position,
        },
        emailRedirectTo: undefined,
      },
    })

    if (error) return { data, error }

    // If signup successful, create the profile
    if (data.user) {
      const qrToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      const profilePayload = {
        id: data.user.id,
        full_name: fullName,
        email: email,
        role: 'user',
        qr_token: qrToken,
        department: department || '',
        position: position || '',
      }

      let { error: profileError } = await supabase
        .from('profiles')
        .insert(profilePayload)

      // Fallback in case department/position columns haven't been added to PostgreSQL yet
      if (profileError && (profileError.message?.includes('department') || profileError.message?.includes('position') || profileError.code === 'PGRST204')) {
        const fallbackPayload = {
          id: data.user.id,
          full_name: fullName,
          email: email,
          role: 'user',
          qr_token: qrToken,
        }
        const fallbackRes = await supabase.from('profiles').insert(fallbackPayload)
        profileError = fallbackRes.error
      }

      if (profileError) {
        console.error('Profile creation error:', profileError)
        return { data, error: profileError }
      }
    }

    return { data, error }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
  }

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id)
    }
  }

  const value = {
    user,
    profile,
    loading,
    refreshProfile,
    signUp,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
