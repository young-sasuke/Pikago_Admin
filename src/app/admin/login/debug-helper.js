'use client'

/**
 * Google OAuth Debug Helper
 * 
 * This component helps debug the Google OAuth flow by showing
 * the current OAuth state and validation checks.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function OAuthDebugHelper() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [oauthConfig, setOauthConfig] = useState({
    provider: null,
    redirect: null,
    error: null
  })
  const [adminCheck, setAdminCheck] = useState({
    email: null,
    isAdmin: false,
    details: null,
    error: null
  })

  useEffect(() => {
    // Check current session
    async function checkSession() {
      try {
        setLoading(true)
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        setSession(currentSession)
        
        // If we have a user, check admin status
        if (currentSession?.user?.email) {
          await checkAdminStatus(currentSession.user.email)
        }
      } catch (error) {
        console.error('Session check error:', error)
      } finally {
        setLoading(false)
      }
    }
    
    checkSession()
  }, [])
  
  // Function to check admin status
  async function checkAdminStatus(email) {
    try {
      setAdminCheck(prev => ({ ...prev, email, loading: true }))
      
      // Check against known admin emails
      const knownAdminEmails = [
        'uttamanand4469@gmail.com',
        'blackstorm5353@gmail.com',
        'admin@pikago.com'
      ]
      
      if (knownAdminEmails.includes(email.toLowerCase())) {
        setAdminCheck({ 
          email,
          loading: false,
          isAdmin: true,
          details: {
            email: email.toLowerCase(),
            full_name: email.split('@')[0],
            role: 'super_admin',
            permissions: {
              can_assign_orders: true,
              can_manage_riders: true,
              can_view_analytics: true
            }
          },
          error: null
        })
        return
      }
      
      // Try database check for other emails
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single()
        
      if (error) {
        setAdminCheck(prev => ({ 
          ...prev, 
          loading: false,
          isAdmin: false,
          error: error.message
        }))
        return
      }
      
      setAdminCheck({ 
        email,
        loading: false,
        isAdmin: !!data,
        details: data,
        error: null
      })
      
    } catch (error) {
      setAdminCheck(prev => ({ 
        ...prev, 
        loading: false,
        isAdmin: false,
        error: error.message
      }))
    }
  }
  
  // Test OAuth configuration
  async function testOAuthFlow() {
    try {
      setOauthConfig({ provider: 'google', redirect: 'loading...', error: null })
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/admin`,
          skipBrowserRedirect: true
        }
      })
      
      if (error) throw error
      
      setOauthConfig({ 
        provider: 'google', 
        redirect: data?.url || 'No URL returned',
        error: null
      })
      
    } catch (error) {
      console.error('OAuth test error:', error)
      setOauthConfig({ 
        provider: 'google', 
        redirect: null,
        error: error.message
      })
    }
  }
  
  // Manual check for specific email
  async function checkEmail(e) {
    e.preventDefault()
    const email = document.getElementById('debug-email').value
    if (!email) return
    
    await checkAdminStatus(email)
  }
  
  // Sign out for testing
  async function handleSignOut() {
    try {
      await supabase.auth.signOut()
      setSession(null)
      setAdminCheck({
        email: null,
        isAdmin: false,
        details: null,
        error: null
      })
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  if (loading) return <div className="p-4 bg-blue-50 rounded-lg">Loading...</div>

  return (
    <div className="p-4 bg-blue-50 rounded-lg text-sm">
      <h3 className="font-bold text-blue-800 mb-2">OAuth Debug Helper</h3>
      
      <div className="mb-4">
        <h4 className="font-semibold">Current Session:</h4>
        {session ? (
          <div>
            <p>✅ Logged in as: {session.user.email}</p>
            <button 
              onClick={handleSignOut}
              className="text-xs bg-blue-500 text-white px-2 py-1 rounded mt-1"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <p>❌ No active session</p>
        )}
      </div>
      
      <div className="mb-4">
        <h4 className="font-semibold">Admin Status:</h4>
        {adminCheck.email ? (
          <div>
            <p>Email: {adminCheck.email}</p>
            {adminCheck.isAdmin ? (
              <div>
                <p className="text-green-600">✅ Valid admin account</p>
                <p>Role: {adminCheck.details?.role || 'unknown'}</p>
              </div>
            ) : (
              <div>
                <p className="text-red-600">❌ Not an admin account</p>
                {adminCheck.error && <p>Error: {adminCheck.error}</p>}
              </div>
            )}
          </div>
        ) : (
          <p>No admin check performed</p>
        )}
      </div>
      
      <div className="mb-4">
        <h4 className="font-semibold">Test Email Admin Access:</h4>
        <form onSubmit={checkEmail} className="flex gap-2 mt-1">
          <input 
            id="debug-email"
            type="email" 
            className="px-2 py-1 border rounded text-xs flex-grow"
            placeholder="Enter email to check"
          />
          <button 
            type="submit"
            className="text-xs bg-blue-500 text-white px-2 py-1 rounded"
          >
            Check
          </button>
        </form>
      </div>
      
      <div className="mb-4">
        <h4 className="font-semibold">Test OAuth Configuration:</h4>
        <button 
          onClick={testOAuthFlow}
          className="text-xs bg-blue-500 text-white px-2 py-1 rounded mt-1"
        >
          Test Google OAuth
        </button>
        
        {oauthConfig.provider && (
          <div className="mt-2 text-xs">
            <p>Provider: {oauthConfig.provider}</p>
            {oauthConfig.error ? (
              <p className="text-red-600">Error: {oauthConfig.error}</p>
            ) : (
              <p className="text-xs">
                Redirect URL: {oauthConfig.redirect ? (
                  <span className="font-mono break-all">{oauthConfig.redirect}</span>
                ) : 'None'}
              </p>
            )}
          </div>
        )}
      </div>
      
      <p className="text-xs text-gray-600">This helper is for debugging purposes only and should be removed in production.</p>
    </div>
  )
}
