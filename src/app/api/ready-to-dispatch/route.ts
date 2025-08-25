// app/api/ready-to-dispatch/route.ts (Pikago)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

export const runtime = 'nodejs'

// -------- ENV (typed safely for TS) --------
const IRON_BASE_RAW = process.env.IRONXPRESS_BASE_URL
const IRON_TOKEN_RAW =
  process.env.IRONXPRESS_AUTH_TOKEN ??
  process.env.IRONXPRESS_SHARED_SECRET ??
  process.env.IMPORT_SHARED_SECRET
const INTERNAL_API_SHARED_SECRET_RAW = process.env.INTERNAL_API_SHARED_SECRET

// Runtime validation (same as before)
if (!IRON_BASE_RAW) {
  throw new Error('IRONXPRESS_BASE_URL environment variable is required')
}
if (!IRON_TOKEN_RAW) {
  throw new Error(
    'IRONXPRESS_AUTH_TOKEN or IRONXPRESS_SHARED_SECRET environment variable is required'
  )
}
if (!INTERNAL_API_SHARED_SECRET_RAW) {
  throw new Error('INTERNAL_API_SHARED_SECRET environment variable is required')
}

// TS-safe non-null values (use these everywhere below)
const IRON_BASE = IRON_BASE_RAW as string
const IRON_TOKEN = IRON_TOKEN_RAW as string
const INTERNAL_API_SHARED_SECRET = INTERNAL_API_SHARED_SECRET_RAW as string

/**
 * Ready to Dispatch endpoint
 * Called from IronXpress admin UI when an order is ready for delivery assignment
 * 1. Ensures latest order + items are synced to platform
 * 2. Updates platform order status to "ready_to_dispatch"
 * 3. Mirrors to IX via API (so IX sends notifications etc)
 */
export async function POST(req: NextRequest) {
  try {
    // Authentication check - only accept INTERNAL_API_SHARED_SECRET
    const authHeader = req.headers.get('authorization')
    const sharedSecretHeader = req.headers.get('x-shared-secret')
    const expectedSecret = INTERNAL_API_SHARED_SECRET

    const authType = authHeader ? 'Bearer' : sharedSecretHeader ? 'x-shared-secret' : 'none'
    console.log(`[Ready to Dispatch] 🔐 Auth attempt with ${authType} header`)

    const isValidAuth =
      authHeader === `Bearer ${expectedSecret}` || sharedSecretHeader === expectedSecret

    if (!isValidAuth) {
      console.log(`[Ready to Dispatch] ❌ Authentication failed`)
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId: rawOrderId } = await req.json()
    const orderId = String(rawOrderId ?? '').replace(/^#/, '').trim()

    if (!orderId) {
      return NextResponse.json({ ok: false, error: 'orderId is required' }, { status: 400 })
    }

    console.log(`[Ready to Dispatch] 🚀 Processing order ${orderId}`)

    // 1) Ensure we have the latest order/items from IX
    console.log(`[Ready to Dispatch] 🔄 Syncing order from IronXpress: ${orderId}`)
    const syncSuccess = await ensureOrderAndItemsFromIronXpress(orderId)
    if (!syncSuccess) {
      console.error(
        `[Ready to Dispatch] ❌ Failed to sync order ${orderId} from IronXpress`
      )
      return NextResponse.json(
        { ok: false, error: 'Failed to sync order data from source system' },
        { status: 424 }
      )
    }
    console.log(`[Ready to Dispatch] ✅ Synced order data: ${orderId}`)

    // 2) Update PG order status to "ready_to_dispatch"
    console.log(
      `[Ready to Dispatch] 🔄 Updating platform status: ${orderId} -> ready_to_dispatch`
    )
    const {
      data: updatedRows,
      error: platformUpdateError,
    } = await supabaseAdmin
      .from('orders')
      .update({
        order_status: 'ready_to_dispatch',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('id') // <= keep TS + older supabase-js happy; we use length instead of { count: 'exact' }
    if (platformUpdateError) {
      console.error(
        `[Ready to Dispatch] ❌ Failed to update platform: ${platformUpdateError.message}`
      )
      return NextResponse.json(
        { ok: false, error: `Failed to update platform: ${platformUpdateError.message}` },
        { status: 500 }
      )
    }
    if (!updatedRows || updatedRows.length === 0) {
      console.error(`[Ready to Dispatch] ❌ Order ${orderId} not found in platform`)
      return NextResponse.json(
        { ok: false, error: `Order ${orderId} not found` },
        { status: 404 }
      )
    }
    console.log(
      `[Ready to Dispatch] ✅ Updated platform: ${orderId} → ready_to_dispatch (${updatedRows.length} row)`
    )

    // 3) Mirror to IX to trigger notifications/workflows
    console.log(
      `[Ready to Dispatch] 🔄 Updating IronXpress via API: ${orderId} -> ready_to_dispatch`
    )
    const response = await fetch(`${IRON_BASE}/api/admin/orders`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${INTERNAL_API_SHARED_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        status: 'ready_to_dispatch',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(
        `[Ready to Dispatch] ❌ IronXpress API update failed: ${response.status} ${errorText}`
      )
      return NextResponse.json(
        { ok: false, error: `Failed to update source system: ${errorText}` },
        { status: 500 }
      )
    }

    console.log(
      `[Ready to Dispatch] ✅ Updated source system via API: ${orderId} → ready_to_dispatch`
    )

    return NextResponse.json({
      ok: true,
      message: `Order ${orderId} is now ready to dispatch and awaiting delivery assignment`,
    })
  } catch (e: any) {
    console.error('[Ready to Dispatch] ❌ Unexpected error:', e)
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown_error' }, { status: 500 })
  }
}

/* ------------ Helpers ------------ */

async function ensureOrderAndItemsFromIronXpress(orderId: string) {
  console.log(`[Ready to Dispatch] 🔄 Syncing fresh order + items for ${orderId}`)

  const full = await fetchOrderFromIronXpress(orderId)
  if (!full) {
    console.warn(`[Ready to Dispatch] ⚠️ Could not fetch order ${orderId} from IronXpress`)
    return false
  }

  // Upsert order
  const orderSynced = await upsertPikagoOrder(orderId, full)
  if (!orderSynced) {
    console.warn(`[Ready to Dispatch] ⚠️ Failed to sync order ${orderId}`)
    return false
  }

  // Replace items
  const items = normalizeItems(orderId, full)
  try {
    await replaceOrderItems(orderId, items)
    console.log(
      `[Ready to Dispatch] ✅ Synced ${items.length} items for order ${orderId}`
    )
  } catch (e) {
    console.warn(`[Ready to Dispatch] ⚠️ Items sync warning for ${orderId}:`, e)
  }

  return true
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
    console.warn('[Ready to Dispatch] import upsert error:', error)
    return false
  }
  return true
}

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
