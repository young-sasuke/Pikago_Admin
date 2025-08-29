// app/api/rider-webhooks/picked-up/route.ts
// When rider/app marks picked up: update PG and mirror IX as 'reached'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { syncPickedUpStatus } from '@/lib/db-sync'

export const runtime = 'nodejs'

const IRON_BASE = (process.env.IRONXPRESS_BASE_URL || '').replace(/\/+$/, '')
const INTERNAL_TOKEN =
  process.env.INTERNAL_API_SHARED_SECRET ||
  process.env.INTERNAL_API_SECRET ||
  ''

export async function POST(req: NextRequest) {
  console.log('[Picked Up Webhook] 📥 processing...')
  try {
    // Auth (Bearer or x-shared-secret)
    const authHeader = req.headers.get('authorization') || ''
    const sharedSecret = req.headers.get('x-shared-secret') || ''
    const expected = INTERNAL_TOKEN || process.env.ASSIGN_UPDATE_SECRET || ''

    const isAuthorized =
      (authHeader.startsWith('Bearer ') && authHeader.slice(7) === expected) ||
      sharedSecret === expected

    if (!isAuthorized) {
      console.error('[Picked Up Webhook] ❌ Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { orderId, riderId, riderName } = body
    if (!orderId) return NextResponse.json({ ok: false, error: 'orderId is required' }, { status: 400 })

    const nowIso = new Date().toISOString()

    // 1) Update orders.order_status
    {
      const { error } = await supabaseAdmin
        .from('orders')
        .update({
          order_status: 'picked_up',
          updated_at: nowIso,
          ...(riderId ? { user_id: riderId } : {}),
        })
        .eq('id', orderId)

      if (error) {
        console.error('[Picked Up Webhook] ❌ orders update failed:', error)
        return NextResponse.json({ ok: false, error: `orders update failed: ${error.message}` }, { status: 500 })
      }
    }

    // 2) Update assigned_orders.status
    {
      const patch: any = { status: 'picked_up', updated_at: nowIso }
      if (riderId) patch.user_id = riderId
      if (riderName) patch.rider_name = riderName

      const { error } = await supabaseAdmin.from('assigned_orders').update(patch).eq('id', orderId)
      if (error) {
        console.warn('[Picked Up Webhook] ⚠️ assigned_orders update failed:', error)
      }
    }

    // 3) Mirror to IX (via DB Sync helper; uses Bearer auth)
    await syncPickedUpStatus(orderId)

    return NextResponse.json({
      ok: true,
      message: `Order ${orderId} marked as picked_up`,
      orderId,
      status: 'picked_up',
    })
  } catch (e: any) {
    console.error('[Picked Up Webhook] ❌ Unexpected:', e)
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown_error' }, { status: 500 })
  }
}
