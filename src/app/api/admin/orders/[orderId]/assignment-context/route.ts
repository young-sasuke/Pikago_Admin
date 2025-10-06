// src/app/api/admin/orders/[orderId]/assignment-context/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { AddressDTO } from '@/lib/address'

function numOrNull(v: any) { const n = Number(v); return Number.isFinite(n) ? n : null }

function customerFromOrder(o: any): AddressDTO {
  const dj = (o && typeof o.delivery_address === 'object') ? o.delivery_address : null
  return {
    label: o?.full_name ?? o?.customer_name ?? 'Customer',
    phone: o?.phone ?? o?.customer_phone ?? dj?.phone ?? dj?.phone_number ?? null,
    address_text:
      (typeof o?.delivery_address === 'string' && o.delivery_address) ||
      dj?.address_line_1 || dj?.address || o?.address || null,
    lat: numOrNull(dj?.latitude ?? dj?.lat) ?? numOrNull(o?.customer_lat) ?? null,
    lng: numOrNull(dj?.longitude ?? dj?.lng) ?? numOrNull(o?.customer_lng) ?? null,
  }
}

function storeFromRow(row: any): AddressDTO {
  const a = (row?.address && typeof row.address === 'object') ? row.address : {}
  const line1 = a?.address_line_1 ?? a?.line1 ?? ''
  const line2 = a?.address_line_2 ?? a?.line2 ?? ''
  const city = a?.city ?? ''
  const state = a?.state ?? ''
  const pin = a?.pincode ?? a?.zip ?? ''
  const address_text = [line1, line2, [city, state, pin].filter(Boolean).join(', ')].filter(Boolean).join(', ') || null
  return {
    label: row?.name ?? a?.recipient_name ?? a?.contact_person ?? 'Store',
    phone: a?.phone ?? a?.phone_number ?? null,
    address_text,
    lat: numOrNull(a?.latitude ?? a?.lat) ?? null,
    lng: numOrNull(a?.longitude ?? a?.lng) ?? null,
  }
}

async function resolveStoreAddressRow(order: any) {
  // Priority 1: on-order store address id/object
  const preferId = order?.store_address_id ?? order?.metadata?.store_address_id ?? order?.pickup_store_address_id ?? null
  if (preferId) {
    const { data } = await supabaseAdmin.from('store_addresses').select('*').eq('id', preferId).maybeSingle()
    if (data) return data
  }
  // Priority 2: default store
  const { data: def } = await supabaseAdmin
    .from('store_addresses')
    .select('*')
    .eq('is_default', true)
    .order('created_at', { ascending: false })
    .limit(1)
  if (def && def[0]) return def[0]
  // Priority 3: first row
  const { data: anyRow } = await supabaseAdmin
    .from('store_addresses')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
  return anyRow?.[0] ?? null
}

export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const type = ((new URL(req.url).searchParams.get('type') || 'pickup').toLowerCase() === 'delivery')
      ? 'delivery' : 'pickup'

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', params.orderId)
      .maybeSingle()
    if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const customer = customerFromOrder(order)
    const storeRow = await resolveStoreAddressRow(order)
    if (!storeRow) return NextResponse.json({ error: 'Store address missing' }, { status: 400 })
    const store = storeFromRow(storeRow)

    const pickup: AddressDTO  = type === 'pickup' ? customer : store
    const dropoff: AddressDTO = type === 'pickup' ? store    : customer

    return NextResponse.json({ pickup, dropoff, type })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'server_error' }, { status: 500 })
  }
}
