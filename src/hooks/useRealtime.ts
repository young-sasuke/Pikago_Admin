'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-toastify'
import type { RealtimeChannel } from '@supabase/supabase-js'

/* ---------- Local types (kept minimal on purpose) ---------- */
type DBOrder = {
  id: string
  order_status: string
  created_at: string
  total_amount?: number | string | null
}

type DBAssignedOrder = {
  id: string
  order_id: string
  status?: string | null
  created_at?: string | null
}

export type UIRider = {
  id: string           // users.id
  full_name: string
  phone: string | null
  is_active: boolean
  created_at: string
  // you can add optional fields later if your UI needs them
}

export type UIDashboardStats = {
  total_orders: number
  pending_orders: number
  assigned_orders: number
  in_transit_orders: number
  delivered_orders: number
  active_riders: number
  available_riders: number
  unread_notifications: number
  today_revenue: string
  today_orders: number
}

/* Supabase realtime payload shape (simplified) */
type PgPayload<T = any> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T
  old?: T
}

export function useRealtime() {
  const channelsRef = useRef<RealtimeChannel[]>([])

  /* ORDERS realtime */
  const subscribeToOrders = (callback: (payload: PgPayload<DBOrder>) => void) => {
    const channel = supabase
      .channel('orders-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            toast.success(`🆕 New order received: ${payload.new?.id ?? '—'}`)
          } else if (
            payload.eventType === 'UPDATE' &&
            payload.old?.order_status !== payload.new?.order_status
          ) {
            toast.info(`📋 Order ${payload.new?.id ?? '—'} status: ${payload.new.order_status}`)
          }
          callback(payload)
        }
      )
      .subscribe()

    channelsRef.current.push(channel)
    return channel
  }

  /* ASSIGNMENTS realtime (assigned_orders) */
  const subscribeToAssignments = (callback: (payload: PgPayload<DBAssignedOrder>) => void) => {
    const channel = supabase
      .channel('assigned-orders-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assigned_orders' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            toast.success(`👤 Order ${payload.new?.order_id ?? '—'} assigned`)
          } else if (payload.eventType === 'UPDATE' && payload.old?.status !== payload.new?.status) {
            const m = payload.new?.status ?? 'updated'
            const emojiMap: Record<string, string> = {
              assigned: '✅',
              picked_up: '📦',
              in_transit: '🚚',
              delivered: '✨',
              completed: '🏁',
              cancelled: '❌',
              failed: '⚠️',
            }
            toast.info(`${emojiMap[m] || '📋'} Assignment ${payload.new?.order_id ?? '—'}: ${m}`)
          }
          callback(payload)
        }
      )
      .subscribe()

    channelsRef.current.push(channel)
    return channel
  }

  /* RIDERS realtime (delivery_partners) */
  const subscribeToRiders = (callback: (payload: PgPayload<any>) => void) => {
    const channel = supabase
      .channel('delivery-partners-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_partners' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const name = [payload.new?.first_name, payload.new?.last_name].filter(Boolean).join(' ') || 'New rider'
            toast.success(`🏍️ New rider added: ${name}`)
          } else if (
            payload.eventType === 'UPDATE' &&
            payload.old?.is_available !== payload.new?.is_available
          ) {
            const name = [payload.new?.first_name, payload.new?.last_name].filter(Boolean).join(' ') || 'Rider'
            const status = payload.new?.is_available ? 'available' : 'unavailable'
            toast.info(`👤 ${name} is now ${status}`)
          }
          callback(payload)
        }
      )
      .subscribe()

    channelsRef.current.push(channel)
    return channel
  }

  /* NOTIFICATIONS realtime (optional; uses recipient='admin') */
  const subscribeToNotifications = (callback: (payload: PgPayload<any>) => void) => {
    const channel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'recipient=eq.admin', // adjust if your column differs
        },
        (payload: any) => {
          const n = payload.new || {}
          const title = n.title ?? 'Notification'
          const body = n.body ?? ''
          toast.info(`💬 ${title}${body ? `: ${body}` : ''}`)
          callback(payload)
        }
      )
      .subscribe()

    channelsRef.current.push(channel)
    return channel
  }

  const cleanup = () => {
    channelsRef.current.forEach((channel) => {
      supabase.removeChannel(channel)
    })
    channelsRef.current = []
  }

  useEffect(() => {
    return () => cleanup()
  }, [])

  return {
    subscribeToOrders,
    subscribeToAssignments,
    subscribeToRiders,
    subscribeToNotifications,
    cleanup,
  }
}

/* ===========================
   Dashboard Stats (live)
   =========================== */
