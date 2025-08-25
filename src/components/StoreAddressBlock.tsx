// components/StoreAddressBlock.tsx

'use client'

type StoreAddressJSON = {
  id?: string
  name?: string
  address?: {
    line1?: string
    line2?: string | null
    city?: string
    state?: string
    pincode?: string
    phone?: string
    latitude?: number | null
    longitude?: number | null
  }
  is_default?: boolean
}

export function StoreAddressBlock({
  order,
  allAddresses,
  hideFallbackSelector = false,
}: {
  order: any                               // the order object on the assign page
  allAddresses?: Array<{ id: string; name: string; address: any }>
  hideFallbackSelector?: boolean           // set true to fully remove selector
}) {
  // Read from multiple possible places (covers your import shapes)
  const incomingId: string | undefined =
    order?.store_address_id ??
    order?.metadata?.store_address_id ??
    order?.pickup_store_address_id

  const incomingObj: StoreAddressJSON | undefined =
    order?.store_address ??
    order?.metadata?.store_address ??
    order?.pickup_store_address

  // Prefer full object; else resolve by id from list; else null
  const active =
    incomingObj ??
    (incomingId && allAddresses?.find((a) => a.id === incomingId)) ??
    null

  if (active) {
    const a = (active as any).address || {}
    return (
      <div className="rounded border p-3 bg-blue-50">
        <div className="text-sm font-medium">Pickup store</div>
        <div className="text-sm mt-1">
          <div className="font-semibold">{(active as any).name ?? 'Store'}</div>
          <div>
            {a.line1}
            {a.line2 ? `, ${a.line2}` : ''}
          </div>
        </div>
        <div className="text-sm">
          {a.city}, {a.state} — {a.pincode}
        </div>
        {a.phone && <div className="text-xs text-gray-600">📞 {a.phone}</div>}
        {/* Keep the chosen id flowing through your existing form submit */}
        <input type="hidden" name="store_address_id" value={(active as any).id ?? incomingId ?? ''} />
      </div>
    )
  }

  // Fallback: show existing selector only if nothing came from IX
  if (hideFallbackSelector) {
    return (
      <div className="rounded border p-3 bg-yellow-50">
        <div className="text-sm">No store address provided by IX.</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Select store address</label>
      <select name="store_address_id" className="border rounded px-2 py-2 w-full">
        {allAddresses?.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} — {a.address?.city}
          </option>
        ))}
      </select>
    </div>
  )
}
