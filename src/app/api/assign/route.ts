// app/api/assign/route.ts  (Pikago)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const IRON_BASE = process.env.IRONXPRESS_BASE_URL ?? 'http://localhost:3000'
const IRON_TOKEN =
  process.env.IRONXPRESS_AUTH_TOKEN ??
  process.env.IRONXPRESS_SHARED_SECRET ??
  process.env.IMPORT_SHARED_SECRET ??
  ''

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

    // 1) Ensure the order exists in Pikago; if not, pull it from IronXpress once
    if (!(await orderExists(orderId))) {
      const imported = await importFromIronXpress(orderId)
      if (!imported) {
        return NextResponse.json(
          { ok: false, error: `Order ${orderId} not found` },
          { status: 404 }
        )
      }
    }

    // 2) Upsert into assigned_orders (PK = id)
    const now = new Date().toISOString()
    {
      const { error } = await supabaseAdmin
        .from('assigned_orders')
        .upsert(
          { id: orderId, user_id: userId, status: 'assigned', updated_at: now },
          { onConflict: 'id' }
        )
      if (error) {
        return NextResponse.json(
          { ok: false, error: `assign_upsert_failed: ${error.message}` },
          { status: 500 }
        )
      }
    }

    // 3) Reflect on Pikago orders
    {
      const { error } = await supabaseAdmin
        .from('orders')
        .update({ user_id: userId, order_status: 'assigned', updated_at: now })
        .eq('id', orderId)

      if (error) {
        return NextResponse.json(
          { ok: false, error: `order_update_failed: ${error.message}` },
          { status: 500 }
        )
      }
    }

    // 4) Tell IronXpress to mark this order as 'assigned' (triggers app notification)
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
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (error) console.warn('[assign] orderExists error:', error)
  return !!data
}

async function importFromIronXpress(id: string) {
  try {
    const url = `${IRON_BASE.replace(/\/+$/, '')}/api/admin/orders/${encodeURIComponent(id)}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${IRON_TOKEN}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn('[assign] import fetch failed:', res.status, await res.text())
      return false
    }
    const data = await res.json()
    const o = (data?.order ?? data) || null
    if (!o) return false

    const nowIso = new Date().toISOString()
    const row: any = {
      id,
      user_id: null, // rider is assigned here, not copied from IronXpress
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
  } catch (e) {
    console.warn('[assign] import exception:', e)
    return false
  }
}

async function notifyIronXpressAssigned(orderId: string, riderUserId: string) {
  const url = `${IRON_BASE.replace(/\/+$/, '')}/api/admin/orders`
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${IRON_TOKEN}`, // 👈 REQUIRED by IronXpress
        Accept: 'application/json',
      },
      body: JSON.stringify({
        id: orderId,
        order_status: 'assigned',
        assigned_user_id: riderUserId, // safe even if IX ignores it
      }),
    })
    if (!res.ok) {
      console.warn('[assign] IronXpress PATCH failed:', res.status, await res.text())
    }
  } catch (e) {
    console.warn('[assign] IronXpress PATCH exception:', e)
  }
}

/* simple coercers */
function num(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function dateOnly(v: any) {
  if (!v) return null
  const d = new Date(v)
  return isNaN(+d) ? null : d.toISOString().slice(0, 10)
}
function hhmmss(v: any) {
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
