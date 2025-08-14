'use client'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { LoadingCard } from '@/components/ui/Loading'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import {
  formatCurrency,
  getStatusColor,
  getStatusIcon,
  formatDateTime,
  formatDate,
} from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-toastify'
import {
  Search,
  UserPlus,
  Eye,
  MapPin,
  IndianRupee,
  Package,
  Phone,
  Truck,
  CheckCircle,
} from 'lucide-react'

/** “Accepted” tab shows accepted + confirmed */
const ACCEPTED_ALIASES = ['accepted', 'confirmed'] as const

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type UserRow = {
  id: string // users.id
  full_name: string
  phone: string | null
  email: string | null
  is_available: boolean
  is_active: boolean
}

interface OrderItem {
  name?: string
  quantity?: number
  price?: number
  [key: string]: unknown
}

interface PikagoOrder {
  id: string
  source_order_id: string
  full_name: string | null
  email: string | null
  phone: string | null
  items: OrderItem[]
  total_amount: number
  payment_status: string
  order_status: string
  pickup_date: string | null
  delivery_date: string | null
  delivery_type: string | null
  delivery_address: string | null
  created_at: string
  updated_at: string
}

/* --------------------------------------------- */
/* Hook: fetch ALL orders (filter client-side)   */
/* --------------------------------------------- */
function useOrdersDirect() {
  const [orders, setOrders] = useState<PikagoOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('orders-any')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: any) => {
          // 1) New order inserted
          if (payload.eventType === 'INSERT') {
            const o = payload.new || {}
            const shortId =
              (o.id && String(o.id).slice(0, 8)) ||
              (o.source_order_id && String(o.source_order_id).slice(0, 8)) ||
              '—'
            const name = o.full_name || o.customer_name || 'New customer'
            const status = (o.order_status || '').toLowerCase()

            if (status === 'accepted' || status === 'confirmed') {
              toast.success(`🆕 New ${status} order ${shortId} from ${name}`)
            } else {
              toast.info(`New order ${shortId} received`)
            }
          }

          // 2) Order status changed → accepted/confirmed
          if (payload.eventType === 'UPDATE') {
            const prev = (payload.old?.order_status || '').toLowerCase()
            const next = (payload.new?.order_status || '').toLowerCase()
            if (prev !== next && (next === 'accepted' || next === 'confirmed')) {
              const shortId =
                (payload.new?.id && String(payload.new.id).slice(0, 8)) ||
                (payload.new?.source_order_id &&
                  String(payload.new.source_order_id).slice(0, 8)) ||
                '—'
              toast.success(`✅ Order ${shortId} is ${next}`)
            }
          }

          // Always refresh the table
          fetchOrders()
        }
      )
      .subscribe()

    return () => {
      void channel.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchOrders() {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching orders:', error)
        toast.error('Failed to fetch orders')
        return
      }

      const mapped = (data ?? []).map(
        (o: any): PikagoOrder => ({
          id: String(o.id),
          source_order_id: String(o.id),
          full_name: o.full_name ?? o.customer_name ?? null,
          email: o.email ?? null,
          phone: o.phone ?? o.customer_phone ?? null,
          items: Array.isArray(o.items) ? o.items : [],
          total_amount: Number(o.total_amount ?? 0),
          payment_status: o.payment_status ?? 'pending',
          order_status: o.order_status ?? 'accepted',
          pickup_date: o.pickup_date ?? null,
          delivery_date: o.delivery_date ?? null,
          delivery_type: o.delivery_type ?? null,
          delivery_address: o.delivery_address ?? o.address ?? null,
          created_at: o.created_at ?? new Date().toISOString(),
          updated_at: o.updated_at ?? o.created_at ?? new Date().toISOString(),
        })
      )

      setOrders(mapped)
    } catch (err) {
      console.error('Error fetching orders:', err)
      toast.error('Failed to fetch orders')
    } finally {
      setLoading(false)
    }
  }

  return { orders, loading }
}

/* ------------------------------ */
/* Hook: fetch available users    */
/* from public.users (enrich via delivery_partners if present) */
/* ------------------------------ */
/* ------------------------------ */
/* Hook: fetch assignable users   */
/* via server API (service role)  */
/* ------------------------------ */
function useUsers() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      const resp = await fetch('/api/admin/users', { cache: 'no-store' })
      const json = await resp.json()
      if (!resp.ok || !json.ok) throw new Error(json.error || 'Failed to fetch users')
      setRows(json.data as UserRow[])
    } catch (e: any) {
      console.error('Error fetching users:', e)
      toast.error('Failed to fetch users')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  // keep return name 'riders' so the modal props don’t change
  return { riders: rows, loading }
}


