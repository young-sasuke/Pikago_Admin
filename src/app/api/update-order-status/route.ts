// app/api/update-order-status/route.ts
// MAIN endpoint for mobile/admin to update status.
// Fixes: also updates orders.order_status and uses syncPickedUpStatus.

import { NextRequest, NextResponse } from 'next/server'
import { upsertAssignedOrderWithSync, syncPickedUpStatus } from '@/lib/db-sync'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { mirrorIXStatus } from '@/lib/ironxpress-mirror' // ✅ added

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  console.log('[Update Order Status] 📥 Received status update request')
  try {
    // Simple auth (Bearer or shared-secret)
    const authHeader = req.headers.get('authorization') || ''
    const sharedSecret = req.headers.get('x-shared-secret') || ''
    const expectedSecret = process.env.INTERNAL_API_SHARED_SECRET || process.env.INTERNAL_API_SECRET || process.env.ASSIGN_UPDATE_SECRET || ''

    const isAuthorized =
      (authHeader.startsWith('Bearer ') && authHeader.slice(7) === expectedSecret) ||
      sharedSecret === expectedSecret

    if (!isAuthorized) {
      console.error('[Update Order Status] ❌ Unauthorized request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { orderId, status, riderId, riderName } = body

    if (!orderId || !status) {
      return NextResponse.json({ error: 'orderId and status are required' }, { status: 400 })
    }

    console.log(`[Update Order Status] 🔄 Updating ${orderId} to status: ${status}`)

    // 1) Ensure order exists
    const { data: currentOrder, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (fetchError || !currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const nowIso = new Date().toISOString()

    // 2) Update orders.order_status to keep PG in sync with app status
    {
      const { error } = await supabaseAdmin
        .from('orders')
        .update({
          order_status: status, // mirror provided status
          updated_at: nowIso,
          ...(riderId ? { user_id: riderId } : {}),
        })
        .eq('id', orderId)

      if (error) {
        console.error('[Update Order Status] ❌ orders update failed:', error)
        return NextResponse.json({ error: 'orders update failed' }, { status: 500 })
      }
    }

    // 3) Upsert into assigned_orders (keeps existing flow intact)
    const updatePayload = {
      ...currentOrder,
      id: orderId,
      status, // assigned_orders.status
      user_id: riderId || currentOrder.user_id,
      rider_name: riderName || currentOrder.rider_name || 'Rider',
      updated_at: nowIso,
    }

    const result = await upsertAssignedOrderWithSync(updatePayload, { onConflict: 'id' })
    if (result.error) {
      console.error('[Update Order Status] ❌ assigned_orders upsert failed:', result.error)
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
    }

    // 4) Safety: if picked_up, ensure IX mirror fired
    if (status === 'picked_up') {
      await syncPickedUpStatus(orderId)
    }

    // ✅ 5) Mirror shipped → IronXpress (idempotent)
    try {
      if (status === 'shipped') {
        await mirrorIXStatus(orderId, 'shipped', 'admin_update')
      }
    } catch (e) {
      console.warn('[Update Order Status] IX mirror failed (shipped):', e)
    }

    console.log(`[Update Order Status] ✅ ${orderId} → ${status}`)
    return NextResponse.json({ success: true, orderId, status })
  } catch (error) {
    console.error('[Update Order Status] ❌ Exception:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Optional status check (unchanged)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orderId = searchParams.get('orderId')
  if (!orderId) return NextResponse.json({ error: 'orderId parameter required' }, { status: 400 })

  try {
    const { data: assignment } = await supabaseAdmin
      .from('assigned_orders')
      .select('id, status, updated_at')
      .eq('id', orderId)
      .maybeSingle()

    if (!assignment) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    return NextResponse.json({
      orderId: assignment.id,
      status: assignment.status,
      updatedAt: assignment.updated_at,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch order status' }, { status: 500 }) 
  }
}
