// app/api/assign/route.ts (Pikago)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { autoSyncPickedUpStatus } from '@/lib/ironxpress-mirror'
import crypto from 'crypto'

export const runtime = 'nodejs'

// --- Typed env (avoid TS “possibly undefined”) ---
const IRON_BASE_URL: string = process.env.IRONXPRESS_BASE_URL as string
const IRON_TOKEN_VALUE: string = (
  process.env.IRONXPRESS_AUTH_TOKEN ??
  process.env.IRONXPRESS_SHARED_SECRET ??
  process.env.IMPORT_SHARED_SECRET
) as string
const INTERNAL_API_SECRET: string = process.env.INTERNAL_API_SECRET as string

if (!IRON_BASE_URL) throw new Error('IRONXPRESS_BASE_URL environment variable is required')
if (!IRON_TOKEN_VALUE) throw new Error('IRONXPRESS_AUTH_TOKEN or IRONXPRESS_SHARED_SECRET environment variable is required')
if (!INTERNAL_API_SECRET) throw new Error('INTERNAL_API_SECRET environment variable is required')

export async function POST(req: NextRequest) {
  try {
    const {
      orderId: rawOrderId,
      userId,
      selectedAddressId,
      assignmentType = 'pickup',
    } = await req.json()

    const orderId = String(rawOrderId ?? '').replace(/^#/, '').trim()
    if (!orderId || !userId) {
      return NextResponse.json({ ok: false, error: 'orderId and userId are required' }, { status: 400 })
    }

    // Always ensure fresh order + items from IX (idempotent)
    await ensureOrderAndItemsFromIronXpress(orderId)

    // FIX: If delivery assignment, keep PG order as "ready_for_delivery" 
    const orderStatus = assignmentType === 'delivery' ? 'ready_for_delivery' : 'assigned'
    const nowIso = new Date().toISOString()
    
    console.log(`[Assign] 🔄 Processing ${assignmentType} assignment for order ${orderId}, status: ${orderStatus}`)

    // Update PG orders table with selected rider and status
    {
      const { error } = await supabaseAdmin
        .from('orders')
        .update({ user_id: userId, order_status: orderStatus, updated_at: nowIso })
        .eq('id', orderId)
      if (error) {
        return NextResponse.json(
          { ok: false, error: `order_update_failed: ${error.message}` },
          { status: 500 }
        )
      }
    }

    // Re-fetch complete order row for assigned_orders payload
    const { data: orderRow, error: fetchErr } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (fetchErr || !orderRow) {
      return NextResponse.json(
        { ok: false, error: `order_fetch_failed: ${fetchErr?.message ?? 'not found'}` },
        { status: 500 }
      )
    }

    const riderName = await getRiderName(userId)

    // Resolve drop_address (for pickup assignment)
    let dropAddress: any = null
    if (selectedAddressId) {
      const { data: addressData, error: addressError } = await supabaseAdmin
        .from('store_addresses')
        .select('*')
        .eq('id', selectedAddressId)
        .single()
      if (!addressError) dropAddress = addressData?.address ?? null
    } else if (assignmentType === 'pickup') {
      const meta = (orderRow as any)?.metadata ?? null
      const metaAddr = meta?.store_address ?? meta?.pickup_store_address ?? null
      if (metaAddr) {
        dropAddress = metaAddr
      } else {
        const ix = await fetchOrderFromIronXpress(orderId)
        const ixAddr =
          ix?.store_address ??
          ix?.metadata?.store_address ??
          ix?.pickup_store_address ??
          null
        if (ixAddr) {
          dropAddress = ixAddr
        } else {
          const { data: list } = await supabaseAdmin
            .from('store_addresses')
            .select('*')
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
          dropAddress = list?.[0]?.address ?? null
        }
      }
    }

    // Upsert into assigned_orders (one row per orderId)
    const assignedPayload: any = {
      ...orderRow,
      id: orderId,
      user_id: userId,
      status: 'assigned',
      rider_name: riderName,
      drop_address: dropAddress,
      updated_at: nowIso,
    }
    delete assignedPayload.metadata

    {
      const { error } = await supabaseAdmin
        .from('assigned_orders')
        .upsert(assignedPayload, { onConflict: 'id' })

      if (error) {
        // If schema doesn't have drop_address, retry without it
        const retry = { ...assignedPayload }
        delete retry.drop_address
        const { error: e2 } = await supabaseAdmin
          .from('assigned_orders')
          .upsert(retry, { onConflict: 'id' })
        if (e2) {
          return NextResponse.json(
            { ok: false, error: `assigned_orders_upsert_failed: ${e2.message}` },
            { status: 500 }
          )
        }
      }
    }

    // Mirror to IronXpress:
    //  - pickup assignment -> IX "assigned"
    //  - delivery assignment -> NO notification here (shipped sent later when delivery rider picks up)
    if (assignmentType === 'pickup') {
      await notifyIronXpressAssigned(orderId, userId, assignmentType)
    } else {
      console.log(`[Assign] 🗺️ Skipping IX notification for delivery assignment - shipped will be sent when delivery rider picks up`)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown_error' }, { status: 500 })
  }
}

/* ---------------- helpers ---------------- */

async function ensureOrderAndItemsFromIronXpress(orderId: string) {
  const full = await fetchOrderFromIronXpress(orderId)
  if (!full) return false

  const ok = await upsertPikagoOrder(orderId, full)
  if (!ok) return false

  const items = normalizeItems(orderId, full)
  try {
    await replaceOrderItems(orderId, items)
  } catch {
    // ignore, keep flow
  }
  return true
}

async function getRiderName(userId: string): Promise<string> {
  const { data: dp } = await supabaseAdmin
    .from('delivery_partners')
    .select('first_name,last_name')
    .eq('user_id', userId)
    .maybeSingle()

  const full = [dp?.first_name, dp?.last_name].filter(Boolean).join(' ').trim()
  if (full) return full

  const { data: u } = await supabaseAdmin
    .from('users')
    .select('email,phone')
    .eq('id', userId)
    .maybeSingle()

  return u?.email ?? u?.phone ?? 'Rider'
}

async function fetchOrderFromIronXpress(orderId: string) {
  const url = `${IRON_BASE_URL}/api/admin/orders/${encodeURIComponent(orderId)}`
  const res = await fetch(url, {
    headers: { 'x-shared-secret': IRON_TOKEN_VALUE, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = await res.json()
  return data?.order ?? data ?? null
}

async function upsertPikagoOrder(id: string, o: any) {
  const nowIso = new Date().toISOString()

  const store_address_id =
    o.store_address_id ??
    o?.metadata?.store_address_id ??
    o.pickup_store_address_id ??
    null

  const store_address =
    o.store_address ??
    o?.metadata?.store_address ??
    o.pickup_store_address ??
    null

  const baseRow: any = {
    id,
    user_id: null,
    total_amount: num(o.total_amount),
    payment_method: o.payment_method ?? null,
    payment_status: o.payment_status ?? 'pending',
    payment_id: o.payment_id ?? null,
    order_status: o.order_status ?? 'accepted',
    pickup_date: dateOnly(o.pickup_date),
    pickup_slot_id: o.pickup_slot_id ?? null,
    delivery_date: dateOnly(o.delivery_date),
    delivery_slot_id: o.delivery_slot_id ?? null,
    delivery_type: o.delivery_type ?? null,
    delivery_address: o.delivery_address ?? null,
    address_details: o.address_details ?? null,
    applied_coupon_code: o.applied_coupon_code ?? null,
    discount_amount: num(o.discount_amount),
    created_at: o.created_at ?? nowIso,
    updated_at: nowIso,
    status: o.status ?? null,
    cancelled_at: o.cancelled_at ?? null,
    cancellation_reason: o.cancellation_reason ?? null,
    can_be_cancelled: bool(o.can_be_cancelled),
    original_pickup_slot_id: o.original_pickup_slot_id ?? null,
    original_delivery_slot_id: o.original_delivery_slot_id ?? null,
    pickup_slot_display_time: o.pickup_slot_display_time ?? null,
    pickup_slot_start_time: hhmmss(o.pickup_slot_start_time),
    pickup_slot_end_time: hhmmss(o.pickup_slot_end_time),
    delivery_slot_display_time: o.delivery_slot_display_time ?? null,
    delivery_slot_start_time: hhmmss(o.delivery_slot_start_time),
    delivery_slot_end_time: hhmmss(o.delivery_slot_end_time),
  }

  const withMeta =
    store_address || store_address_id
      ? {
          ...baseRow,
          metadata: {
            ...(o?.metadata ?? {}),
            store_address_id,
            store_address,
          },
        }
      : baseRow

  try {
    const { error } = await supabaseAdmin.from('orders').upsert(withMeta, { onConflict: 'id' })
    if (!error) return true
    const { error: e2 } = await supabaseAdmin.from('orders').upsert(baseRow, { onConflict: 'id' })
    return !e2
  } catch {
    try {
      const { error: e2 } = await supabaseAdmin.from('orders').upsert(baseRow, { onConflict: 'id' })
      return !e2
    } catch {
      return false
    }
  }
}

async function notifyIronXpressAssigned(orderId: string, riderUserId: string, assignmentType: string = 'pickup') {
  try {
    console.log(`[Assign] 🔄 Notifying IronXpress: ${orderId} -> assigned`)
    const response = await fetch(`${IRON_BASE_URL}/api/admin/orders`, {
      method: 'PATCH',
      headers: {
        'x-shared-secret': INTERNAL_API_SECRET,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ orderId, status: 'assigned' }),
    })
    if (!response.ok) {
      console.warn(`[Assign] ❌ Failed to notify IronXpress: ${response.status}`)
      return false
    }
    console.log(`[Assign] ✅ Successfully notified IronXpress: ${orderId} -> assigned`)
    return true
  } catch (error) {
    console.warn(`[Assign] ❌ Exception notifying IronXpress:`, error)
    return false
  }
}

/* ---------- items sync helpers ---------- */

function normalizeItems(orderId: string, full: any) {
  const raw = Array.isArray(full?.order_items)
    ? full.order_items
    : Array.isArray(full?.items)
    ? full.items
    : []

  const now = new Date().toISOString()
  return raw.map((it: any, idx: number) => {
    const product_name = nonEmpty(it.product_name ?? it.name ?? it.title ?? `Item ${idx + 1}`)
    const product_price = num(it.product_price ?? it.price ?? 0)
    const service_type = nonEmpty(it.service_type ?? it.service ?? 'standard')
    const service_price = num(it.service_price ?? 0)
    const qty = int(it.quantity ?? 1)
    const total_price = num(
      it.total_price ?? (Number(product_price ?? 0) + Number(service_price ?? 0)) * qty
    )
    const product_id = it.product_id ?? null
    const product_image = stringOrEmpty(it.product_image ?? it.image ?? it.photo ?? '')

    return {
      id: crypto.randomUUID(),
      order_id: orderId,
      product_name,
      product_price: nz(product_price),
      service_type,
      service_price: nz(service_price),
      quantity: nz(qty),
      total_price: nz(total_price),
      created_at: now,
      updated_at: now,
      product_id,
      product_image,
    }
  })
}

async function replaceOrderItems(orderId: string, items: any[]) {
  const { error: delErr } = await supabaseAdmin.from('order_items').delete().eq('order_id', orderId)
  if (delErr) throw delErr
  if (!items.length) return { deleted: 0, inserted: 0 }
  const { error: insErr } = await supabaseAdmin.from('order_items').insert(items)
  if (insErr) throw insErr
  return { deleted: 0, inserted: items.length }
}

/* ---------- coercers ---------- */
function nonEmpty(v: any) { const s = String(v ?? '').trim(); return s.length ? s : 'Item' }
function stringOrEmpty(v: any) { return (v ?? '').toString() }
function nz(n: any) { return Number.isFinite(n) ? n : 0 }
function num(v: any) { const n = Number(v); return Number.isFinite(n) ? n : null }
function int(v: any) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0 }
function dateOnly(v: any) { if (!v) return null; const d = new Date(v); return isNaN(+d) ? null : d.toISOString().slice(0,10) }
function hhmmss(v: any) {
  if (!v) return null
  const s = String(v); const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  return `${m[1].padStart(2,'0')}:${m[2].padStart(2,'0')}:${(m[3] ?? '00').padStart(2,'0')}`
}
function bool(v: any) {
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  return null
}
