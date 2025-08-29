'use client'

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
  Eye,
  MapPin,
  IndianRupee,
  Package,
  Phone,
  Truck,
  CheckCircle,
  Clock,
  User,
  Navigation,
} from 'lucide-react'

interface Assignment {
  id: string
  user_id: string
  status: string
  rider_name: string
  total_amount: number
  delivery_address: string
  pickup_date: string | null
  delivery_date: string | null
  created_at: string
  updated_at: string
  // Customer details from orders
  full_name?: string
  phone?: string
  email?: string
}

function useAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAssignments()

    const channel = supabase
      .channel('assignments-page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assigned_orders' },
        () => {
          fetchAssignments()
        }
      )
      .subscribe()

    return () => {
      void channel.unsubscribe()
    }
  }, [])

  async function fetchAssignments() {
    try {
      const { data, error } = await supabase
        .from('assigned_orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching assignments:', error)
        toast.error('Failed to fetch assignments')
        return
      }

      setAssignments((data as Assignment[]) || [])
    } catch (e) {
      console.error('Error fetching assignments:', e)
      toast.error('Failed to fetch assignments')
    } finally {
      setLoading(false)
    }
  }

  return { assignments, loading, refetch: fetchAssignments }
}

function AssignmentDetailsModal({
  isOpen,
  onClose,
  assignment,
}: {
  isOpen: boolean
  onClose: () => void
  assignment: Assignment | null
}) {
  if (!assignment) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assignment Details" size="xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              #{assignment.id?.slice(0, 8) || 'N/A'}
            </h3>
            <p className="text-sm text-gray-500">
              Assigned {formatDateTime(assignment.created_at)}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
              assignment.status
            )}`}
          >
            {getStatusIcon(assignment.status)} {assignment.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Rider Information
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{assignment.rider_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">User ID:</span>
                <span className="font-medium font-mono">
                  {assignment.user_id?.slice(0, 8) || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Customer Details
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{assignment.full_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Phone:</span>
                <span className="font-medium">{assignment.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium">{assignment.email || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Delivery Information
          </h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">Address:</span>
              <p className="mt-1 text-gray-900">
                {assignment.delivery_address || 'N/A'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-600">Pickup Date:</span>
                <p className="font-medium">
                  {assignment.pickup_date ? formatDate(assignment.pickup_date) : 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Delivery Date:</span>
                <p className="font-medium">
                  {assignment.delivery_date ? formatDate(assignment.delivery_date) : 'N/A'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-600">Status:</span>
                <p className="font-medium capitalize">
                  {assignment.status.replace('_', ' ')}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Last Updated:</span>
                <p className="font-medium">
                  {formatDateTime(assignment.updated_at)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <IndianRupee className="h-4 w-4" />
            Order Value
          </h4>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(assignment.total_amount)}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function AssignmentsPage() {
  const { assignments, loading } = useAssignments()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)

  // Filter assignments
  const filteredAssignments = assignments.filter((assignment) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      assignment.id.toLowerCase().includes(q) ||
      (assignment.rider_name && assignment.rider_name.toLowerCase().includes(q)) ||
      (assignment.full_name && assignment.full_name.toLowerCase().includes(q)) ||
      (assignment.delivery_address && assignment.delivery_address.toLowerCase().includes(q))

    const matchesStatus = statusFilter === 'all' || assignment.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const openDetailsModal = (assignment: Assignment) => {
    setSelectedAssignment(assignment)
    setDetailsModalOpen(true)
  }

  const updateRiderStatus = async (orderId: string, status: string) => {
    try {
      console.log(`[Admin] 🚀 Updating rider status: ${orderId} -> ${status}`)
      const response = await fetch('/api/rider-status', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-shared-secret': '918273645'
        },
        body: JSON.stringify({ orderId, status }),
      })

      const result = await response.json()
      if (response.ok && result.ok) {
        toast.success(`Status updated to ${status}!`)
        // The realtime subscription will automatically refresh the data
      } else {
        toast.error('Failed to update status: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Status update error:', error)
      toast.error('Failed to update status')
    }
  }

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'picked_up', label: 'Picked Up' },
    { value: 'in_transit', label: 'In Transit' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <AdminLayout
      title="Rider Assignments"
      headerActions={
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search assignments..."
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
        {/* Stats Bar */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {assignments.filter((a) => a.status === 'assigned').length}
              </p>
              <p className="text-sm text-gray-600">Assigned</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {assignments.filter((a) => a.status === 'picked_up').length}
              </p>
              <p className="text-sm text-gray-600">Picked Up</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
                {assignments.filter((a) => a.status === 'in_transit').length}
              </p>
              <p className="text-sm text-gray-600">In Transit</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {assignments.filter((a) => a.status === 'delivered').length}
              </p>
              <p className="text-sm text-gray-600">Delivered</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">
                {assignments.length}
              </p>
              <p className="text-sm text-gray-600">Total</p>
            </div>
          </div>
        </div>

        {/* Assignments Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Assignments ({filteredAssignments.length})
            </h3>
          </div>

          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <LoadingCard key={i} />
              ))}
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No assignments found
              </h3>
              <p className="text-gray-500">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assignment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timeline
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAssignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="text-lg">
                            {getStatusIcon(assignment.status)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              #{assignment.id?.slice(0, 8) || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500 truncate max-w-xs">
                              {assignment.delivery_address}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <p className="font-medium">
                            {assignment.rider_name || 'Unassigned'}
                          </p>
                          <p className="text-xs text-gray-500 font-mono">
                            {assignment.user_id?.slice(0, 8) || 'N/A'}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <p className="font-medium">
                            {assignment.full_name || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {assignment.phone || assignment.email || 'No contact'}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(assignment.total_amount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            assignment.status
                          )}`}
                        >
                          {assignment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <div className="flex items-center gap-1 mb-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              Assigned {formatDate(assignment.created_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <span>
                              Updated {formatDate(assignment.updated_at)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetailsModal(assignment)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {/* Status Update Buttons */}
                          {assignment.status === 'assigned' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => updateRiderStatus(assignment.id, 'picked_up')}
                            >
                              <Package className="h-4 w-4 mr-1" />
                              Pickup
                            </Button>
                          )}

                          {assignment.status === 'picked_up' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => updateRiderStatus(assignment.id, 'in_transit')}
                            >
                              <Navigation className="h-4 w-4 mr-1" />
                              In Transit
                            </Button>
                          )}

                          {assignment.status === 'in_transit' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => updateRiderStatus(assignment.id, 'delivered')}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Deliver
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

      {/* Assignment Details Modal */}
      <AssignmentDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false)
          setSelectedAssignment(null)
        }}
        assignment={selectedAssignment}
      />
    </AdminLayout>
  )
}
