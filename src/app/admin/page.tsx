'use client'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { useDashboardStats, useOrders, useAssignments } from '@/hooks/useRealtime'
import { LoadingCard } from '@/components/ui/Loading'
import { formatCurrency, getStatusColor, getStatusIcon, formatDateTime } from '@/lib/utils'
import { Package, Users, Truck, Bell, TrendingUp, Clock, CheckCircle2 } from 'lucide-react'

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>

function StatCard({ title, value, icon: Icon, change, color = 'blue' }: {
  title: string
  value: string | number
  icon: IconComponent
  change?: string
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
}) {
  const colorClasses = {
    blue: 'bg-blue-500 text-blue-600',
    green: 'bg-green-500 text-green-600',
    yellow: 'bg-yellow-500 text-yellow-600',
    red: 'bg-red-500 text-red-600',
    purple: 'bg-purple-500 text-purple-600',
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className="text-xs text-green-600 mt-1">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              {change}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color].split(' ')[0]} bg-opacity-10`}>
          <Icon className={`h-6 w-6 ${colorClasses[color].split(' ')[1]}`} />
        </div>
      </div>
    </div>
  )
}

function RecentOrders() {
  const { orders, loading } = useOrders()
  const recentOrders = orders.slice(0, 5)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
        <button className="text-sm text-blue-600 hover:text-blue-800">View all</button>
      </div>
      
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <LoadingCard key={i} />)}
        </div>
      ) : (
        <div className="space-y-3">
          {recentOrders.map((order) => (
            <div key={order.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{getStatusIcon(order.order_status)}</div>
                <div>
                  <p className="font-medium text-gray-900">#{order.id}</p>
                  <p className="text-sm text-gray-500">{order.delivery_address}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{formatCurrency(Number(order.total_amount))}</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.order_status)}`}>
                  {order.order_status}
                </span>
              </div>
            </div>
          ))}
          
          {recentOrders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No orders yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RecentAssignments() {
  const { assignments, loading } = useAssignments()
  const recentAssignments = assignments.slice(0, 5)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Assignments</h3>
        <button className="text-sm text-blue-600 hover:text-blue-800">View all</button>
      </div>
      
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <LoadingCard key={i} />)}
        </div>
      ) : (
        <div className="space-y-3">
          {recentAssignments.map((assignment) => (
            <div key={assignment.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="text-2xl">👤</div>
                <div>
                  <p className="font-medium text-gray-900">
                    {assignment.riders?.full_name || 'Unknown Rider'}
                  </p>
                  <p className="text-sm text-gray-500">Order #{assignment.order_id}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(assignment.assignment_status)}`}>
                  {assignment.assignment_status}
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDateTime(assignment.created_at)}
                </p>
              </div>
            </div>
          ))}
          
          {recentAssignments.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No assignments yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const { stats, loading } = useDashboardStats()

  const statCards = [
    {
      title: 'Total Orders',
      value: stats?.total_orders || 0,
      icon: Package,
      color: 'blue' as const,
      change: '+12% this week'
    },
    {
      title: 'Active Riders',
      value: stats?.active_riders || 0,
      icon: Users,
      color: 'green' as const,
      change: '+2 new riders'
    },
    {
      title: 'In Transit',
      value: stats?.in_transit_orders || 0,
      icon: Truck,
      color: 'yellow' as const,
    },
    {
      title: 'Today\'s Revenue',
      value: stats ? formatCurrency(Number(stats.today_revenue)) : '₹0',
      icon: TrendingUp,
      color: 'purple' as const,
      change: '+8% vs yesterday'
    },
  ]

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <LoadingCard />
              </div>
            ))
          ) : (
            statCards.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending Orders</p>
                <p className="text-xl font-bold text-gray-900">{stats?.pending_orders || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Delivered</p>
                <p className="text-xl font-bold text-gray-900">{stats?.delivered_orders || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Users className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Available Riders</p>
                <p className="text-xl font-bold text-gray-900">{stats?.available_riders || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Bell className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Notifications</p>
                <p className="text-xl font-bold text-gray-900">{stats?.unread_notifications || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentOrders />
          <RecentAssignments />
        </div>

        {/* Live Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Live Status</h3>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Real-time updates active</span>
          </div>
          <div className="text-xs text-gray-500">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
