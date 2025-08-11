'use client'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { LoadingCard } from '@/components/ui/Loading'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency, getStatusColor, getStatusIcon, formatDateTime, formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-toastify'
import { 
  Search, 
  UserPlus, 
  Eye, 
  MapPin, 
  Calendar, 
  IndianRupee, 
  Package, 
  Phone,
  Truck,
  CheckCircle,
  Clock
} from 'lucide-react'

// Types for our new schema
interface PikagoOrder {
  id: string
  source_order_id: string
  full_name: string | null
  email: string | null
  phone: string | null
  items: any[]
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

interface Rider {
  id: string
  name: string
  phone: string | null
  is_active: boolean
  created_at: string
}

interface Assignment {
  id: string
  pikago_order_id: string
  rider_id: string
  status: string
  assigned_at: string
  updated_at: string
  rider?: Rider
}

function AssignRiderModal({ 
  isOpen, 
  onClose, 
  order,
  riders 
}: { 
  isOpen: boolean
  onClose: () => void
  order: Order | null
  riders: Rider[]
}) {
  const [selectedRiderId, setSelectedRiderId] = useState('')
  const [notes, setNotes] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const { admin } = useAuth()

  const handleAssign = async () => {
    if (!selectedRiderId || !order || !admin) return

    setIsAssigning(true)
    try {
      const { data, error } = await supabase.rpc('assign_order_to_rider', {
        p_order_id: order.id,
        p_rider_id: selectedRiderId,
        p_admin_id: admin.id,
        p_pickup_scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        p_notes: notes || null
      })

      if (error) {
        console.error('Assignment error:', error)
        toast.error('Failed to assign rider: ' + error.message)
        return
      }

      const result = typeof data === 'string' ? JSON.parse(data) : data
      if (result.success) {
        toast.success('Order assigned successfully!')
        onClose()
        setSelectedRiderId('')
        setNotes('')
      } else {
        toast.error('Assignment failed: ' + result.message)
      }
    } catch (error: any) {
      console.error('Assignment error:', error)
      toast.error('Failed to assign rider')
    } finally {
      setIsAssigning(false)
    }
  }

  const availableRiders = riders.filter(rider => 
    rider.is_active && 
    rider.is_available && 
    rider.current_orders_count < rider.max_orders_per_day
  )

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
                <span className="ml-2 font-medium">#{order.id}</span>
              </div>
              <div>
                <span className="text-gray-500">Amount:</span>
                <span className="ml-2 font-medium">{formatCurrency(Number(order.total_amount))}</span>
              </div>
              <div>
                <span className="text-gray-500">Pickup:</span>
                <span className="ml-2 font-medium">{formatDate(order.pickup_date)}</span>
              </div>
              <div>
                <span className="text-gray-500">Delivery:</span>
                <span className="ml-2 font-medium">{formatDate(order.delivery_date)}</span>
              </div>
            </div>
            <div className="mt-2">
              <span className="text-gray-500">Address:</span>
              <span className="ml-2 text-sm">{order.delivery_address}</span>
            </div>
          </div>

          {/* Available Riders */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Available Riders ({availableRiders.length})</h4>
            
            {availableRiders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No riders available</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availableRiders.map((rider) => (
                  <label
                    key={rider.id}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedRiderId === rider.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      value={rider.id}
                      checked={selectedRiderId === rider.id}
                      onChange={(e) => setSelectedRiderId(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{getVehicleIcon(rider.vehicle_type)}</div>
                        <div>
                          <p className="font-medium text-gray-900">{rider.full_name}</p>
                          <p className="text-sm text-gray-500">{rider.rider_code} • {rider.vehicle_type}</p>
                          <p className="text-xs text-gray-400">{rider.phone}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 mb-1">
                          <Star className="h-3 w-3 text-yellow-400 fill-current" />
                          <span className="text-sm text-gray-600">{rider.rating || 5.0}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {rider.current_orders_count}/{rider.max_orders_per_day} orders
                        </p>
                        <p className="text-xs text-gray-500">{rider.total_deliveries} total</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Assignment Notes (Optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Add any special instructions for this assignment..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isAssigning}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssign} 
              disabled={!selectedRiderId || availableRiders.length === 0}
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

function OrderDetailsModal({ 
  isOpen, 
  onClose, 
  order 
}: { 
  isOpen: boolean
  onClose: () => void
  order: Order | null
}) {
  if (!order) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Order Details" size="xl">
      <div className="space-y-6">
        {/* Order Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">#{order.id}</h3>
            <p className="text-sm text-gray-500">Created {formatDateTime(order.created_at)}</p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.order_status)}`}>
            {getStatusIcon(order.order_status)} {order.order_status}
          </span>
        </div>

        {/* Order Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Financial Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <IndianRupee className="h-4 w-4" />
              Financial Details
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-medium">{formatCurrency(Number(order.total_amount))}</span>
              </div>
              {order.discount_amount && Number(order.discount_amount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-medium text-green-600">-{formatCurrency(Number(order.discount_amount))}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-medium">{order.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Status:</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.payment_status)}`}>
                  {order.payment_status}
                </span>
              </div>
              {order.applied_coupon_code && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Coupon:</span>
                  <span className="font-medium">{order.applied_coupon_code}</span>
                </div>
              )}
            </div>
          </div>

          {/* Schedule Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule Details
            </h4>
            <div className="space-y-3 text-sm">
              <div>
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Package className="h-3 w-3" />
                  <span>Pickup</span>
                </div>
                <div className="ml-5">
                  <p className="font-medium">{formatDate(order.pickup_date)}</p>
                  {order.pickup_slot_display_time && (
                    <p className="text-gray-500">{order.pickup_slot_display_time}</p>
                  )}
                  {order.pickup_slot_start_time && order.pickup_slot_end_time && (
                    <p className="text-gray-500">
                      {formatTime(order.pickup_slot_start_time)} - {formatTime(order.pickup_slot_end_time)}
                    </p>
                  )}
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Truck className="h-3 w-3" />
                  <span>Delivery</span>
                </div>
                <div className="ml-5">
                  <p className="font-medium">{formatDate(order.delivery_date)}</p>
                  {order.delivery_slot_display_time && (
                    <p className="text-gray-500">{order.delivery_slot_display_time}</p>
                  )}
                  {order.delivery_slot_start_time && order.delivery_slot_end_time && (
                    <p className="text-gray-500">
                      {formatTime(order.delivery_slot_start_time)} - {formatTime(order.delivery_slot_end_time)}
                    </p>
                  )}
                  <p className="text-gray-500 capitalize">{order.delivery_type.replace('_', ' ')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Address */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Delivery Address
          </h4>
          <p className="text-sm text-gray-700">{order.delivery_address}</p>
          {order.address_details && (
            <div className="mt-2 text-xs text-gray-500">
              {typeof order.address_details === 'object' ? (
                <pre className="whitespace-pre-wrap font-mono">
                  {JSON.stringify(order.address_details, null, 2)}
                </pre>
              ) : (
                <p>{order.address_details}</p>
              )}
            </div>
          )}
        </div>

        {/* Additional Info */}
        {(order.status || order.cancellation_reason) && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Additional Information</h4>
            <div className="space-y-2 text-sm">
              {order.status && (
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span className="ml-2 font-medium">{order.status}</span>
                </div>
              )}
              {order.cancelled_at && (
                <div>
                  <span className="text-gray-600">Cancelled At:</span>
                  <span className="ml-2 font-medium">{formatDateTime(order.cancelled_at)}</span>
                </div>
              )}
              {order.cancellation_reason && (
                <div>
                  <span className="text-gray-600">Cancellation Reason:</span>
                  <span className="ml-2 font-medium">{order.cancellation_reason}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function OrdersPage() {
  const { orders, loading } = useOrders()
  const { riders } = useRiders()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.delivery_address.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || order.order_status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const openAssignModal = (order: Order) => {
    setSelectedOrder(order)
    setAssignModalOpen(true)
  }

  const openDetailsModal = (order: Order) => {
    setSelectedOrder(order)
    setDetailsModalOpen(true)
  }

  const statusOptions = [
    { value: 'all', label: 'All Orders' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'picked_up', label: 'Picked Up' },
    { value: 'in_transit', label: 'In Transit' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <AdminLayout 
      title="Orders"
      headerActions={
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Stats Bar */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{orders.filter(o => o.order_status === 'confirmed').length}</p>
              <p className="text-sm text-gray-600">Confirmed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{orders.filter(o => o.order_status === 'assigned').length}</p>
              <p className="text-sm text-gray-600">Assigned</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{orders.filter(o => o.order_status === 'picked_up').length}</p>
              <p className="text-sm text-gray-600">Picked Up</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{orders.filter(o => o.order_status === 'in_transit').length}</p>
              <p className="text-sm text-gray-600">In Transit</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{orders.filter(o => o.order_status === 'delivered').length}</p>
              <p className="text-sm text-gray-600">Delivered</p>
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
              {[1, 2, 3, 4, 5].map(i => (
                <LoadingCard key={i} />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
              <p className="text-gray-500">Try adjusting your search or filters</p>
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
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-lg">{getStatusIcon(order.order_status)}</div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">#{order.id}</p>
                              <p className="text-xs text-gray-500 truncate max-w-xs">{order.delivery_address}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatCurrency(Number(order.total_amount))}</div>
                        <div className="text-xs text-gray-500">{order.payment_method}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <div className="flex items-center gap-1 mb-1">
                            <Package className="h-3 w-3" />
                            <span>{formatDate(order.pickup_date)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Truck className="h-3 w-3" />
                            <span>{formatDate(order.delivery_date)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.order_status)}`}>
                          {order.order_status}
                        </span>
                        {order.payment_status !== 'paid' && (
                          <div className="mt-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.payment_status)}`}>
                              {order.payment_status}
                            </span>
                          </div>
                        )}
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
                          
                          {order.order_status === 'confirmed' && (
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
    </AdminLayout>
  )
}
