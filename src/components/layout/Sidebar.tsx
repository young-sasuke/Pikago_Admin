'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home,
  Package,
  Users,
  UserCheck,
  Settings,
  Bell,
  LogOut,
  Truck,
  Database,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'

const navigation = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: Home,
  },
  {
    name: 'Orders',
    href: '/admin/orders',
    icon: Package,
  },
  {
    name: 'Assignments',
    href: '/admin/assignments',
    icon: Truck,
  },
  {
    name: 'Riders',
    href: '/admin/riders',
    icon: UserCheck,
  },
  {
    name: 'Notifications',
    href: '/admin/notifications',
    icon: Bell,
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: Settings,
  },
]

interface SidebarProps {
  isCollapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ isCollapsed = false }: SidebarProps) {
  const pathname = usePathname()
  const { admin, signOut } = useAuth()

  return (
    <div
      className={cn(
        'fixed left-0 top-0 z-40 h-full bg-gray-900 text-white transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Truck className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold">Pikago</h1>
              <p className="text-xs text-gray-400">Admin Panel</p>
            </div>
          )}
        </div>
      </div>

      {/* Admin Info */}
      {!isCollapsed && admin && (
        <div className="border-b border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{admin.full_name}</p>
              <p className="truncate text-xs text-gray-400">{admin.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Sign Out */}
      <div className="border-t border-gray-700 p-4">
        <Button
          variant="ghost"
          onClick={signOut}
          className={cn(
            'w-full justify-start text-gray-300 hover:bg-gray-800 hover:text-white',
            isCollapsed && 'justify-center'
          )}
          title={isCollapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span className="ml-3">Sign Out</span>}
        </Button>
      </div>
    </div>
  )
}
