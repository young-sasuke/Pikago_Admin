// app/api/import-order/route.ts  (Pikago)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

export const runtime = 'nodejs'

const IMPORT_SECRET = process.env.IMPORT_SHARED_SECRET ?? ''
const IRON_BASE = process.env.IRONXPRESS_BASE_URL ?? ''
const IRON_TOKEN =
  process.env.IRONXPRESS_AUTH_TOKEN ??
  process.env.IRONXPRESS_SHARED_SECRET ??
  IMPORT_SECRET

export async function POST(req: NextRequest) {
  console.log('[import-order] 📥 Received import request from IronXpress')
  try {
    const headers = Object.fromEntries(req.headers.entries())
    console.log('[import-order] Headers:', JSON.stringify(headers, null, 2))

    // Shared-secret check
    const provided =
      req.headers.get('x-shared-secret') ??
      req.headers.get('x-pikago-secret') ??
      ''

    console.log(
      `[import-order] Secret check: provided='${provided}', expected='${IMPORT_SECRET}'`
    )

    if (IMPORT_SECRET && provided !== IMPORT_SECRET) {
      console.error('[import-order] ❌ Unauthorized - secret mismatch')
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    console.log('[import-order] ✅ Authorization passed')

    const body = (await req.json().catch(() => ({}))) || {}
    console.log('[import-order] Request body:', JSON.stringify(body, null, 2))

    const raw = body?.order ?? body?.data ?? body?.payload ?? body ?? {}
    console.log('[import-order] Extracted raw order:', JSON.stringify(raw, null, 2))

    const id =
      firstString(
        raw.id,
        raw.orderId,
        raw.order_id,
        raw.source_order_id,
        body.id,
        body.orderId
      ) ?? null

    console.log(`[import-order] Extracted order ID: ${id}`)

    // If the payload doesn't actually contain order fields, fetch from IronXpress
    const ironOrder =
      raw && hasAnyOrderFields(raw) ? raw : await fetchIronOrder(id)

    console.log('[import-order] Iron order data:', JSON.stringify(ironOrder, null, 2))

    if (!ironOrder || !id) {
      console.error(`[import-order] ❌ Missing data: ironOrder=${!!ironOrder}, id=${id}`)
      return NextResponse.json({ ok: false, error: 'missing order.id' }, { status: 400 })
    }

    console.log('[import-order] ✅ Order data validated, proceeding with import')

    const nowIso = new Date().toISOString()
    const row: any = {
      id: String(id),
      user_id: null,
      total_amount: num(ironOrder.total_amount),
      payment_method: ironOrder.payment_method ?? null,
      payment_status: ironOrder.payment_status ?? 'pending',
      payment_id: ironOrder.payment_id ?? null,
      order_status: ironOrder.order_status ?? 'accepted',
      pickup_date: d(ironOrder.pickup_date),
      pickup_slot_id: ironOrder.pickup_slot_id ?? null,
      delivery_date: d(ironOrder.delivery_date),
      delivery_slot_id: ironOrder.delivery_slot_id ?? null,
      delivery_type: ironOrder.delivery_type ?? null,
      delivery_address: ironOrder.delivery_address ?? null,
      address_details: ironOrder.address_details ?? null,
      applied_coupon_code: ironOrder.applied_coupon_code ?? null,
      discount_amount: num(ironOrder.discount_amount),
      created_at: ironOrder.created_at ?? nowIso,
      updated_at: nowIso,
      status: ironOrder.status ?? null,
      cancelled_at: ironOrder.cancelled_at ?? null,
      cancellation_reason: ironOrder.cancellation_reason ?? null,
      can_be_cancelled: bool(ironOrder.can_be_cancelled),
      original_pickup_slot_id: ironOrder.original_pickup_slot_id ?? null,
      original_delivery_slot_id: ironOrder.original_delivery_slot_id ?? null,
      pickup_slot_display_time: ironOrder.pickup_slot_display_time ?? null,
      pickup_slot_start_time: t(ironOrder.pickup_slot_start_time),
      pickup_slot_end_time: t(ironOrder.pickup_slot_end_time),
      delivery_slot_display_time: ironOrder.delivery_slot_display_time ?? null,
      delivery_slot_start_time: t(ironOrder.delivery_slot_start_time),
      delivery_slot_end_time: t(ironOrder.delivery_slot_end_time),
    }

    // ---- NEW: capture store address (no DB schema change) ----
    const store_address_id =
      ironOrder.store_address_id ??
      ironOrder?.metadata?.store_address_id ??
      ironOrder.pickup_store_address_id ??
      null

    const store_address =
      ironOrder.store_address ??
      ironOrder?.metadata?.store_address ??
      ironOrder.pickup_store_address ??
      null

    // Try to upsert WITH metadata (if column exists), else fallback without it
    const rowWithMeta =
      store_address || store_address_id
        ? {
            ...row,
            metadata: {
              ...(ironOrder?.metadata ?? {}),
              store_address_id,
              store_address,
            },
          }
        : row

    const upsertErr = await upsertOrderWithFallback(rowWithMeta, row)
    if (upsertErr) {
      console.error('[import-order] orders_upsert_failed:', upsertErr)
      return NextResponse.json(
        { ok: false, error: 'orders_upsert_failed', details: upsertErr.message ?? String(upsertErr) },
        { status: 500 }
      )
    }

    // Import/replace order_items (idempotent)
    try {
      const items = normalizeItems(String(id), ironOrder)
      console.log(`[import-order] Items to upsert: ${items.length}`)
      await replaceOrderItems(String(id), items)
      console.log('[import-order] ✅ order_items upserted successfully')
    } catch (e) {
      console.warn('[import-order] ⚠️ order_items upsert warning:', e)
      // do not fail the import
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[import-order] exception:', e)
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown_error' }, { status: 500 })
  }
}

/* ------------ items helpers ------------ */

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
      product_image, // NOT NULL in schema; empty string ok
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

/* ------------- existing helpers ------------- */
async function upsertOrderWithFallback(rowWithMeta: any, plainRow: any) {
  // Try with metadata (if present)
  try {
    const { error } = await supabaseAdmin.from('orders').upsert(rowWithMeta, { onConflict: 'id' })
    if (!error) return null
    // If metadata column missing (or any error), try plain row
    console.warn('[import-order] Upsert-with-metadata failed, retrying without metadata:', error?.message)
    const { error: e2 } = await supabaseAdmin.from('orders').upsert(plainRow, { onConflict: 'id' })
    return e2 ?? null
  } catch (e: any) {
    console.warn('[import-order] Upsert threw, retrying without metadata:', e?.message)
    try {
      const { error: e2 } = await supabaseAdmin.from('orders').upsert(plainRow, { onConflict: 'id' })
      return e2 ?? null
    } catch (e3: any) {
      return e3
    }
  }
}

function firstString(...vals: any[]) {
  for (const v of vals) {
    if (v === 0) return '0'
    if (v === null || v === undefined) continue
    const s = String(v)
    if (s.trim() !== '') return s
  }
  return null
}
function num(v: any) { const n = Number(v); return Number.isFinite(n) ? n : null }
function nz(n: any) { return Number.isFinite(n) ? n : 0 }
function d(v: any) { if (!v) return null; const x = new Date(v); return isNaN(+x) ? null : x.toISOString().slice(0, 10) }
function t(v: any) {
  if (!v) return null
  const s = String(v)
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  return `${m[1].padStart(2, '0')}:${m[2].padStart(2, '0')}:${(m[3] ?? '00').padStart(2, '0')}`
}
function bool(v: any) {
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  return null
}
function nonEmpty(v: any) { const s = String(v ?? '').trim(); return s.length ? s : 'Item' }
function stringOrEmpty(v: any) { return (v ?? '').toString() }
function int(v: any) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0 }
function hasAnyOrderFields(o: any) {
  if (!o || typeof o !== 'object') return false
  const keys = Object.keys(o)
  const indicative = ['total_amount', 'payment_method', 'payment_status', 'delivery_address']
  return keys.some((k) => indicative.includes(k))
}

async function fetchIronOrder(orderId: string | null) {
  if (!orderId || !IRON_BASE) {
    console.log(`[import-order] Cannot fetch order: orderId=${orderId}, IRON_BASE='${IRON_BASE}'`)
    return null
  }

  const url = `${IRON_BASE.replace(/\/+$/, '')}/api/admin/orders/${encodeURIComponent(orderId)}`
  console.log(`[import-order] Fetching order from: ${url}`)
  console.log(`[import-order] Using token: ${IRON_TOKEN ? 'TOKEN_SET' : 'TOKEN_MISSING'}`)

  try {
    const res = await fetch(url, {
      headers: {
        'x-shared-secret': IRON_TOKEN,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    const responseText = await res.text()
    console.log(`[import-order] IronXpress fetch response: ${res.status}`)
    console.log(`[import-order] Response body: ${responseText}`)

    if (!res.ok) {
      console.error('[import-order] IronXpress fetch failed', res.status, responseText)
      return null
    }

    const data = JSON.parse(responseText)
    const order = (data?.order ?? data) || null
    console.log('[import-order] Parsed order data:', JSON.stringify(order, null, 2))

    return order
  } catch (e) {
    console.error('[import-order] IronXpress fetch exception:', e)
    return null
  }
}
