// lib/db-sync.ts - Universal database sync for status changes
// Ensures ANY update to assigned_orders.status='picked_up' (or orders.order_status)
// mirrors to IX as 'reached'

import { supabaseAdmin } from './supabase-admin'

// Env
const IRON_BASE = (process.env.IRONXPRESS_BASE_URL || '').replace(/\/+$/, '')
const INTERNAL_TOKEN =
  process.env.INTERNAL_API_SHARED_SECRET ||
  process.env.INTERNAL_API_SECRET ||
  ''

function haveIxConfig() {
  return Boolean(IRON_BASE && INTERNAL_TOKEN)
}

/** Call IX: orderId -> 'reached' (idempotent on IX side). */
async function mirrorPickedUpToIX(orderId: string) {
  if (!haveIxConfig()) {
    console.warn('[DB Sync] ⚠️ Missing IRONXPRESS_BASE_URL or INTERNAL_API_* secret')
    return
  }

  try {
    const resp = await fetch(`${IRON_BASE}/api/admin/orders`, {
      method: 'PATCH',
      headers: {
        // IMPORTANT: use Bearer, IX expects this for internal calls
        Authorization: `Bearer ${INTERNAL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId, status: 'reached' }),
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => 'Unknown error')
      console.error(`[DB Sync] ❌ IX mirror failed: ${resp.status} ${text}`)
    } else {
      console.log(`[DB Sync] ✅ Mirrored ${orderId}: picked_up → IX reached`)
    }
  } catch (e) {
    console.error('[DB Sync] ❌ IX mirror exception:', e)
  }
}

/**
 * Use after ANY write that could set assigned_orders.status='picked_up'
 */
export async function syncPickedUpStatus(orderId: string): Promise<void> {
  try {
    // Prefer assigned_orders.status
    const { data: assignment } = await supabaseAdmin
      .from('assigned_orders')
      .select('status')
      .eq('id', orderId)
      .maybeSingle()

    if (assignment?.status === 'picked_up') {
      await mirrorPickedUpToIX(orderId)
      return
    }

    // Fallback: also check orders.order_status (some flows update only this)
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('order_status')
      .eq('id', orderId)
      .maybeSingle()

    if (order?.order_status === 'picked_up') {
      await mirrorPickedUpToIX(orderId)
      return
    }

    console.log(
      `[DB Sync] ℹ️ ${orderId} not picked_up (assigned_orders=${assignment?.status} / orders=${order?.order_status})`
    )
  } catch (error) {
    console.error(`[DB Sync] ❌ Exception while syncing ${orderId}:`, error)
  }
}

/**
 * Upsert wrapper for assigned_orders with auto-sync
 */
export async function upsertAssignedOrderWithSync(
  orderData: any,
  options: { onConflict?: string } = { onConflict: 'id' }
) {
  const orderId = orderData?.id
  const result = await supabaseAdmin.from('assigned_orders').upsert(orderData, options)
  if (!result.error && orderId) await syncPickedUpStatus(orderId)
  return result
}

/**
 * Update wrapper for assigned_orders with auto-sync
 */
export async function updateAssignedOrderWithSync(orderData: any, orderId: string) {
  const result = await supabaseAdmin.from('assigned_orders').update(orderData).eq('id', orderId)
  if (!result.error) await syncPickedUpStatus(orderId)
  return result
}
