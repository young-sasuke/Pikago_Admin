import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Server-side admin client (bypasses RLS for writes).
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const orderId = String(body?.orderId || '').trim()
    const riderId = String(body?.riderId || '').trim()

    if (!orderId || !riderId) {
      return NextResponse.json(
        { ok: false, error: 'orderId and riderId are required' },
        { status: 400 }
      )
    }

    // 1) Ensure order exists (public.orders.id is TEXT in your DB)
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) {
      return NextResponse.json(
        { ok: false, error: `Order not found: ${orderId}` },
        { status: 404 }
      )
    }

    // 2) Ensure rider exists and is active
    const { data: rider, error: riderErr } = await supabaseAdmin
      .from('riders')
      .select('*')
      .eq('id', riderId)
      .eq('is_active', true)
      .single()

    if (riderErr || !rider) {
      return NextResponse.json(
        { ok: false, error: `Active rider not found: ${riderId}` },
        { status: 404 }
      )
    }

    // 3) Upsert into order_assignments (optional but useful for history)
    //    If your table differs, adjust column names here.
    //    We keep one ACTIVE/ASSIGNED row per order (idempotent upsert).
    //    If you don't have a unique index on (order_id), we emulate with delete+insert.
    const { error: delErr } = await supabaseAdmin
      .from('order_assignments')
      .delete()
      .eq('order_id', orderId)

    if (delErr && delErr.code !== 'P0001') {
      // ignore if table enforces FK or no rows
      console.warn('order_assignments delete warning:', delErr)
    }

    const { error: insErr } = await supabaseAdmin
      .from('order_assignments')
      .insert({
        order_id: orderId,         // TEXT → references public.orders(id)
        rider_id: riderId,         // UUID → references public.riders(id)
        status: 'assigned'         // keep simple; you can extend later
      })

    if (insErr) {
      // Non-fatal for UI; we still move the order to assigned for realtime
      console.warn('order_assignments insert error:', insErr)
    }

    // 4) Update order status so your Orders list (subscribed to public.orders) refreshes immediately
    const { error: updErr } = await supabaseAdmin
      .from('orders')
      .update({ order_status: 'assigned', updated_at: new Date().toISOString() })
      .eq('id', orderId)

    if (updErr) {
      return NextResponse.json(
        { ok: false, error: `Failed to update order status: ${updErr.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Assign API error:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export function GET() {
  return NextResponse.json({ ok: false, error: 'Method Not Allowed' }, { status: 405 })
}
