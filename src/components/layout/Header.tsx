'use client'

import { useState } from 'react'
import { Menu, Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title: string
  onMenuClick?: () => void
  isMenuOpen?: boolean
  children?: React.ReactNode
}

export function Header({ title, onMenuClick, isMenuOpen = false, children }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false)

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden"
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {children}
        
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center text-xs text-white">
              3
            </span>
          </Button>
          
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Notifications</h3>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                <div className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">New order received</p>
                      <p className="text-xs text-gray-500 mt-1">Order #iron_order_123 needs assignment</p>
                      <p className="text-xs text-gray-400 mt-1">2 minutes ago</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Order assigned</p>
                      <p className="text-xs text-gray-500 mt-1">PKG001 assigned to order #iron_order_123</p>
                      <p className="text-xs text-gray-400 mt-1">5 minutes ago</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Rider unavailable</p>
                      <p className="text-xs text-gray-500 mt-1">PKG002 marked as unavailable</p>
                      <p className="text-xs text-gray-400 mt-1">10 minutes ago</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-gray-200">
                <Button variant="ghost" size="sm" className="w-full">
                  View all notifications
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
