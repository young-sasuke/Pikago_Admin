"use client"

import { Modal } from '@/components/ui/Modal'
import { formatCurrency, getStatusColor, getStatusIcon } from '@/lib/utils'
import { User, Phone, MapPin, IndianRupee } from 'lucide-react'

export type Assignment = {
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
  full_name?: string
  phone?: string
  email?: string
}

/* Local IST display (don’t touch global utils) */
function dtIST(input: string | number | Date) {
  try {
    return new Date(input).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  } catch {
    return String(input)
  }
}
function dIST(input: string | null) {
  return input ? new Date(input).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'
}

export default function AssignmentDetailsModal({
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
            {/* FULL id visible */}
            <h3 className="text-lg font-semibold text-gray-900">#{assignment.id || 'N/A'}</h3>
            <p className="text-sm text-gray-500">Assigned {dtIST(assignment.created_at)}</p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(assignment.status)}`}>
            {getStatusIcon(assignment.status)} {assignment.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <User className="h-4 w-4" /> Rider Information
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{assignment.rider_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">User ID:</span>
                {/* FULL user id but with wrapping */}
                <span className="font-medium font-mono break-all">{assignment.user_id || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Phone className="h-4 w-4" /> Customer Details
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium break-all">{assignment.full_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Phone:</span>
                <span className="font-medium break-all">{assignment.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium break-all">{assignment.email || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Delivery Information
          </h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">Address:</span>
              <p className="mt-1 text-gray-900 break-all">{assignment.delivery_address || 'N/A'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-600">Pickup Date:</span>
                <p className="font-medium">{dIST(assignment.pickup_date)}</p>
              </div>
              <div>
                <span className="text-gray-600">Delivery Date:</span>
                <p className="font-medium">{dIST(assignment.delivery_date)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-600">Status:</span>
                <p className="font-medium capitalize">{assignment.status.replace('_', ' ')}</p>
              </div>
              <div>
                <span className="text-gray-600">Last Updated:</span>
                <p className="font-medium">{dtIST(assignment.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <IndianRupee className="h-4 w-4" /> Order Value
          </h4>
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(assignment.total_amount)}</div>
        </div>
      </div>
    </Modal>
  )
}
