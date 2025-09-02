"use client"

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { MapPin, Phone, Truck, Store, CheckCircle } from 'lucide-react'

// Minimal types to keep this component reusable
export type AssignRiderUser = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  is_available: boolean
  is_active: boolean
}

export type AssignRiderOrder = {
  id: string
  total_amount: number
  full_name: string | null
  phone: string | null
  order_status: string
  delivery_address: string | null
  // address context possibly provided by IX or metadata
  store_address_id?: string | null
  store_address?: any | null
  metadata?: any | null
  pickup_store_address_id?: string | null
}

export default function AssignRiderModal({
  isOpen,
  onClose,
  order,
  riders,
  onAssign,
}: {
  isOpen: boolean
  onClose: () => void
  order: AssignRiderOrder | null
  riders: AssignRiderUser[]
  // Optional external handler; if not provided we will POST to /api/assign ourselves
  onAssign?: (riderId: string) => Promise<void> | void
}) {
  const [selectedRiderId, setSelectedRiderId] = useState('')
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [storeAddresses, setStoreAddresses] = useState<{ id: string; name?: string; address: any; is_default?: boolean }[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(true)

  const isDeliveryAssignment = order?.order_status === 'ready_to_dispatch' || order?.order_status === 'ready_for_delivery'
  const assignmentType = isDeliveryAssignment ? 'delivery' : 'pickup'

  // --- Read incoming address from IX/metadata on the order ---
  const incomingAddressId =
    (order as any)?.store_address_id ??
    (order as any)?.metadata?.store_address_id ??
    (order as any)?.pickup_store_address_id ??
    ''

  const incomingAddressObj: any =
    (order as any)?.store_address ??
    (order as any)?.metadata?.store_address ??
    (order as any)?.pickup_store_address ??
    null

  useEffect(() => {
    if (!isOpen) return
    if (incomingAddressId) {
      setSelectedAddressId(String(incomingAddressId))
    } else if (incomingAddressObj?.id) {
      setSelectedAddressId(String(incomingAddressObj.id))
    }
    void fetchStoreAddresses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  async function fetchStoreAddresses() {
    setLoadingAddresses(true)
    try {
      const res = await fetch('/api/admin/store-address', { cache: 'no-store' })
      const data = await res.json()
      if (data?.ok) {
        const list = (data.data ?? []) as any[]
        setStoreAddresses(list)
        if (!incomingAddressId && !incomingAddressObj?.id) {
          const def = list.find((x) => x.is_default)
          const autoId = def?.id || list[0]?.id || ''
          if (autoId) setSelectedAddressId(String(autoId))
        }
      } else {
        console.error('Failed to load store addresses:', data?.error)
      }
    } catch (e) {
      console.error('Error fetching store addresses:', e)
    } finally {
      setLoadingAddresses(false)
    }
  }

  const available = (riders || []).filter((r) => r.is_active !== false && r.is_available !== false)

  function formatAddressDisplay(a: any) {
    if (!a || typeof a !== 'object') {
      return {
        name: 'Store',
        addressLine1: '—',
        addressLine2: null as string | null,
        cityStatePin: '—',
        phone: null as string | null,
      }
    }
    const src = a.address && typeof a.address === 'object' ? a.address : a
    const addressLine1 = src.address_line_1 ?? src.line1 ?? ''
    const addressLine2 = src.address_line_2 ?? src.line2 ?? ''
    const landmark = src.landmark ? ` (${src.landmark})` : ''
    const city = src.city ?? ''
    const state = src.state ?? ''
    const pincode = src.pincode ?? src.zip ?? ''
    const cityStatePin = [city, state, pincode].filter(Boolean).join(', ') || '—'
    const name = a.name ?? a.store_name ?? src.recipient_name ?? src.contact_person ?? 'Store'
    const phone = src.phone_number ?? src.phone ?? null
    return {
      name,
      addressLine1,
      addressLine2: (addressLine2 || landmark) ? `${addressLine2}${landmark}` : null,
      cityStatePin,
      phone,
    }
  }

  const activeAddressObj =
    incomingAddressObj ||
    (incomingAddressId && storeAddresses.find((s) => s.id === incomingAddressId)) ||
    null

  const handleAssignInternal = async () => {
    if (!selectedRiderId || !order) return

    // If external handler provided, delegate
    if (onAssign) {
      await Promise.resolve(onAssign(selectedRiderId))
      return
    }

    // Default: call our API
    let addressIdToSend = selectedAddressId
    if (!isDeliveryAssignment && !addressIdToSend) {
      if (incomingAddressObj?.id) addressIdToSend = String(incomingAddressObj.id)
      else if (storeAddresses.length) {
        const def = storeAddresses.find((x) => x.is_default)?.id || storeAddresses[0].id
        addressIdToSend = String(def)
      }
    }

    setIsAssigning(true)
    try {
      const response = await fetch('/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          userId: selectedRiderId,
          selectedAddressId: addressIdToSend || null,
          assignmentType,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) {
        throw new Error(result?.error || 'Assignment failed')
      }
      onClose()
      setSelectedRiderId('')
      setSelectedAddressId('')
    } catch (e) {
      console.error('Assignment error:', e)
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assign ${isDeliveryAssignment ? 'Delivery' : 'Pickup'} Rider`} size="xl">
      {order && (
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">Order Summary</h4>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isDeliveryAssignment ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {isDeliveryAssignment ? '🚚 Delivery Assignment' : '📦 Pickup Assignment'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
            <div className="mt-3">
              <span className="text-gray-500">Delivery Address:</span>
              <span className="ml-2 text-sm">{order.delivery_address || 'N/A'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Riders */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-600" />
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
                        selectedRiderId === r.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
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
                            <p className="text-xs text-gray-400">{r.phone || r.email || 'No contact'}</p>
                          </div>
                        </div>
                        {selectedRiderId === r.id && <CheckCircle className="h-4 w-4 text-green-500" />}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Store Addresses (Pickup only) */}
            {!isDeliveryAssignment && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Store className="h-4 w-4 text-green-600" />
                  Pickup Address
                </h4>
                {(incomingAddressId || incomingAddressObj) ? (
                  <div className="rounded border p-3 bg-blue-50">
                    {(() => {
                      const src = activeAddressObj?.address ? activeAddressObj : { address: incomingAddressObj || {} }
                      const info = formatAddressDisplay(src)
                      return (
                        <div className="text-sm">
                          <div className="font-semibold flex items-center gap-2">
                            {info.name}
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">From IronXpress</span>
                          </div>
                          <div>{info.addressLine1 || '—'}</div>
                          {info.addressLine2 && <div>{info.addressLine2}</div>}
                          <div>{info.cityStatePin}</div>
                          {info.phone && <div className="text-xs text-gray-600 mt-1">📞 {info.phone}</div>}
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  <>
                    {loadingAddresses ? (
                      <div className="text-center py-4 text-gray-500">
                        <div className="h-8 w-8 mx-auto mb-2 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <p>Loading addresses...</p>
                      </div>
                    ) : storeAddresses.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No store addresses available</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {storeAddresses.map((store) => {
                          const info = formatAddressDisplay(store.address)
                          return (
                            <label
                              key={store.id}
                              className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                                selectedAddressId === store.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <input
                                id={`address-${store.id}`}
                                name="address"
                                type="radio"
                                value={store.id}
                                checked={selectedAddressId === store.id}
                                onChange={(e) => setSelectedAddressId(e.target.value)}
                                className="sr-only"
                              />
                              <div className="flex items-start w-full">
                                <div className="flex-shrink-0 mr-3">
                                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                    <Store className="h-5 w-5 text-green-600" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 mb-1">{info.name}</div>
                                  {info.addressLine1 && <div className="text-sm text-gray-700 mb-1">{info.addressLine1}</div>}
                                  {info.addressLine2 && <div className="text-sm text-gray-600 mb-1">{info.addressLine2}</div>}
                                  <div className="text-sm text-gray-600 mb-1">{info.cityStatePin}</div>
                                  {info.phone && (
                                    <div className="flex items-center text-xs text-gray-500">
                                      <Phone className="h-3 w-3 mr-1" />
                                      <span>{info.phone}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-shrink-0 ml-2">
                                  <CheckCircle className={`h-4 w-4 ${selectedAddressId === store.id ? 'text-green-500' : 'text-gray-300'}`} />
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-600">
              {isDeliveryAssignment ? (
                selectedRiderId ? (
                  <span className="text-green-600">✓ Delivery rider selected</span>
                ) : (
                  <span className="text-gray-500">Please select a delivery rider</span>
                )
              ) : selectedRiderId ? (
                <span className="text-green-600">✓ Rider selected</span>
              ) : (
                <span className="text-gray-500">Please select a rider</span>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} disabled={isAssigning}>
                Cancel
              </Button>
              <Button onClick={handleAssignInternal} disabled={!selectedRiderId || available.length === 0} isLoading={isAssigning}>
                {isDeliveryAssignment ? 'Assign Delivery Rider' : 'Assign Pickup Rider'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
