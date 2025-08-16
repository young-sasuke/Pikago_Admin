// app/api/assign/route.ts  (Pikago)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const runtime = 'nodejs'

const IRON_BASE = process.env.IRONXPRESS_BASE_URL ?? 'http://localhost:3000'
const IRON_TOKEN =
  process.env.IRONXPRESS_AUTH_TOKEN ??
  process.env.IRONXPRESS_SHARED_SECRET ??
  process.env.IMPORT_SHARED_SECRET ??
  ''

// Direct IronXpress DB client (for status update -> notifications via triggers)
const IRONXPRESS_URL = 'https://qehtgclgjhzdlqcjujpp.supabase.co'
const IRONXPRESS_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlaHRnY2xnamh6ZGxxY2p1anBwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg0OTY3NiwiZXhwIjoyMDY2NDI1Njc2fQ.6wlzcNTxYbpWcP_Kbi6PNiFU7WgfQ66hDf3Zx8mvur0'

const ironxpressAdmin = createClient(IRONXPRESS_URL, IRONXPRESS_SERVICE_KEY, {
  auth: { persistSession: false },
})

export async function POST(req: NextRequest) {
  try {
    const { orderId: rawOrderId, userId } = await req.json()
    const orderId = String(rawOrderId ?? '').replace(/^#/, '').trim()

    if (!orderId || !userId) {
      return NextResponse.json(
        { ok: false, error: 'orderId and userId are required' },
        { status: 400 }
      )
    }

    // Ensure order exists locally; if not, import full order + items from IronXpress
    if (!(await orderExists(orderId))) {
      const imported = await importFromIronXpress(orderId)
      if (!imported) {
        return NextResponse.json(
          { ok: false, error: `Order ${orderId} not found` },
          { status: 404 }
        )
      }
    } else {
      // If no items locally, import items only
      await ensureItems(orderId)
    }

    // Update Pikago orders -> set rider + mark assigned
    const nowIso = new Date().toISOString()
    {
      const { error } = await supabaseAdmin
        .from('orders')
        .update({ user_id: userId, order_status: 'assigned', updated_at: nowIso })
        .eq('id', orderId)
      if (error) {
        return NextResponse.json(
          { ok: false, error: `order_update_failed: ${error.message}` },
          { status: 500 }
        )
      }
    }

    // Re-fetch the FULL order row (after update) to mirror all fields
    const { data: orderRow, error: fetchErr } = await supabaseAdmin
      .from('orders')
      .select(
        `
        id,
        user_id,
        total_amount,
        payment_method,
        payment_status,
        payment_id,
        order_status,
        pickup_date,
        pickup_slot_id,
        delivery_date,
        delivery_slot_id,
        delivery_type,
        delivery_address,
        address_details,
        applied_coupon_code,
        discount_amount,
        created_at,
        updated_at,
        status,
        cancelled_at,
        cancellation_reason,
        can_be_cancelled,
        original_pickup_slot_id,
        original_delivery_slot_id,
        pickup_slot_display_time,
        pickup_slot_start_time,
        pickup_slot_end_time,
        delivery_slot_display_time,
        delivery_slot_start_time,
        delivery_slot_end_time
      `
      )
      .eq('id', orderId)
      .maybeSingle()

    if (fetchErr || !orderRow) {
      return NextResponse.json(
        { ok: false, error: `order_fetch_failed: ${fetchErr?.message ?? 'not found'}` },
        { status: 500 }
      )
    }

    // Compute rider name to store in assigned_orders.rider_name
    const riderName = await getRiderName(userId)

    // Build assigned_orders payload by spreading ALL order fields,
    // then overriding assignment-specific fields.
    const assignedPayload = {
      ...orderRow,
      id: orderId,                // PK in assigned_orders
      user_id: userId,            // assigned rider (Pikago users.id)
      status: 'assigned',         // assignment status in assigned_orders
      rider_name: riderName,      // requires column in assigned_orders
      updated_at: nowIso,         // touch updated_at
    }

    // Upsert into assigned_orders mirroring the order
    {
      const { error } = await supabaseAdmin
        .from('assigned_orders')
        .upsert(assignedPayload as any, { onConflict: 'id' })

      if (error) {
        return NextResponse.json(
          { ok: false, error: `assigned_orders_upsert_failed: ${error.message}` },
          { status: 500 }
        )
      }
    }

    // Notify IronXpress by updating its DB to 'assigned' (triggers push/notification there)
    await notifyIronXpressAssigned(orderId, userId)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'unknown_error' },
      { status: 500 }
    )
  }
}

/* ---------------- helpers ---------------- */

async function orderExists(id: string) {
  const { data } = await supabaseAdmin.from('orders').select('id').eq('id', id).maybeSingle()
  return !!data
}

async function itemsCount(id: string) {
  const { count } = await supabaseAdmin
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', id)
  return count ?? 0
}

async function ensureItems(orderId: string) {
  const cnt = await itemsCount(orderId)
  if (cnt > 0) return true
  const full = await fetchOrderFromIronXpress(orderId)
  if (!full) return false
  const items = normalizeItems(orderId, full)
  await replaceOrderItems(orderId, items)
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
  const url = `${IRON_BASE.replace(/\/+$/, '')}/api/admin/orders/${encodeURIComponent(orderId)}`
  const res = await fetch(url, {
    headers: { 'x-shared-secret': IRON_TOKEN, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = await res.json()
  return data?.order ?? data ?? null
}

async function importFromIronXpress(orderId: string) {
  const full = await fetchOrderFromIronXpress(orderId)
  if (!full) return false
  const ok = await upsertPikagoOrder(orderId, full)
  if (!ok) return false
  const items = normalizeItems(orderId, full)
  await replaceOrderItems(orderId, items)
  return true
}

async function upsertPikagoOrder(id: string, o: any) {
  const nowIso = new Date().toISOString()
  const row: any = {
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

  const { error } = await supabaseAdmin.from('orders').upsert(row, { onConflict: 'id' })
  if (error) {
    console.warn('[assign] import upsert error:', error)
    return false
  }
  return true
}

async function notifyIronXpressAssigned(orderId: string, riderUserId: string) {
  try {
    const { data, error } = await ironxpressAdmin
      .from('orders')
      .update({ order_status: 'assigned', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select('id, order_status')
      .maybeSingle()

    if (error) {
      console.error('[assign] ❌ IronXpress DB update failed:', error)
      return false
    }
    if (!data) {
      console.error(`[assign] ❌ Order ${orderId} not found in IronXpress database`)
      return false
    }
    // IronXpress DB trigger will send the user notification.
    return true
  } catch (e) {
    console.error('[assign] ❌ IronXpress DB update exception:', e)
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
