'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, Order, OrderAssignment, Rider, Notification, DashboardStats } from '@/lib/supabase'
import { toast } from 'react-toastify'
import { RealtimeChannel } from '@supabase/supabase-js'

export function useRealtime() {
  const channelsRef = useRef<RealtimeChannel[]>([])

  // fix: Replace any with proper payload type
  const subscribeToOrders = (callback: (payload: { eventType: string; new: any; old?: any }) => void) => {
    const channel = supabase
      .channel('orders-channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
      }, (payload) => {
        console.log('Orders change:', payload)
        
        // Show toast notifications for new orders
        if (payload.eventType === 'INSERT') {
          toast.success(`🆕 New order received: ${payload.new.id}`)
        } else if (payload.eventType === 'UPDATE' && payload.old?.order_status !== payload.new?.order_status) {
          toast.info(`📋 Order ${payload.new.id} status: ${payload.new.order_status}`)
        }
        
        callback(payload)
      })
      .subscribe()

    channelsRef.current.push(channel)
    return channel
  }

  const subscribeToAssignments = (callback: (payload: { eventType: string; new: any; old?: any }) => void) => {
    const channel = supabase
      .channel('assignments-channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_assignments'
      }, (payload) => {
        console.log('Assignment change:', payload)
        
        // Show toast notifications for assignment changes
        if (payload.eventType === 'INSERT') {
          toast.success(`👤 Order ${payload.new.order_id} assigned to rider`)
        } else if (payload.eventType === 'UPDATE' && payload.old?.assignment_status !== payload.new?.assignment_status) {
          const statusEmojis: Record<string, string> = {
            'accepted': '✅',
            'picked_up': '📦',
            'in_transit': '🚚',
            'delivered': '✨',
            'cancelled': '❌',
            'failed': '⚠️'
          }
          const emoji = statusEmojis[payload.new.assignment_status] || '📋'
          toast.info(`${emoji} Assignment ${payload.new.order_id}: ${payload.new.assignment_status}`)
        }
        
        callback(payload)
      })
      .subscribe()

    channelsRef.current.push(channel)
    return channel
  }

  const subscribeToRiders = (callback: (payload: { eventType: string; new: any; old?: any }) => void) => {
    const channel = supabase
      .channel('riders-channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'riders'
      }, (payload) => {
        console.log('Rider change:', payload)
        
        // Show toast notifications for rider changes
        if (payload.eventType === 'INSERT') {
          toast.success(`🏍️ New rider added: ${payload.new.full_name}`)
        } else if (payload.eventType === 'UPDATE' && payload.old?.is_available !== payload.new?.is_available) {
          const status = payload.new.is_available ? 'available' : 'unavailable'
          toast.info(`👤 ${payload.new.full_name} is now ${status}`)
        }
        
        callback(payload)
      })
      .subscribe()

    channelsRef.current.push(channel)
    return channel
  }

  const subscribeToNotifications = (callback: (payload: { eventType: string; new: any; old?: any }) => void) => {
    const channel = supabase
      .channel('notifications-channel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: 'recipient_type=eq.admin'
      }, (payload) => {
        console.log('New notification:', payload)
        
        const notification = payload.new as Notification
        
        // Show toast based on priority
        const toastOptions = {
          autoClose: notification.priority === 'urgent' ? false : 5000,
        }
        
        switch (notification.priority) {
          case 'urgent':
            toast.error(`🚨 ${notification.title}: ${notification.message}`, toastOptions)
            break
          case 'high':
            toast.warn(`⚠️ ${notification.title}: ${notification.message}`, toastOptions)
            break
          case 'medium':
            toast.info(`📋 ${notification.title}: ${notification.message}`, toastOptions)
            break
          default:
            toast.info(`💬 ${notification.title}: ${notification.message}`, toastOptions)
            break
        }
        
        callback(payload)
      })
      .subscribe()

    channelsRef.current.push(channel)
    return channel
  }

  const cleanup = () => {
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel)
    })
    channelsRef.current = []
  }

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [])

  return {
    subscribeToOrders,
    subscribeToAssignments,
    subscribeToRiders,
    subscribeToNotifications,
    cleanup,
  }
}

