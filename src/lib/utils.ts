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
      date = new Date(timeString)              // ISO string
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

/* ---------- null/undefined safe lowercasing helper ---------- */
const lower = (s?: string | null) => (typeof s === 'string' ? s.toLowerCase() : '')

export function getStatusColor(status?: string | null): string {
  const statusColors: Record<string, string> = {
    // Order statuses
    'confirmed': 'bg-blue-100 text-blue-800',
    'assigned': 'bg-yellow-100 text-yellow-800',
    'picked_up': 'bg-purple-100 text-purple-800',
    'in_transit': 'bg-orange-100 text-orange-800',
    'out_for_delivery': 'bg-orange-100 text-orange-800',
    'delivered_to_store': 'bg-blue-100 text-blue-800',
    'ready_to_dispatch': 'bg-orange-100 text-orange-800',
    'ready_for_delivery': 'bg-orange-100 text-orange-800',
    'reached': 'bg-indigo-100 text-indigo-800',
    'delivered': 'bg-green-100 text-green-800',
    'cancelled': 'bg-red-100 text-red-800',
    'failed': 'bg-red-100 text-red-800',

    // Payment statuses
    'paid': 'bg-green-100 text-green-800',
    'pending': 'bg-yellow-100 text-yellow-800',
    'refunded': 'bg-gray-100 text-gray-800',
    // note: 'failed' already covered above
  }
  return statusColors[lower(status)] || 'bg-gray-100 text-gray-800'
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
    'low': 'bg-gray-100 text-gray-800',
    'medium': 'bg-blue-100 text-blue-800',
    'high': 'bg-orange-100 text-orange-800',
    'urgent': 'bg-red-100 text-red-800',
  }
  return priorityColors[lower(priority)] || 'bg-gray-100 text-gray-800'
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
  const R = 6371 // km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  waitFor: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>): void => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), waitFor)
  }
}