/* ------------------ */
/* Assign Rider Modal */
/* ------------------ */
function AssignRiderModal({
  isOpen,
  onClose,
  order,
  riders,
}: {
  isOpen: boolean
  onClose: () => void
  order: PikagoOrder | null
  riders: UserRow[]
}) {
  const [selectedRiderId, setSelectedRiderId] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)

  const handleAssign = async () => {
    if (!selectedRiderId || !order) return
    setIsAssigning(true)

    try {
      const response = await fetch('/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, userId: selectedRiderId }),
      })

      const result = await response.json()
      if (response.ok && result.ok) {
        toast.success('Order assigned successfully!')
        onClose()
        setSelectedRiderId('')
      } else {
        toast.error('Assignment failed: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Assignment error:', error)
      toast.error('Failed to assign rider')
    } finally {
      setIsAssigning(false)
    }
  }

  // Show users that are active & available (defaults true if no delivery_partners row)
  const available = riders.filter((r) => r.is_active !== false && r.is_available !== false)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Rider" size="lg">
      {order && (
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Order Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Order ID:</span>
                <span className="ml-2 font-medium">#{order.id.slice(0, 8)}</span>
              </div>
              <div>
                <span className="text-gray-500">Amount:</span>
                <span className="ml-2 font-medium">{formatCurrency(order.total_amount)}</span>
              </div>
              <div>
                <span className="text-gray-500">Customer:</span>
                <span className="ml-2 font-medium">{order.full_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">Phone:</span>
                <span className="ml-2 font-medium">{order.phone || 'N/A'}</span>
              </div>
            </div>
            <div className="mt-2">
              <span className="text-gray-500">Address:</span>
              <span className="ml-2 text-sm">{order.delivery_address || 'N/A'}</span>
            </div>
          </div>

          {/* Riders (Users) */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">
              Available Riders ({available.length})
            </h4>
            {available.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No riders available</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {available.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedRiderId === r.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      id={`rider-${r.id}`}
                      name="rider"
                      type="radio"
                      value={r.id}
                      checked={selectedRiderId === r.id}
                      onChange={(e) => setSelectedRiderId(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Truck className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{r.full_name}</p>
                          <p className="text-xs text-gray-400">
                            {r.phone || r.email || 'No contact'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isAssigning}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedRiderId || available.length === 0}
              isLoading={isAssigning}
            >
              Assign Rider
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ------------------- */
/* Order Details modal */
/* ------------------- */
function OrderDetailsModal({
  isOpen,
  onClose,
  order,
}: {
  isOpen: boolean
  onClose: () => void
  order: PikagoOrder | null
}) {
  if (!order) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Order Details" size="xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              #{order.id.slice(0, 8)}
            </h3>
            <p className="text-sm text-gray-500">
              Created {formatDateTime(order.created_at)}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
              order.order_status
            )}`}
          >
            {getStatusIcon(order.order_status)} {order.order_status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Customer Details
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{order.full_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium">{order.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Phone:</span>
                <span className="font-medium">{order.phone || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <IndianRupee className="h-4 w-4" />
              Financial Details
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-medium">
                  {formatCurrency(order.total_amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Status:</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                    order.payment_status
                  )}`}
                >
                  {order.payment_status}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Delivery Details
          </h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">Address:</span>
              <p className="mt-1 text-gray-900">
                {order.delivery_address || 'N/A'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-600">Pickup Date:</span>
                <p className="font-medium">
                  {order.pickup_date ? formatDate(order.pickup_date) : 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Delivery Date:</span>
                <p className="font-medium">
                  {order.delivery_date ? formatDate(order.delivery_date) : 'N/A'}
                </p>
              </div>
            </div>
            {order.delivery_type && (
              <div>
                <span className="text-gray-600">Delivery Type:</span>
                <span className="ml-2 font-medium capitalize">
                  {order.delivery_type.replace('_', ' ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {order.items && order.items.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Order Items ({order.items.length})
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {order.items.map((item: OrderItem, index: number) => (
                <div
                  key={index}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="text-gray-900">
                    {item.name || `Item ${index + 1}`}
                  </span>
                  <span className="text-gray-600">
                    {item.quantity || 1}x{' '}
                    {item.price ? formatCurrency(item.price) : 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Source Information</h4>
          <div className="text-sm">
            <span className="text-gray-600">IronXpress Order ID:</span>
            <span className="ml-2 font-mono text-blue-600">
              {order.source_order_id}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ----------------- */
/* Page (main render) */
/* ----------------- */
export default function OrdersPage() {
  const { orders, loading } = useOrdersDirect()
  const { riders } = useUsers() // <-- now reading from users table

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('accepted') // default view
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PikagoOrder | null>(null)

  // header counts (across ALL orders)
  const [counts, setCounts] = useState<Record<string, number>>({})

  async function refreshCounts() {
    try {
      const { data, error } = await supabase.from('orders').select('order_status')
      if (error) return

      const next: Record<string, number> = {}
      for (const row of data ?? []) {
        const s = (row as any).order_status || 'unknown'
        next[s] = (next[s] ?? 0) + 1
      }
      setCounts(next)
    } catch (e) {
      console.error('Error fetching counts:', e)
    }
  }

  useEffect(() => {
    refreshCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const ch = supabase
      .channel('orders-counts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => refreshCounts()
      )
      .subscribe()

    return () => {
      void ch.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredOrders = orders.filter((order) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      order.id.toLowerCase().includes(q) ||
      order.source_order_id.toLowerCase().includes(q) ||
      (order.full_name && order.full_name.toLowerCase().includes(q)) ||
      (order.delivery_address && order.delivery_address.toLowerCase().includes(q))

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'accepted'
          ? ACCEPTED_ALIASES.includes(order.order_status as any)
          : order.order_status === statusFilter

    return matchesSearch && matchesStatus
  })

  const openAssignModal = (order: PikagoOrder) => {
    setSelectedOrder(order)
    setAssignModalOpen(true)
  }

  const openDetailsModal = (order: PikagoOrder) => {
    setSelectedOrder(order)
    setDetailsModalOpen(true)
  }

  const statusOptions = [
    { value: 'all', label: 'All Orders' },
    { value: 'accepted', label: 'Accepted' }, // shows accepted + confirmed
    { value: 'assigned', label: 'Assigned' },
    { value: 'picked_up', label: 'Picked Up' },
    { value: 'in_transit', label: 'In Transit' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  const emptyHelp =
    statusFilter === 'accepted'
      ? 'Showing only accepted and confirmed orders'
      : statusFilter === 'all'
        ? 'Showing all orders'
        : `Showing only ${statusFilter} orders`

  return (
    <AdminLayout
      title="Pikago Orders"
      headerActions={
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="orders-search"
              name="ordersSearch"
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            id="orders-status-filter"
            name="ordersStatusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Stats Bar (from ALL orders) */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {(counts['accepted'] ?? 0) + (counts['confirmed'] ?? 0)}
              </p>
              <p className="text-sm text-gray-600">Accepted</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {counts['assigned'] ?? 0}
              </p>
              <p className="text-sm text-gray-600">Assigned</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {counts['picked_up'] ?? 0}
              </p>
              <p className="text-sm text-gray-600">Picked Up</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
                {counts['in_transit'] ?? 0}
              </p>
              <p className="text-sm text-gray-600">In Transit</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {(counts['delivered'] ?? 0) + (counts['completed'] ?? 0)}
              </p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Orders ({filteredOrders.length})
            </h3>
          </div>

          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <LoadingCard key={i} />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No orders found
              </h3>
              <p className="text-gray-500">{emptyHelp}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="text-lg">
                            {getStatusIcon(order.order_status)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              #{order.id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">
                              IronXpress: {order.source_order_id.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <p className="font-medium">{order.full_name || 'N/A'}</p>
                          <p className="text-xs text-gray-500">
                            {order.phone || order.email || 'No contact'}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(order.total_amount)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {order.payment_status}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {order.pickup_date && (
                            <div className="flex items-center gap-1 mb-1">
                              <Package className="h-3 w-3" />
                              <span>{formatDate(order.pickup_date)}</span>
                            </div>
                          )}
                          {order.delivery_date && (
                            <div className="flex items-center gap-1">
                              <Truck className="h-3 w-3" />
                              <span>{formatDate(order.delivery_date)}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            order.order_status
                          )}`}
                        >
                          {order.order_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(order.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetailsModal(order)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {ACCEPTED_ALIASES.includes(order.order_status as any) && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => openAssignModal(order)}
                            >
                              <UserPlus className="h-4 w-4 mr-1" />
                              Assign
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AssignRiderModal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false)
          setSelectedOrder(null)
        }}
        order={selectedOrder}
        riders={riders}
      />

      <OrderDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false)
          setSelectedOrder(null)
        }}
        order={selectedOrder}
      />

      {/* Toasts */}
      <ToastContainer position="top-right" autoClose={3000} newestOnTop />
    </AdminLayout>
  )
}