// Hook for fetching and auto-updating dashboard stats
export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { subscribeToOrders, subscribeToAssignments } = useRealtime()

  const fetchStats = async () => {
    try {
      // fix: Check if Supabase client is properly configured
      if (!supabase) {
        console.error('Supabase client is not configured')
        setLoading(false)
        return
      }

      // fix: Calculate stats from orders table, include created_at for today_orders
      const { data: orders, error } = await supabase
        .from('orders')
        .select('order_status, created_at')

      if (error) {
        console.error('Error fetching orders for stats:', error)
        // fix: Use correct DashboardStats interface properties
        setStats({
          total_orders: 0,
          pending_orders: 0,
          assigned_orders: 0,
          in_transit_orders: 0,
          delivered_orders: 0,
          active_riders: 0,
          available_riders: 0,
          unread_notifications: 0,
          today_revenue: '0',
          today_orders: 0
        })
        return
      }

      // fix: Calculate stats from orders to match DashboardStats interface
      const statsFromOrders = {
        total_orders: orders?.length || 0,
        pending_orders: orders?.filter(o => o.order_status === 'pending' || o.order_status === 'confirmed').length || 0,
        assigned_orders: orders?.filter(o => o.order_status === 'accepted').length || 0,
        in_transit_orders: orders?.filter(o => o.order_status === 'in_transit').length || 0,
        delivered_orders: orders?.filter(o => o.order_status === 'delivered').length || 0,
        active_riders: 0, // No riders table
        available_riders: 0,
        unread_notifications: 0, // No notifications count
        today_revenue: '0', // No revenue calculation
        today_orders: orders?.filter(o => {
          const today = new Date().toISOString().split('T')[0]
          return o.created_at.startsWith(today)
        }).length || 0
      }

      setStats(statsFromOrders)
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()

    // Subscribe to changes that affect stats
    const ordersChannel = subscribeToOrders(() => {
      fetchStats()
    })

    const assignmentsChannel = subscribeToAssignments(() => {
      fetchStats()
    })

    return () => {
      supabase.removeChannel(ordersChannel)
      supabase.removeChannel(assignmentsChannel)
    }
  }, [])

  return { stats, loading, refetch: fetchStats }
}

// Hook for fetching and auto-updating orders
export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const { subscribeToOrders } = useRealtime()

  const fetchOrders = async () => {
    try {
      // fix: Check if Supabase client is properly configured
      if (!supabase) {
        console.error('Supabase client is not configured')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching orders:', error)
        return
      }

      setOrders(data || [])
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()

    // Subscribe to realtime changes
    const channel = subscribeToOrders((payload) => {
      if (payload.eventType === 'INSERT') {
        setOrders(prev => [payload.new, ...prev])
      } else if (payload.eventType === 'UPDATE') {
        setOrders(prev => 
          prev.map(order => 
            order.id === payload.new.id ? payload.new : order
          )
        )
      } else if (payload.eventType === 'DELETE') {
        setOrders(prev => prev.filter(order => order.id !== payload.old.id))
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { orders, loading, refetch: fetchOrders }
}

// Hook for fetching and auto-updating assignments
export function useAssignments() {
  const [assignments, setAssignments] = useState<OrderAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const { subscribeToAssignments } = useRealtime()

  const fetchAssignments = async () => {
    try {
      // Since order_assignments table doesn't exist, return empty array
      console.warn('order_assignments table does not exist, returning empty assignments')
      setAssignments([])
    } catch (error) {
      console.error('Error fetching assignments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAssignments()

    // Subscribe to realtime changes
    const channel = subscribeToAssignments((payload) => {
      // Refetch when assignments change to get joined data
      fetchAssignments()
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { assignments, loading, refetch: fetchAssignments }
}

// Hook for fetching and auto-updating riders
export function useRiders() {
  const [riders, setRiders] = useState<Rider[]>([])
  const [loading, setLoading] = useState(true)
  const { subscribeToRiders } = useRealtime()

  const fetchRiders = async () => {
    try {
      // Since riders table doesn't exist, return empty array
      console.warn('riders table does not exist, returning empty riders')
      setRiders([])
    } catch (error) {
      console.error('Error fetching riders:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRiders()

    // Subscribe to realtime changes
    const channel = subscribeToRiders((payload) => {
      if (payload.eventType === 'INSERT') {
        setRiders(prev => [payload.new, ...prev])
      } else if (payload.eventType === 'UPDATE') {
        setRiders(prev => 
          prev.map(rider => 
            rider.id === payload.new.id ? payload.new : rider
          )
        )
      } else if (payload.eventType === 'DELETE') {
        setRiders(prev => prev.filter(rider => rider.id !== payload.old.id))
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { riders, loading, refetch: fetchRiders }
}
