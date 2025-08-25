// lib/ix-sync-helper.ts (Pikago) - IronXpress Sync Helper for picked_up events
import { NextRequest } from 'next/server'

/**
 * Surgical helper to sync picked_up status to IronXpress as 'reached'
 * This is called non-blocking after PG DB update succeeds
 */
export async function syncPickedUpToIronXpress(orderId: string): Promise<boolean> {
  try {
    const IRONXPRESS_BASE_URL = process.env.IRONXPRESS_BASE_URL
    const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET
    
    if (!IRONXPRESS_BASE_URL || !INTERNAL_API_SECRET) {
      console.warn('[IX Sync] Missing environment variables - skipping IX sync for picked_up')
      return false
    }
    
    console.log(`[IX Sync] 🔄 Syncing picked_up to reached for order ${orderId}`)
    
    const response = await fetch(`${IRONXPRESS_BASE_URL}/api/admin/orders`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${INTERNAL_API_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: orderId,
        status: 'reached'
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.warn(`[IX Sync] ❌ Failed to sync picked_up to IX: ${response.status} ${errorText}`)
      return false
    }
    
    console.log(`[IX Sync] ✅ Successfully synced order ${orderId} picked_up -> reached to IX`)
    return true
    
  } catch (error) {
    console.warn('[IX Sync] ❌ Exception syncing picked_up to IX:', error)
    return false
  }
}