export function useDashboardStats() {
  const [stats, setStats] = useState<UIDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { subscribeToOrders, subscribeToAssignments, subscribeToRiders } = useRealtime()

  const fetchStats = async () => {
    try {
      // Orders for counts + today metrics
      const { data: orders } = await supabase
        .from('orders')
        .select('order_status, created_at, total_amount')

      // Riders (delivery_partners) for active/available counts
      const { data: partners } = await supabase
        .from('delivery_partners')
        .select('is_active, is_available')

      const o = orders ?? []
      const today = new Date().toISOString().split('T')[0]

      const total_orders = o.length
      const pending_orders = o.filter((x: any) => x.order_status === 'pending' || x.order_status === 'confirmed').length
      const assigned_orders = o.filter((x: any) => x.order_status === 'assigned').length
      const in_transit_orders = o.filter((x: any) => x.order_status === 'in_transit').length
      const delivered_orders = o.filter((x: any) => x.order_status === 'delivered' || x.order_status === 'completed').length
      const today_orders = o.filter((x: any) => String(x.created_at).startsWith(today)).length
      const today_revenue = o
        .filter((x: any) => String(x.created_at).startsWith(today))
        .reduce((sum: number, x: any) => sum + Number(x.total_amount ?? 0), 0)
        .toFixed(0)

      const p = partners ?? []
      const active_riders = p.filter((r: any) => r.is_active === true).length
      const available_riders = p.filter((r: any) => r.is_available === true).length

      setStats({
        total_orders,
        pending_orders,
        assigned_orders,
        in_transit_orders,
        delivered_orders,
        active_riders,
        available_riders,
        unread_notifications: 0, // wire this up later if you add a 'read' flag
        today_revenue,
        today_orders,
      })
    } catch (e) {
      console.error('Dashboard stats error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const chOrders = subscribeToOrders(() => fetchStats())
    const chAssigned = subscribeToAssignments(() => fetchStats())
    const chRiders = subscribeToRiders(() => fetchStats())
    return () => {
      supabase.removeChannel(chOrders)
      supabase.removeChannel(chAssigned)
      supabase.removeChannel(chRiders)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { stats, loading, refetch: fetchStats }
}

/* ===========================
   Orders (live)
   =========================== */
export function useOrders() {
  const [orders, setOrders] = useState<DBOrder[]>([])
  const [loading, setLoading] = useState(true)
  const { subscribeToOrders } = useRealtime()

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
      if (error) return
      setOrders((data as DBOrder[]) || [])
    } catch (e) {
      console.error('Error fetching orders:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    const channel = subscribeToOrders((payload) => {
      if (payload.eventType === 'INSERT') {
        setOrders((prev) => [payload.new as DBOrder, ...prev])
      } else if (payload.eventType === 'UPDATE') {
        setOrders((prev) => prev.map((o) => (o.id === payload.new.id ? (payload.new as DBOrder) : o)))
      } else if (payload.eventType === 'DELETE') {
        setOrders((prev) => prev.filter((o) => o.id !== payload.old?.id))
      }
    })
    return () => {
      supabase.removeChannel(channel)
    }
  }, []) // eslint-disable-line

  return { orders, loading, refetch: fetchOrders }
}

/* ===========================
   Assignments (live)
   =========================== */
export function useAssignments() {
  const [assignments, setAssignments] = useState<DBAssignedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const { subscribeToAssignments } = useRealtime()

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase.from('assigned_orders').select('*').order('created_at', { ascending: false })
      if (error) return
      setAssignments((data as DBAssignedOrder[]) || [])
    } catch (e) {
      console.error('Error fetching assigned_orders:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAssignments()
    const channel = subscribeToAssignments(() => fetchAssignments())
    return () => {
      supabase.removeChannel(channel)
    }
  }, []) // eslint-disable-line

  return { assignments, loading, refetch: fetchAssignments }
}

/* ===========================
   Riders (live) -> delivery_partners + users
   =========================== */
export function useRiders() {
  const [riders, setRiders] = useState<UIRider[]>([])
  const [loading, setLoading] = useState(true)
  const { subscribeToRiders } = useRealtime()

  const fetchRiders = async () => {
    try {
      // Join delivery_partners -> users for phone/email; this can be empty on client if RLS blocks users.
      const { data, error } = await supabase
        .from('delivery_partners')
        .select(`
          user_id,
          first_name,
          last_name,
          is_active,
          created_at,
          users:users!inner(id, phone)
        `)
        .eq('is_active', true)
        .order('first_name', { ascending: true })

      if (error) return

      const mapped: UIRider[] = (data ?? []).map((r: any) => ({
        id: String(r.users?.id ?? r.user_id),
        full_name: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'Unnamed',
        phone: r.users?.phone ?? null,
        is_active: !!r.is_active,
        created_at: r.created_at ?? new Date().toISOString(),
      }))

      setRiders(mapped)
    } catch (e) {
      console.error('Error fetching riders:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRiders()
    const channel = subscribeToRiders(() => fetchRiders())
    return () => {
      supabase.removeChannel(channel)
    }
  }, []) // eslint-disable-line

  return { riders, loading, refetch: fetchRiders }
}
