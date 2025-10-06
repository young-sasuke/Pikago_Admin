// src/lib/utils.ts

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(timeString: string): string {
  if (!timeString) return '-'
  try {
    let date: Date
    if (timeString.includes('T')) {
      date = new Date(timeString)
    } else if (timeString.includes(':')) {
      const [hours, minutes] = timeString.split(':')
      date = new Date()
      date.setHours(parseInt(hours), parseInt(minutes), 0, 0)
    } else {
      return timeString
    }
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return timeString
  }
}

/* ---------- helpers ---------- */
const lower = (s?: string | null) => (typeof s === 'string' ? s.toLowerCase() : '')

/* 
 * HIGH-CONTRAST BADGES (solid bg + white text)
 * IronXpress look & readability on light backgrounds
 */
export function getStatusColor(status?: string | null): string {
  const m: Record<string, string> = {
    // order lifecycle
    'accepted':            'bg-blue-600 text-white',
    'confirmed':           'bg-blue-600 text-white',
    'assigned':            'bg-amber-600 text-white',
    'picked_up':           'bg-violet-600 text-white',
    'in_transit':          'bg-orange-600 text-white',
    'out_for_delivery':    'bg-orange-600 text-white',
    'delivered_to_store':  'bg-sky-600 text-white',
    'ready_to_dispatch':   'bg-orange-700 text-white',
    'ready_for_delivery':  'bg-orange-700 text-white',
    'reached':             'bg-indigo-600 text-white',
    'delivered':           'bg-green-600 text-white',
    'completed':           'bg-emerald-600 text-white',
    'cancelled':           'bg-red-600 text-white',
    'failed':              'bg-red-600 text-white',

    // payment
    'paid':                'bg-green-600 text-white',
    'pending':             'bg-amber-600 text-white',
    'refunded':            'bg-gray-600 text-white',
  }
  return m[lower(status)] || 'bg-gray-700 text-white'
}

export function getStatusIcon(status?: string | null): string {
  const statusIcons: Record<string, string> = {
    'confirmed': '🆕',
    'assigned': '👤',
    'accepted': '✅',
    'picked_up': '📦',
    'in_transit': '🚚',
    'out_for_delivery': '🚚',
    'ready_to_dispatch': '📦',
    'ready_for_delivery': '📦',
    'delivered_to_store': '🏬',
    'reached': '📍',
    'delivered': '✨',
    'cancelled': '❌',
    'failed': '⚠️',
  }
  return statusIcons[lower(status)] || '📋'
}

export function getPriorityColor(priority?: string | null): string {
  const priorityColors: Record<string, string> = {
    'low': 'bg-gray-600 text-white',
    'medium': 'bg-blue-600 text-white',
    'high': 'bg-orange-600 text-white',
    'urgent': 'bg-red-600 text-white',
  }
  return priorityColors[lower(priority)] || 'bg-gray-700 text-white'
}

export function getVehicleIcon(vehicleType?: string | null): string {
  const vehicleIcons: Record<string, string> = {
    'motorcycle': '🏍️',
    'bicycle': '🚴',
    'car': '🚗',
    'scooter': '🛵',
  }
  return vehicleIcons[lower(vehicleType)] || '🚛'
}

export function generateOrderSummary(order: any): string {
  const items = order.order_items || []
  if (items.length === 0) return 'No items'
  if (items.length === 1) {
    return `${items[0].quantity}x ${items[0].item_name}`
  }
  return `${items.length} items`
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

export function debounce<T extends (...args: any[]) => void>(func: T, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>): void => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), waitFor)
  }
}
