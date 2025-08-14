'use client'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { LoadingCard } from '@/components/ui/Loading'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { getVehicleIcon, formatDateTime } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-toastify'
import {
  Search, UserPlus, Eye, Star, Phone, Clock,
  Truck, ToggleLeft, ToggleRight, CheckCircle, XCircle
} from 'lucide-react'

type VehicleType = 'motorcycle' | 'scooter' | 'bicycle' | 'car'

export type Rider = {
  id: string // users.id
  rider_code: string // if you have a code, else derive from id
  full_name: string
  phone: string
  email?: string | null
  vehicle_type: VehicleType
  vehicle_number?: string | null
  license_number?: string | null
  max_orders_per_day: number
  notes?: string | null
  rating?: number
  current_orders_count: number
  total_deliveries: number
  successful_deliveries: number
  is_active: boolean
  is_available: boolean
  working_hours?: { start: string; end: string } | null
  hired_at?: string | null
  created_at: string
  updated_at: string
}

/* Fetch riders from delivery_partners join users */
function useRiders() {
  const [riders, setRiders] = useState<Rider[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetchRows()
  }, [])

  async function fetchRows() {
    try {
      const { data, error } = await supabase
        .from('delivery_partners')
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          vehicle_type,
          vehicle_number,
          license_number,
          max_orders_per_day,
          notes,
          rating,
          current_orders_count,
          total_deliveries,
          successful_deliveries,
          is_active,
          is_available,
          working_hours,
          hired_at,
          created_at,
          updated_at,
          users:users!inner(id, email, phone)
        `)
        .order('first_name', { ascending: true })

      if (error) throw error

      const mapped: Rider[] = (data ?? []).map((r: any) => ({
        id: r.users?.id ?? r.user_id,
        rider_code: (r.id || '').toString().slice(0, 8).toUpperCase(),
        full_name: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'Unnamed',
        phone: r.users?.phone ?? '',
        email: r.users?.email ?? null,
        vehicle_type: (r.vehicle_type || 'motorcycle') as VehicleType,
        vehicle_number: r.vehicle_number ?? null,
        license_number: r.license_number ?? null,
        max_orders_per_day: r.max_orders_per_day ?? 10,
        notes: r.notes ?? null,
        rating: r.rating ?? 5.0,
        current_orders_count: r.current_orders_count ?? 0,
        total_deliveries: r.total_deliveries ?? 0,
        successful_deliveries: r.successful_deliveries ?? 0,
        is_active: r.is_active ?? true,
        is_available: r.is_available ?? false,
        working_hours: r.working_hours ?? null,
        hired_at: r.hired_at ?? null,
        created_at: r.created_at ?? new Date().toISOString(),
        updated_at: r.updated_at ?? r.created_at ?? new Date().toISOString(),
      }))

      setRiders(mapped)
    } catch (e: any) {
      console.error('fetch riders failed', e)
      toast.error('Failed to fetch riders')
    } finally {
      setLoading(false)
    }
  }

  return { riders, loading, refetch: fetchRows }
}

/* Add modal now writes to delivery_partners (profiles) */
function AddRiderModal({
  isOpen, onClose, onSave
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.full_name || !formData.phone) return
    setIsLoading(true)
    try {
      // 1) Create a user row (if you onboard riders as users here)
      const { data: newUser, error: uerr } = await supabase
        .from('users')
        .insert([{ phone: formData.phone, email: formData.email || null }])
        .select('id')
        .single()
      if (uerr) throw uerr

      // 2) Create delivery_partners profile
      const [first_name, ...rest] = formData.full_name.split(' ')
      const last_name = rest.join(' ')
      const { error: perr } = await supabase.from('delivery_partners').insert([{
        user_id: newUser.id,
        first_name,
        last_name,
        vehicle_type: formData.vehicle_type,
        vehicle_number: formData.vehicle_number || null,
        license_number: formData.license_number || null,
        max_orders_per_day: formData.max_orders_per_day,
        notes: formData.notes || null,
        is_active: true,
        is_available: true
      }])
      if (perr) throw perr

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
      {/* (keep your existing form UI as-is; only handler changed) */}
      {/* ... form fields (unchanged) ... */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* your inputs here (same as before) */}
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
  isOpen, onClose, rider
}: {
  isOpen: boolean
  onClose: () => void
  rider: Rider | null
}) {
  if (!rider) return null
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rider Details" size="xl">
      {/* keep your existing details UI; data fields mapped to Rider above */}
      {/* ... unchanged UI ... */}
      <div />
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
        .from('delivery_partners')
        .update({ is_available: !rider.is_available })
        .eq('user_id', rider.id)
      if (error) throw error
      toast.success(`Rider marked as ${!rider.is_available ? 'available' : 'unavailable'}`)
      refetch()
    } catch (error: any) {
      console.error('Error toggling availability:', error)
      toast.error('Failed to update rider availability')
    }
  }

  const toggleRiderStatus = async (rider: Rider) => {
    try {
      const { error } = await supabase
        .from('delivery_partners')
        .update({ is_active: !rider.is_active })
        .eq('user_id', rider.id)
      if (error) throw error
      toast.success(`Rider ${!rider.is_active ? 'activated' : 'deactivated'}`)
      refetch()
    } catch (error: any) {
      console.error('Error toggling status:', error)
      toast.error('Failed to update rider status')
    }
  }

  const openDetailsModal = (rider: Rider) => {
    setSelectedRider(rider)
    setDetailsModalOpen(true)
  }

  // ... keep your existing JSX table; only handlers changed above ...
  return (
    <AdminLayout title="Riders">
      {/* keep your header actions & table UI */}
      <div />
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
