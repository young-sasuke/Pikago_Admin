import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { orderId, userId } = await req.json()

    if (!orderId || !userId) {
      return NextResponse.json(
        { ok: false, error: 'orderId and userId are required' },
        { status: 400 }
      )
    }

    // 1) Make sure the order exists (and read anything you want to mirror)
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id,total_amount,payment_status,delivery_address,pickup_date,delivery_date')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) {
      return NextResponse.json(
        { ok: false, error: `Order ${orderId} not found` },
        { status: 404 }
      )
    }

    // 2) Upsert into assigned_orders
    // NOTE: the PK column is "id" (same as the order id), not "order_id"
    const now = new Date().toISOString()
    const payload = {
      id: orderId,                 // <-- important: 'id', not 'order_id'
      user_id: userId,
      status: 'assigned',
      updated_at: now,
      // optional: mirror a few order fields so assigned_orders has context
      total_amount: order.total_amount ?? null,
      payment_status: order.payment_status ?? null,
      delivery_address: order.delivery_address ?? null,
      pickup_date: order.pickup_date ?? null,
      delivery_date: order.delivery_date ?? null,
    }

    const { error: upsertErr } = await supabaseAdmin
      .from('assigned_orders')
      .upsert(payload, { onConflict: 'id' }) // conflict target is "id"
    if (upsertErr) {
      return NextResponse.json(
        { ok: false, error: `assign_upsert_failed: ${upsertErr.message}` },
        { status: 500 }
      )
    }

    // 3) Reflect assignment on the order itself
    const { error: updErr } = await supabaseAdmin
      .from('orders')
      .update({ user_id: userId, order_status: 'assigned', updated_at: now })
      .eq('id', orderId)

    if (updErr) {
      return NextResponse.json(
        { ok: false, error: `order_update_failed: ${updErr.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'unknown_error' },
      { status: 500 }
    )
  }
}
