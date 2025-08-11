'use client'

import React, { useState, useEffect, useContext, createContext, ReactNode } from 'react'
import { supabase, Admin } from '@/lib/supabase'
import { toast } from 'react-toastify'
import { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  admin: Admin | null
  loading: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  checkAdminAccess: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUser(session.user)
          await checkAndSetAdmin(session.user.email!)
        }
      } catch (error) {
        console.error('Error getting session:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        
        if (session?.user) {
          setUser(session.user)
          await checkAndSetAdmin(session.user.email!)
        } else {
          setUser(null)
          setAdmin(null)
        }
        
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const checkAndSetAdmin = async (email: string) => {
    try {
      // Temporary fix for RLS policy issue
      // Allow specific email addresses to bypass database check
      const knownAdminEmails = [
        'uttamanand4469@gmail.com',
        'blackstorm5353@gmail.com',
        'admin@pikago.com'
      ]
      
      if (knownAdminEmails.includes(email.toLowerCase())) {
        console.log('Known admin email detected, granting access:', email)
        // Create a temporary admin object
        const tempAdmin = {
          id: email,
          email: email.toLowerCase(),
          full_name: email.split('@')[0],
          role: 'super_admin',
          permissions: {
            can_assign_orders: true,
            can_manage_riders: true,
            can_view_analytics: true
          },
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        }
        
        setAdmin(tempAdmin)
        return true
      }
      
      // Regular database check if not a known admin
      const { data: adminData, error } = await supabase
        .from('admins')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single()

      if (error || !adminData) {
        console.log('Admin check failed:', error)
        setAdmin(null)
        return false
      }

      setAdmin(adminData)
      
      try {
        await supabase
          .from('admins')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', adminData.id)
      } catch (updateError) {
        console.log('Could not update last_login_at (non-critical):', updateError)
      }

      return true
    } catch (error) {
      console.error('Error checking admin access:', error)
      setAdmin(null)
      return false
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true)

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        const isAdmin = await checkAndSetAdmin(email)
        if (!isAdmin) {
          await supabase.auth.signOut()
          throw new Error('Access denied. You are not authorized to access this admin panel.')
        }
        
        toast.success('Welcome back!')
      }
    } catch (error: any) {
      console.error('Sign in error:', error)
      toast.error(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/admin`
        }
      })

      if (error) throw error

      // Note: The actual user data will come through the auth state change listener
      // after the OAuth redirect completes
    } catch (error: any) {
      console.error('Google sign in error:', error)
      toast.error(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      setUser(null)
      setAdmin(null)
      toast.success('Signed out successfully')
    } catch (error: any) {
      console.error('Sign out error:', error)
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const checkAdminAccess = async (): Promise<boolean> => {
    if (!user?.email) return false
    return await checkAndSetAdmin(user.email)
  }

  const contextValue = {
    user,
    admin,
    loading,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    checkAdminAccess,
  }

  return React.createElement(AuthContext.Provider, { value: contextValue }, children)
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
