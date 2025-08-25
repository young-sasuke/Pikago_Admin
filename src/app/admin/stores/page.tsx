'use client'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LoadingCard } from '@/components/ui/Loading'
import { toast } from 'react-toastify'
import {
  Store,
  MapPin,
  Phone,
  Plus,
  Eye,
  Trash2,
  Edit,
  Star,
  Building,
} from 'lucide-react'

interface StoreAddress {
  id: string
  name: string
  address: {
    recipient_name: string
    phone: string
    address_type: string
    line1: string
    line2?: string
    landmark?: string
    city: string
    state: string
    pincode: string
    latitude?: number
    longitude?: number
  }
  is_default: boolean
  created_at: string
  updated_at: string
}

interface AddressFormData {
  name: string
  recipient_name: string
  phone: string
  address_type: string
  line1: string
  line2: string
  landmark: string
  city: string
  state: string
  pincode: string
  latitude: string
  longitude: string
  is_default: boolean
}

const initialFormData: AddressFormData = {
  name: '',
  recipient_name: '',
  phone: '',
  address_type: 'Store',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  latitude: '',
  longitude: '',
  is_default: false,
}

function AddressFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading,
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: AddressFormData) => void
  initialData?: AddressFormData
  isLoading: boolean
}) {
  const [formData, setFormData] = useState<AddressFormData>(initialData || initialFormData)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    } else {
      setFormData(initialFormData)
    }
    setErrors({})
  }, [initialData, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    const newErrors: Record<string, string> = {}
    const requiredFields = ['name', 'recipient_name', 'phone', 'line1', 'city', 'state', 'pincode']
    
    requiredFields.forEach(field => {
      if (!formData[field as keyof AddressFormData]) {
        newErrors[field] = 'This field is required'
      }
    })

    // Validate phone number (basic)
    if (formData.phone && !/^\+?[\d\s-()]{10,15}$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number'
    }

    // Validate pincode
    if (formData.pincode && !/^\d{6}$/.test(formData.pincode)) {
      newErrors.pincode = 'Please enter a valid 6-digit pincode'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onSubmit(formData)
  }

  const handleChange = (field: keyof AddressFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit Store Address' : 'Add Store Address'} size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Building className="h-4 w-4" />
            Store Information
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Store Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Main Store"
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Type
              </label>
              <select
                value={formData.address_type}
                onChange={(e) => handleChange('address_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="Store">Store</option>
                <option value="Warehouse">Warehouse</option>
                <option value="Office">Office</option>
                <option value="Branch">Branch</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Contact Information
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Person Name *
              </label>
              <input
                type="text"
                value={formData.recipient_name}
                onChange={(e) => handleChange('recipient_name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                  errors.recipient_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Store Manager"
              />
              {errors.recipient_name && <p className="mt-1 text-xs text-red-500">{errors.recipient_name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., +91-9876543210"
              />
              {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
            </div>
          </div>
        </div>

        {/* Address Details */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Address Details
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 1 *
              </label>
              <input
                type="text"
                value={formData.line1}
                onChange={(e) => handleChange('line1', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                  errors.line1 ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., 123 Industrial Area"
              />
              {errors.line1 && <p className="mt-1 text-xs text-red-500">{errors.line1}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 2
              </label>
              <input
                type="text"
                value={formData.line2}
                onChange={(e) => handleChange('line2', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="e.g., Phase 2, Unit 12"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Landmark
              </label>
              <input
                type="text"
                value={formData.landmark}
                onChange={(e) => handleChange('landmark', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="e.g., Near Metro Station"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                    errors.city ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Hyderabad"
                />
                {errors.city && <p className="mt-1 text-xs text-red-500">{errors.city}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State *
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                    errors.state ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Telangana"
                />
                {errors.state && <p className="mt-1 text-xs text-red-500">{errors.state}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pincode *
                </label>
                <input
                  type="text"
                  value={formData.pincode}
                  onChange={(e) => handleChange('pincode', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                    errors.pincode ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., 500001"
                />
                {errors.pincode && <p className="mt-1 text-xs text-red-500">{errors.pincode}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Location Coordinates (Optional) */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">
            Location Coordinates (Optional)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => handleChange('latitude', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="e.g., 17.3850"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => handleChange('longitude', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="e.g., 78.4867"
              />
            </div>
          </div>
        </div>

        {/* Default Toggle */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="is_default"
            checked={formData.is_default}
            onChange={(e) => handleChange('is_default', e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="is_default" className="text-sm font-medium text-gray-700 flex items-center gap-1">
            <Star className="h-4 w-4" />
            Set as default pickup address
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {initialData ? 'Update Address' : 'Add Address'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function AddressDetailsModal({
  isOpen,
  onClose,
  address,
}: {
  isOpen: boolean
  onClose: () => void
  address: StoreAddress | null
}) {
  if (!address) return null

  const addr = address.address

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Store Address Details" size="lg">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Store className="h-5 w-5" />
              {address.name}
            </h3>
            <p className="text-sm text-gray-500">{addr.address_type}</p>
          </div>
          {address.is_default && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              <Star className="h-3 w-3 mr-1" />
              Default
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Contact Information
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Contact Person:</span>
                <span className="font-medium">{addr.recipient_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Phone:</span>
                <span className="font-medium">{addr.phone}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location Details
            </h4>
            <div className="space-y-2 text-sm">
              {addr.latitude && addr.longitude && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Coordinates:</span>
                  <span className="font-medium font-mono text-xs">
                    {addr.latitude}, {addr.longitude}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Full Address</h4>
          <div className="text-sm text-gray-900 space-y-1">
            <p className="font-medium">{addr.line1}</p>
            {addr.line2 && <p>{addr.line2}</p>}
            {addr.landmark && <p className="text-gray-600">Near: {addr.landmark}</p>}
            <p>{addr.city}, {addr.state} {addr.pincode}</p>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function StoresPage() {
  const [addresses, setAddresses] = useState<StoreAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState<StoreAddress | null>(null)
  const [editingAddress, setEditingAddress] = useState<StoreAddress | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchAddresses()
  }, [])

  async function fetchAddresses() {
    try {
      const response = await fetch('/api/admin/store-address', { cache: 'no-store' })
      const data = await response.json()
      if (data.ok) {
        setAddresses(data.data)
      } else {
        toast.error('Failed to load store addresses')
      }
    } catch (error) {
      console.error('Error fetching addresses:', error)
      toast.error('Failed to load store addresses')
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setEditingAddress(null)
    setFormModalOpen(true)
  }

  const openEditModal = (address: StoreAddress) => {
    const formData: AddressFormData = {
      name: address.name,
      recipient_name: address.address.recipient_name,
      phone: address.address.phone,
      address_type: address.address.address_type,
      line1: address.address.line1,
      line2: address.address.line2 || '',
      landmark: address.address.landmark || '',
      city: address.address.city,
      state: address.address.state,
      pincode: address.address.pincode,
      latitude: address.address.latitude?.toString() || '',
      longitude: address.address.longitude?.toString() || '',
      is_default: address.is_default,
    }
    setEditingAddress(address)
    setFormModalOpen(true)
  }

  const openDetailsModal = (address: StoreAddress) => {
    setSelectedAddress(address)
    setDetailsModalOpen(true)
  }

  const handleSubmit = async (formData: AddressFormData) => {
    setSubmitting(true)
    try {
      const addressData = {
        recipient_name: formData.recipient_name,
        phone: formData.phone,
        address_type: formData.address_type,
        line1: formData.line1,
        line2: formData.line2 || null,
        landmark: formData.landmark || null,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        is_default: formData.is_default,
      }

      const response = await fetch('/api/admin/store-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          addressData,
        }),
      })

      const result = await response.json()
      if (result.ok) {
        toast.success(editingAddress ? 'Address updated successfully!' : 'Address added successfully!')
        setFormModalOpen(false)
        await fetchAddresses()
      } else {
        toast.error(result.error || 'Failed to save address')
      }
    } catch (error) {
      console.error('Error saving address:', error)
      toast.error('Failed to save address')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return

    try {
      const response = await fetch(`/api/admin/store-address?id=${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()
      if (result.ok) {
        toast.success('Address deleted successfully!')
        await fetchAddresses()
      } else {
        toast.error(result.error || 'Failed to delete address')
      }
    } catch (error) {
      console.error('Error deleting address:', error)
      toast.error('Failed to delete address')
    }
  }

  return (
    <AdminLayout
      title="Store Addresses"
      headerActions={
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4 mr-2" />
          Add Store Address
        </Button>
      }
    >
      <div className="space-y-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <LoadingCard key={i} />
            ))}
          </div>
        ) : addresses.length === 0 ? (
          <div className="text-center py-12">
            <Store className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No store addresses found
            </h3>
            <p className="text-gray-500 mb-6">
              Add your first store address to enable pickup assignments
            </p>
            <Button onClick={openAddModal}>
              <Plus className="h-4 w-4 mr-2" />
              Add Store Address
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {addresses.map((address) => (
              <div key={address.id} className="bg-white rounded-lg shadow border hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Store className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-gray-900">{address.name}</h3>
                    </div>
                    {address.is_default && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Star className="h-3 w-3 mr-1" />
                        Default
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      <span>{address.address.address_type}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p>{address.address.line1}</p>
                        {address.address.line2 && <p>{address.address.line2}</p>}
                        <p>{address.address.city}, {address.address.state} {address.address.pincode}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{address.address.phone}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDetailsModal(address)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(address)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(address.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Address Modal */}
      <AddressFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false)
          setEditingAddress(null)
        }}
        onSubmit={handleSubmit}
        initialData={editingAddress ? {
          name: editingAddress.name,
          recipient_name: editingAddress.address.recipient_name,
          phone: editingAddress.address.phone,
          address_type: editingAddress.address.address_type,
          line1: editingAddress.address.line1,
          line2: editingAddress.address.line2 || '',
          landmark: editingAddress.address.landmark || '',
          city: editingAddress.address.city,
          state: editingAddress.address.state,
          pincode: editingAddress.address.pincode,
          latitude: editingAddress.address.latitude?.toString() || '',
          longitude: editingAddress.address.longitude?.toString() || '',
          is_default: editingAddress.is_default,
        } : undefined}
        isLoading={submitting}
      />

      {/* Address Details Modal */}
      <AddressDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false)
          setSelectedAddress(null)
        }}
        address={selectedAddress}
      />
    </AdminLayout>
  )
}
