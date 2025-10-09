'use client'

import React, { useContext, createContext, ReactNode } from 'react'

/** Minimal Admin type compatible with your UI needs */
type Admin = {
  id: string
  email: string
  full_name: string
  role: 'super_admin' | 'manager' | string
  permissions: {
    can_assign_orders: boolean
    can_manage_riders: boolean
    can_view_analytics: boolean
    [key: string]: any
  }
  is_active: boolean
  created_at?: string
  updated_at?: string
  last_login_at?: string
}

interface AuthContextType {
  user: Record<string, unknown> | null
  admin: Admin | null
  loading: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  checkAdminAccess: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/** No-auth provider: always provides a super_admin + loading=false */
export function AuthProvider({ children }: { children: ReactNode }) {
  const admin: Admin = {
    id: 'no-auth',
    email: 'admin@pikago.local',
    full_name: 'Pikago Admin',
    role: 'super_admin',
    permissions: {
      can_assign_orders: true,
      can_manage_riders: true,
      can_view_analytics: true,
    },
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_login_at: new Date().toISOString(),
  }

  const value: AuthContextType = {
    user: {}, // non-null to indicate “signed in”
    admin,
    loading: false,
    signInWithEmail: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {},
    checkAdminAccess: async () => true,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
