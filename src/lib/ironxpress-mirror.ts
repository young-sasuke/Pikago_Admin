// lib/ironxpress-mirror.ts
// Centralized utility for mirroring Pikago status updates to IronXpress

import { supabaseAdmin } from './supabase-admin'

// Environment configuration
const IRON_BASE_RAW = process.env.IRONXPRESS_BASE_URL || ''
const IRON_BASE = IRON_BASE_RAW.replace(/\/$/, '') // normalize: strip trailing slash
const IRON_AUTH_SECRET = process.env.INTERNAL_API_SECRET || process.env.INTERNAL_API_SHARED_SECRET || ''

// Validate required environment variables
if (!IRON_BASE) {
  console.warn('[IronXpress Mirror] IRONXPRESS_BASE_URL not configured - IX sync disabled')
}
if (!IRON_AUTH_SECRET) {
  console.warn('[IronXpress Mirror] INTERNAL_API_SECRET not configured - IX sync disabled')
}

/**
 * Mirror a Pikago order status to IronXpress
 * @param orderId - The order ID to update
 * @param ixStatus - The status to set in IronXpress (e.g., 'reached')
 * @param sourceContext - Context for logging (e.g., 'picked_up')
 * @returns Promise<boolean> - true if successful, false if failed (non-blocking)
 */
export async function mirrorIXStatus(
  orderId: string, 
  ixStatus: string, 
  sourceContext: string = 'status_update'
): Promise<boolean> {
  // Skip if not configured
  if (!IRON_BASE || !IRON_AUTH_SECRET) {
    console.log(`[IX Mirror] Skipping ${sourceContext} → ${ixStatus} for ${orderId} (not configured)`)
    return false
  }

  try {
    console.log(`[IX Mirror] 🔄 PG ${sourceContext} → IX ${ixStatus} for order ${orderId}`)

    // Optional: Check current IX status to avoid redundant calls (idempotent behavior)
    const currentIXStatus = await getCurrentIXStatus(orderId)
    if (currentIXStatus === ixStatus) {
      console.log(`[IX Mirror] ℹ️ Order ${orderId} already has IX status ${ixStatus}, skipping`)
      return true
    }

    // Make the PATCH call to IronXpress
    const response = await fetch(`${IRON_BASE}/api/admin/orders`, {
      method: 'PATCH',
      headers: {
        'x-shared-secret': IRON_AUTH_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: orderId,
        status: ixStatus
      })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.warn(`[IX Mirror] ❌ Failed to sync ${orderId} to IX ${ixStatus}: ${response.status} ${errorText}`)
      return false
    }

    console.log(`[IX Mirror] ✅ Successfully synced order ${orderId} to IX ${ixStatus}`)
    return true

  } catch (error) {
    console.warn(`[IX Mirror] ❌ Exception syncing ${orderId} to IX ${ixStatus}:`, error)
    return false
  }
}

/**
 * Convenience function specifically for picked_up → reached sync
 * This is the main function that should be called after any "picked_up" status update
 */
export async function mirrorPickedUpToReached(orderId: string): Promise<boolean> {
  return mirrorIXStatus(orderId, 'reached', 'picked_up')
}

/**
 * Get current order status from IronXpress (for idempotent behavior)
 * Returns null if failed or not found
 */
async function getCurrentIXStatus(orderId: string): Promise<string | null> {
  try {
    const response = await fetch(`${IRON_BASE}/api/admin/orders?limit=1000`, {
      method: 'GET',
      headers: {
        'x-shared-secret': IRON_AUTH_SECRET,
      },
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const orders = data?.orders || []
    const order = orders.find((o: any) => o.id === orderId)
    
    return order?.order_status || null
  } catch {
    return null
  }
}

/**
 * Mirror any status change to IX (generic version)
 * @param orderId - Order ID
 * @param pgStatus - The new Pikago status
 * @param ixStatusMap - Map of PG status to IX status
 */
export async function mirrorStatusToIX(
  orderId: string, 
  pgStatus: string, 
  ixStatusMap: Record<string, string> = { 'picked_up': 'reached' }
): Promise<boolean> {
  const ixStatus = ixStatusMap[pgStatus]
  if (!ixStatus) {
    return true // No mapping needed, considered success
  }
  
  return mirrorIXStatus(orderId, ixStatus, pgStatus)
}

/**
 * Helper to automatically sync picked_up status after ANY assigned_orders update
 * Call this after successful database updates that might set status to 'picked_up'
 * 
 * @param orderId - Order ID to check
 * @param newStatus - The status that was just set (optional, for optimization)
 * @returns Promise<boolean> - true if sync was successful or not needed
 */
export async function autoSyncPickedUpStatus(orderId: string, newStatus?: string): Promise<boolean> {
  try {
    // If we know the new status, check it directly
    if (newStatus === 'picked_up') {
      return await mirrorPickedUpToReached(orderId)
    }
    
    // If newStatus is known and not picked_up, skip check
    if (newStatus && newStatus !== 'picked_up') {
      return true
    }
    
    // Otherwise, query the database to check current status
    const { data: assignedOrder } = await supabaseAdmin
      .from('assigned_orders')
      .select('status')
      .eq('id', orderId)
      .maybeSingle()
    
    if (assignedOrder?.status === 'picked_up') {
      return await mirrorPickedUpToReached(orderId)
    }
    
    return true // No sync needed
  } catch (error) {
    console.warn(`[IX Mirror] Exception in autoSyncPickedUpStatus for ${orderId}:`, error)
    return false
  }
}
