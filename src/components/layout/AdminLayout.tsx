'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAuth } from '@/hooks/useAuth'
import { LoadingPage } from '@/components/ui/Loading'
import { cn } from '@/lib/utils'

interface AdminLayoutProps {
  children: React.ReactNode
  title?: string
  headerActions?: React.ReactNode
}

export function AdminLayout({ children, title = 'Dashboard', headerActions }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const { user, admin, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/admin/login')
    } else if (!loading && user && !admin) {
      // User is logged in but not an admin
      router.push('/admin/login')
    }
  }, [user, admin, loading, router])

  if (!isMounted || loading) {
    return <LoadingPage />
  }

  if (!user || !admin) {
    return <LoadingPage />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed left-0 top-0 z-40 lg:relative lg:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="lg:ml-64">
        <Header
          title={title}
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
          isMenuOpen={isSidebarOpen}
        >
          {headerActions}
        </Header>

        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
