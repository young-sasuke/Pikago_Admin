'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { useRiders } from '@/hooks/useRealtime'
import { LoadingCard } from '@/components/ui/Loading'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { getVehicleIcon, formatDateTime } from '@/lib/utils'
import { supabase, Rider } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'react-toastify'
import { 
  Search, 
  UserPlus, 
  Eye, 
  Star,
  Phone,
  Clock,
  Truck,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  XCircle
} from 'lucide-react'

type VehicleType = 'motorcycle' | 'scooter' | 'bicycle' | 'car'

function AddRiderModal({ 
  isOpen, 
  onClose, 
  onSave
}: { 
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}) {
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    vehicle_type: 'motorcycle' as VehicleType,
    vehicle_number: '',
    license_number: '',
    max_orders_per_day: 10,
    notes: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const { admin } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.full_name || !formData.phone) return

    setIsLoading(true)
    try {
      // Generate rider code
      const { data: codeData, error: codeError } = await supabase.rpc('generate_rider_code')
      if (codeError) throw codeError

      const { error } = await supabase.from('riders').insert([{
        rider_code: codeData,
        full_name: formData.full_name,
        phone: formData.phone,
        email: formData.email || null,
        vehicle_type: formData.vehicle_type,
        vehicle_number: formData.vehicle_number || null,
        license_number: formData.license_number || null,
        max_orders_per_day: formData.max_orders_per_day,
        notes: formData.notes || null,
        created_by: admin?.id
      }])

      if (error) throw error

      toast.success('Rider added successfully!')
      onSave()
      onClose()
      setFormData({
        full_name: '',
        phone: '',
        email: '',
        vehicle_type: 'motorcycle',
        vehicle_number: '',
        license_number: '',
        max_orders_per_day: 10,
        notes: ''
      })
    } catch (error: any) {
      console.error('Error adding rider:', error)
      toast.error('Failed to add rider: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Rider" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              id="full_name"
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter full name"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <input
              id="phone"
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="+91 9876543210"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="rider@example.com"
            />
          </div>

          <div>
            <label htmlFor="vehicle_type" className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Type *
            </label>
            <select
              id="vehicle_type"
              required
              value={formData.vehicle_type}
              onChange={(e) => setFormData(prev => ({ ...prev, vehicle_type: e.target.value as VehicleType }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="motorcycle">Motorcycle</option>
              <option value="scooter">Scooter</option>
              <option value="bicycle">Bicycle</option>
              <option value="car">Car</option>
            </select>
          </div>

          <div>
            <label htmlFor="vehicle_number" className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Number
            </label>
            <input
              id="vehicle_number"
              type="text"
              value={formData.vehicle_number}
              onChange={(e) => setFormData(prev => ({ ...prev, vehicle_number: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="MH12AB1234"
            />
          </div>

          <div>
            <label htmlFor="license_number" className="block text-sm font-medium text-gray-700 mb-1">
              License Number
            </label>
            <input
              id="license_number"
              type="text"
              value={formData.license_number}
              onChange={(e) => setFormData(prev => ({ ...prev, license_number: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="DL123456789"
            />
          </div>
        </div>

        <div>
          <label htmlFor="max_orders_per_day" className="block text-sm font-medium text-gray-700 mb-1">
            Max Orders Per Day
          </label>
          <input
            id="max_orders_per_day"
            type="number"
            min="1"
            max="50"
            value={formData.max_orders_per_day}
            onChange={(e) => setFormData(prev => ({ ...prev, max_orders_per_day: parseInt(e.target.value) }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Any additional notes about the rider..."
          />
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Add Rider
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function RiderDetailsModal({ 
  isOpen, 
  onClose, 
  rider 
}: { 
  isOpen: boolean
  onClose: () => void
  rider: Rider | null
}) {
  if (!rider) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rider Details" size="xl">
      <div className="space-y-6">
        {/* Rider Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-4xl">{getVehicleIcon(rider.vehicle_type)}</div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{rider.full_name}</h3>
              <p className="text-sm text-gray-500">{rider.rider_code} • {rider.vehicle_type}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-yellow-400 fill-current" />
                  <span className="text-sm text-gray-600">{rider.rating || 5.0}</span>
                </div>
                <span className="text-gray-400">•</span>
                <span className="text-sm text-gray-600">{rider.total_deliveries} deliveries</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 mb-2">
              {rider.is_active ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className={`text-sm font-medium ${rider.is_active ? 'text-green-600' : 'text-red-600'}`}>
                {rider.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {rider.is_available ? (
                <ToggleRight className="h-5 w-5 text-green-500" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-gray-400" />
              )}
              <span className={`text-sm ${rider.is_available ? 'text-green-600' : 'text-gray-600'}`}>
                {rider.is_available ? 'Available' : 'Unavailable'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{rider.current_orders_count}</p>
            <p className="text-sm text-gray-600">Current Orders</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{rider.successful_deliveries}</p>
            <p className="text-sm text-gray-600">Successful</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-600">{rider.max_orders_per_day}</p>
            <p className="text-sm text-gray-600">Max/Day</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{rider.rating || 5.0}</p>
            <p className="text-sm text-gray-600">Rating</p>
          </div>
        </div>

        {/* Contact & Vehicle Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Contact Information
            </h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Phone:</span>
                <span className="ml-2 font-medium">{rider.phone}</span>
              </div>
              {rider.email && (
                <div>
                  <span className="text-gray-600">Email:</span>
                  <span className="ml-2 font-medium">{rider.email}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Vehicle Information
            </h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Type:</span>
                <span className="ml-2 font-medium capitalize">{rider.vehicle_type}</span>
              </div>
              {rider.vehicle_number && (
                <div>
                  <span className="text-gray-600">Number:</span>
                  <span className="ml-2 font-medium">{rider.vehicle_number}</span>
                </div>
              )}
              {rider.license_number && (
                <div>
                  <span className="text-gray-600">License:</span>
                  <span className="ml-2 font-medium">{rider.license_number}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Working Hours */}
        {rider.working_hours && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Working Hours
            </h4>
            <div className="text-sm">
              <span className="font-medium">
                {rider.working_hours.start} - {rider.working_hours.end}
              </span>
            </div>
          </div>
        )}

        {/* Notes */}
        {rider.notes && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Notes</h4>
            <p className="text-sm text-gray-700">{rider.notes}</p>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Timeline</h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">Hired:</span>
              <span className="ml-2">{formatDateTime(rider.hired_at)}</span>
            </div>
            <div>
              <span className="text-gray-600">Created:</span>
              <span className="ml-2">{formatDateTime(rider.created_at)}</span>
            </div>
            <div>
              <span className="text-gray-600">Updated:</span>
              <span className="ml-2">{formatDateTime(rider.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function RidersPage() {
  const { riders, loading, refetch } = useRiders()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null)

  // Filter riders
  const filteredRiders = riders.filter(rider => {
    const matchesSearch = 
      rider.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rider.rider_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rider.phone.includes(searchTerm)
    
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'active' && rider.is_active) ||
      (statusFilter === 'available' && rider.is_available) ||
      (statusFilter === 'unavailable' && !rider.is_available) ||
      (statusFilter === 'inactive' && !rider.is_active)
    
    return matchesSearch && matchesStatus
  })

  const toggleRiderAvailability = async (rider: Rider) => {
    try {
      const { error } = await supabase
        .from('riders')
        .update({ is_available: !rider.is_available })
        .eq('id', rider.id)

      if (error) throw error

      toast.success(`Rider marked as ${!rider.is_available ? 'available' : 'unavailable'}`)
    } catch (error: any) {
      console.error('Error toggling availability:', error)
      toast.error('Failed to update rider availability')
    }
  }

  const toggleRiderStatus = async (rider: Rider) => {
    try {
      const { error } = await supabase
        .from('riders')
        .update({ is_active: !rider.is_active })
        .eq('id', rider.id)

      if (error) throw error

      toast.success(`Rider ${!rider.is_active ? 'activated' : 'deactivated'}`)
    } catch (error: any) {
      console.error('Error toggling status:', error)
      toast.error('Failed to update rider status')
    }
  }

  const openDetailsModal = (rider: Rider) => {
    setSelectedRider(rider)
    setDetailsModalOpen(true)
  }

  const statusOptions = [
    { value: 'all', label: 'All Riders' },
    { value: 'active', label: 'Active' },
    { value: 'available', label: 'Available' },
    { value: 'unavailable', label: 'Unavailable' },
    { value: 'inactive', label: 'Inactive' },
  ]

  return (
    <AdminLayout 
      title="Riders"
      headerActions={
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search riders..."
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

          <Button onClick={() => setAddModalOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Rider
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Stats Bar */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{riders.filter(r => r.is_active).length}</p>
              <p className="text-sm text-gray-600">Active Riders</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{riders.filter(r => r.is_available).length}</p>
              <p className="text-sm text-gray-600">Available Now</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{riders.filter(r => r.current_orders_count > 0).length}</p>
              <p className="text-sm text-gray-600">With Orders</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">{riders.reduce((sum, r) => sum + r.total_deliveries, 0)}</p>
              <p className="text-sm text-gray-600">Total Deliveries</p>
            </div>
          </div>
        </div>

        {/* Riders Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Riders ({filteredRiders.length})
            </h3>
          </div>
          
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <LoadingCard key={i} />
              ))}
            </div>
          ) : filteredRiders.length === 0 ? (
            <div className="text-center py-12">
              <UserPlus className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No riders found</h3>
              <p className="text-gray-500 mb-4">Try adjusting your search or filters</p>
              <Button onClick={() => setAddModalOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add First Rider
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vehicle
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRiders.map((rider) => (
                    <tr key={rider.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{getVehicleIcon(rider.vehicle_type)}</div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{rider.full_name}</p>
                            <p className="text-xs text-gray-500">{rider.rider_code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{rider.phone}</div>
                        {rider.email && (
                          <div className="text-xs text-gray-500">{rider.email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 capitalize">{rider.vehicle_type}</div>
                        {rider.vehicle_number && (
                          <div className="text-xs text-gray-500">{rider.vehicle_number}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 mb-1">
                          <Star className="h-3 w-3 text-yellow-400 fill-current" />
                          <span className="text-sm text-gray-900">{rider.rating || 5.0}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {rider.current_orders_count}/{rider.max_orders_per_day} orders
                        </div>
                        <div className="text-xs text-gray-500">
                          {rider.total_deliveries} total
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {rider.is_active ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className={`text-xs font-medium ${rider.is_active ? 'text-green-600' : 'text-red-600'}`}>
                              {rider.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          {rider.is_active && (
                            <div className="flex items-center gap-2">
                              {rider.is_available ? (
                                <ToggleRight className="h-4 w-4 text-green-500" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-gray-400" />
                              )}
                              <span className={`text-xs ${rider.is_available ? 'text-green-600' : 'text-gray-600'}`}>
                                {rider.is_available ? 'Available' : 'Busy'}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetailsModal(rider)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {rider.is_active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRiderAvailability(rider)}
                              className={rider.is_available ? 'text-orange-600' : 'text-green-600'}
                            >
                              {rider.is_available ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRiderStatus(rider)}
                            className={rider.is_active ? 'text-red-600' : 'text-green-600'}
                          >
                            {rider.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          </Button>
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
      <AddRiderModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={() => refetch()}
      />

      <RiderDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false)
          setSelectedRider(null)
        }}
        rider={selectedRider}
      />
    </AdminLayout>
  )
}
