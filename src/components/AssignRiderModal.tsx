"use client"

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { MapPin, Phone, Truck, Store, CheckCircle, User } from 'lucide-react'

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
  onAssign?: (riderId: string) => Promise<void> | void
}) {
  const [selectedRiderId, setSelectedRiderId] = useState('')
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [storeAddresses, setStoreAddresses] = useState<{ id: string; name?: string; address: any; is_default?: boolean }[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(true)

  const isDeliveryAssignment = order?.order_status === 'ready_to_dispatch' || order?.order_status === 'ready_for_delivery'
  const assignmentType = isDeliveryAssignment ? 'delivery' : 'pickup'

  // ---- incoming IX → store context (if any) ----
  const incomingAddressIdRaw =
    (order as any)?.store_address_id ??
    (order as any)?.metadata?.store_address_id ??
    (order as any)?.pickup_store_address_id ??
    ''

  const incomingAddressId = incomingAddressIdRaw ? String(incomingAddressIdRaw) : ''
  const incomingAddressObj: any =
    (order as any)?.store_address ??
    (order as any)?.metadata?.store_address ??
    (order as any)?.pickup_store_address ??
    null

  useEffect(() => {
    if (!isOpen) return
    if (incomingAddressId) setSelectedAddressId(incomingAddressId)
    else if (incomingAddressObj?.id) setSelectedAddressId(String(incomingAddressObj.id))
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
        // If nothing came from IX, choose a sensible default
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

  // ✅ Robust, normalized resolution of the pickup store for BOTH flows
  const resolvedByIncomingId =
    (incomingAddressId &&
      storeAddresses.find((s) => String(s.id) === String(incomingAddressId))) ||
    null

  const resolvedBySelectedId =
    (selectedAddressId &&
      storeAddresses.find((s) => String(s.id) === String(selectedAddressId))) ||
    null

  const defaultStore = storeAddresses.find((s) => s.is_default) || storeAddresses[0] || null

  const activeAddressObj =
    incomingAddressObj ||
    resolvedByIncomingId ||
    resolvedBySelectedId ||
    defaultStore ||
    null

  async function handleAssignInternal() {
    if (!selectedRiderId || !order) return
    if (onAssign) {
      await Promise.resolve(onAssign(selectedRiderId))
      return
    }

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
          selectedAddressId: addressIdToSend || null, // dropoff store when pickup
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

  /* ---------- UI bits (higher contrast) ---------- */
  const Badge = ({ children, tone }: { children: any; tone: 'blue' | 'orange' }) => (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
      ${tone === 'blue' ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white'}`}
    >
      {children}
    </span>
  )

  const CustomerPickupCard = () => (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 shadow-sm">
      <div className="text-sm font-semibold text-slate-800 mb-1">Pickup Address (Customer)</div>
      <div className="flex items-start gap-3 text-sm text-slate-800">
        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
          <User className="h-4 w-4" />
        </div>
        <div>
          <div className="font-semibold">{order?.full_name || 'Customer'}</div>
          {order?.delivery_address && <div className="">{order.delivery_address}</div>}
          {order?.phone && <div className="text-xs text-slate-600 mt-1">📞 {order.phone}</div>}
        </div>
      </div>
    </div>
  )

  const StorePickupCard = () => (
    <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 shadow-sm">
      <div className="text-sm font-semibold text-slate-800 mb-1">Pickup Address (Store)</div>
      {(() => {
        const src = activeAddressObj?.address ? activeAddressObj : { address: activeAddressObj || {} }
        const info = formatAddressDisplay(src)
        return (
          <div className="text-sm text-slate-800">
            <div className="font-semibold flex items-center gap-2">
              {info.name}
              {(incomingAddressId || incomingAddressObj) && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-white">From IronXpress</span>
              )}
            </div>
            <div className="">{info.addressLine1 || '—'}</div>
            {info.addressLine2 && <div className="">{info.addressLine2}</div>}
            <div className="">{info.cityStatePin}</div>
            {info.phone && <div className="text-xs text-slate-600 mt-1">📞 {info.phone}</div>}
          </div>
        )
      })()}
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign ${isDeliveryAssignment ? 'Delivery' : 'Pickup'} Rider`}
      size="xl"
    >
      {order && (
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-white rounded-lg p-4 border border-slate-300 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-slate-900">Order Summary</h4>
              {isDeliveryAssignment ? (
                <Badge tone="orange">🚚 Delivery Assignment</Badge>
              ) : (
                <Badge tone="blue">📦 Pickup Assignment</Badge>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-slate-700">
                <span className="text-slate-600">Order ID:</span>
                <span className="ml-2 font-semibold text-slate-900">#{order.id.slice(0, 8)}</span>
              </div>
              <div className="text-slate-700">
                <span className="text-slate-600">Amount:</span>
                <span className="ml-2 font-semibold text-slate-900">{formatCurrency(order.total_amount)}</span>
              </div>
              <div className="text-slate-700">
                <span className="text-slate-600">Customer:</span>
                <span className="ml-2 font-semibold text-slate-900">{order.full_name || 'N/A'}</span>
              </div>
              <div className="text-slate-700">
                <span className="text-slate-600">Phone:</span>
                <span className="ml-2 font-semibold text-slate-900">{order.phone || 'N/A'}</span>
              </div>
            </div>
            <div className="mt-3 text-slate-700">
              <span className="text-slate-600">Delivery Address:</span>
              <span className="ml-2 text-sm font-medium text-slate-900">{order.delivery_address || 'N/A'}</span>
            </div>
          </div>

          {/* PICKUP: Riders + Dropoff store selector */}
          {!isDeliveryAssignment && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Riders */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-700" />
                  Available Riders ({available.length})
                </h4>
                {available.length === 0 ? (
                  <div className="text-center py-8 text-slate-600">
                    <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No riders available</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {available.map((r) => (
                      <label
                        key={r.id}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition
                          bg-white shadow-sm
                          ${selectedRiderId === r.id
                            ? 'border-blue-600 ring-2 ring-blue-200'
                            : 'border-slate-300 hover:bg-slate-50'}`}
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
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center
                              ${selectedRiderId === r.id ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'}`}>
                              <Truck className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{r.full_name}</p>
                              <p className="text-xs text-slate-600">{r.phone || r.email || 'No contact'}</p>
                            </div>
                          </div>
                          {selectedRiderId === r.id && <CheckCircle className="h-5 w-5 text-emerald-600" />}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Right column */}
              <div className="space-y-4">
                <CustomerPickupCard />
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Store className="h-4 w-4 text-emerald-700" />
                    Dropoff Store
                  </h4>

                  {(incomingAddressId || incomingAddressObj) ? (
                    <div className="rounded-lg border border-emerald-400 bg-emerald-50 p-3 shadow-sm">
                      {(() => {
                        const src = activeAddressObj?.address ? activeAddressObj : { address: activeAddressObj || {} }
                        const info = formatAddressDisplay(src)
                        return (
                          <div className="text-sm text-slate-900">
                            <div className="font-semibold flex items-center gap-2">
                              {info.name}
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-white">From IronXpress</span>
                            </div>
                            <div>{info.addressLine1 || '—'}</div>
                            {info.addressLine2 && <div>{info.addressLine2}</div>}
                            <div>{info.cityStatePin}</div>
                            {info.phone && <div className="text-xs text-slate-600 mt-1">📞 {info.phone}</div>}
                          </div>
                        )
                      })()}
                    </div>
                  ) : (
                    <>
                      {loadingAddresses ? (
                        <div className="text-center py-6 text-slate-600">
                          <div className="h-8 w-8 mx-auto mb-2 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
                          <p>Loading addresses...</p>
                        </div>
                      ) : storeAddresses.length === 0 ? (
                        <div className="text-center py-8 text-slate-600">
                          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No store addresses available</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {storeAddresses.map((store) => {
                            const info = formatAddressDisplay(store.address)
                            const selected = String(selectedAddressId) === String(store.id)
                            return (
                              <label
                                key={store.id}
                                className={`flex items-start p-3 border rounded-lg cursor-pointer transition bg-white shadow-sm
                                  ${selected ? 'border-emerald-600 ring-2 ring-emerald-200' : 'border-slate-300 hover:bg-slate-50'}`}
                              >
                                <input
                                  id={`address-${store.id}`}
                                  name="address"
                                  type="radio"
                                  value={store.id}
                                  checked={selected}
                                  onChange={(e) => setSelectedAddressId(e.target.value)}
                                  className="sr-only"
                                />
                                <div className="flex items-start w-full">
                                  <div className="flex-shrink-0 mr-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center
                                      ${selected ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                                      <Store className="h-5 w-5" />
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-slate-900 mb-1">{info.name}</div>
                                    {info.addressLine1 && <div className="text-sm text-slate-800 mb-1">{info.addressLine1}</div>}
                                    {info.addressLine2 && <div className="text-sm text-slate-700 mb-1">{info.addressLine2}</div>}
                                    <div className="text-sm text-slate-700 mb-1">{info.cityStatePin}</div>
                                    {info.phone && (
                                      <div className="flex items-center text-xs text-slate-600">
                                        <Phone className="h-3 w-3 mr-1" />
                                        <span>{info.phone}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-shrink-0 ml-2">
                                    <CheckCircle className={`h-5 w-5 ${selected ? 'text-emerald-600' : 'text-slate-300'}`} />
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
              </div>
            </div>
          )}

          {/* DELIVERY: Riders + Store card (readonly) */}
          {isDeliveryAssignment && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-700" />
                  Available Riders ({available.length})
                </h4>
                {available.length === 0 ? (
                  <div className="text-center py-8 text-slate-600">
                    <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No riders available</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {available.map((r) => (
                      <label
                        key={r.id}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition bg-white shadow-sm
                          ${selectedRiderId === r.id
                            ? 'border-blue-600 ring-2 ring-blue-200'
                            : 'border-slate-300 hover:bg-slate-50'}`}
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
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center
                              ${selectedRiderId === r.id ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'}`}>
                              <Truck className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{r.full_name}</p>
                              <p className="text-xs text-slate-600">{r.phone || r.email || 'No contact'}</p>
                            </div>
                          </div>
                          {selectedRiderId === r.id && <CheckCircle className="h-5 w-5 text-emerald-600" />}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <StorePickupCard />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div className="text-sm font-medium text-slate-700">
              {isDeliveryAssignment ? (
                selectedRiderId ? '✓ Delivery rider selected' : 'Please select a delivery rider'
              ) : selectedRiderId ? '✓ Rider selected' : 'Please select a rider'}
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
