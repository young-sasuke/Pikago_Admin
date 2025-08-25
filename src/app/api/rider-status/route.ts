// app/api/rider-status/route.ts (Pikago) - Comprehensive Two-Leg Rider Webhooks
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Environment configuration - fail fast if missing required vars
const IRON_BASE = process.env.IRONXPRESS_BASE_URL
const ASSIGN_UPDATE_SECRET = process.env.ASSIGN_UPDATE_SECRET ?? process.env.INTERNAL_API_SECRET
const IMPORT_SHARED_SECRET = process.env.IMPORT_SHARED_SECRET
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET

// Validate required environment variables
if (!IRON_BASE) {
  throw new Error('IRONXPRESS_BASE_URL environment variable is required')
}
if (!INTERNAL_API_SECRET) {
  throw new Error('INTERNAL_API_SECRET environment variable is required')
}

// Status mapping for the comprehensive two-leg system
const STATUS_MAPPING = {
  // Pickup leg (rider 1)
  'picked_up': {
    platformStatus: 'picked_up',
    assignmentStatus: 'picked_up', 
    sourceStatus: null, // IX admin must explicitly mark as 'received'
    customerNotification: null // no auto notification
  },
  // In transit status (UI compatibility)
  'in_transit': {
    platformStatus: 'in_transit',
    assignmentStatus: 'in_transit',
    sourceStatus: 'working_in_progress',
    customerNotification: null // no customer notification change
  },
  // End of pickup leg (delivery to store) - alias for 'reached'
  'delivered_to_store': {
    platformStatus: 'delivered_to_store',
    assignmentStatus: 'reached',
    sourceStatus: 'delivered_to_store', // IX UI gates on this status for Received button
    customerNotification: null // no customer notification yet
  },
  // Reached at store (end of pickup leg)
  'reached': {
    platformStatus: 'delivered_to_store',
    assignmentStatus: 'reached',
    sourceStatus: 'reached', // IX UI gates on this status for Received button
    customerNotification: null
  },
  // Delivery completed (UI compatibility)
  'delivered': {
    platformStatus: 'delivered',
    assignmentStatus: 'delivered',
    sourceStatus: 'delivered',
    customerNotification: 'Order completed'
  },
  // Delivery leg (rider 2) - webhook compatibility
  'delivered_to_customer': {
    platformStatus: 'delivered',
    assignmentStatus: 'delivered',
    sourceStatus: 'delivered',
    customerNotification: 'Order completed'
  }
}

export async function POST(req: NextRequest) {
  console.log('[Rider Webhooks] 📥 Received rider status update')
  
  try {
    // Enhanced authentication - support multiple secret types
    const authHeader = req.headers.get('authorization')
    const sharedSecretHeader = req.headers.get('x-shared-secret') || req.headers.get('x-rider-secret')
    const expectedSecret = ASSIGN_UPDATE_SECRET || IMPORT_SHARED_SECRET
    
    console.log('[Rider Webhooks] Auth header:', authHeader ? 'Present' : 'Missing')
    console.log('[Rider Webhooks] Shared secret header:', sharedSecretHeader ? 'Present' : 'Missing')
    console.log('[Rider Webhooks] Expected secret configured:', expectedSecret ? 'Yes' : 'No')
    
    if (!expectedSecret) {
      console.error('[Rider Webhooks] ❌ No authentication secret configured')
      return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 })
    }
    
    const isValidAuth = 
      (authHeader === `Bearer ${expectedSecret}`) ||
      (sharedSecretHeader === expectedSecret)
    
    if (!isValidAuth) {
      console.error('[Rider Webhooks] ❌ Unauthorized request')
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { orderId: rawOrderId, status, riderId, riderName } = body
    const orderId = String(rawOrderId ?? '').replace(/^#/, '').trim()

    console.log('[Rider Webhooks] Request payload:', JSON.stringify(body, null, 2))

    if (!orderId || !status) {
      console.error('[Rider Webhooks] ❌ Missing required fields')
      return NextResponse.json(
        { ok: false, error: 'orderId and status are required' },
        { status: 400 }
      )
    }

    const mapping = STATUS_MAPPING[status as keyof typeof STATUS_MAPPING]
    if (!mapping) {
      console.error(`[Rider Webhooks] ❌ Invalid status: ${status}`)
      return NextResponse.json(
        { ok: false, error: `Invalid status: ${status}. Valid statuses: ${Object.keys(STATUS_MAPPING).join(', ')}` },
        { status: 400 }
      )
    }

    console.log(`[Rider Webhooks] 🔄 Processing ${status} for order ${orderId}`)
    
    const nowIso = new Date().toISOString()

    // 1. Read back the current order state for mirroring
    const { data: currentOrder, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (fetchError) {
      console.error('[Rider Webhooks] ❌ Failed to fetch current order:', fetchError)
      return NextResponse.json(
        { ok: false, error: `Failed to fetch order: ${fetchError.message}` },
        { status: 500 }
      )
    }

    if (!currentOrder) {
      console.error(`[Rider Webhooks] ❌ Order ${orderId} not found`)
      return NextResponse.json(
        { ok: false, error: `Order ${orderId} not found` },
        { status: 404 }
      )
    }

    // 2. Update platform order status
    const { error: orderUpdateError } = await supabaseAdmin
      .from('orders')
      .update({ 
        order_status: mapping.platformStatus,
        updated_at: nowIso 
      })
      .eq('id', orderId)

    if (orderUpdateError) {
      console.error('[Rider Webhooks] ❌ Failed to update orders table:', orderUpdateError)
      return NextResponse.json(
        { ok: false, error: `Order update failed: ${orderUpdateError.message}` },
        { status: 500 }
      )
    }

    console.log(`[Rider Webhooks] ✅ Updated platform order to ${mapping.platformStatus}`)

    // 3. Mirror complete order context into assigned_orders with assignment status
    const assignedOrderPayload = {
      ...currentOrder,
      status: mapping.assignmentStatus, // assignment-specific status
      user_id: riderId || currentOrder.user_id, // ensure rider ID is set
      rider_name: riderName || await getRiderName(riderId || currentOrder.user_id),
      updated_at: nowIso,
    }

    const { error: assignedUpdateError } = await supabaseAdmin
      .from('assigned_orders')
      .upsert(assignedOrderPayload, { onConflict: 'id' })

    if (assignedUpdateError) {
      console.warn('[Rider Webhooks] ⚠️ Failed to update assigned_orders:', assignedUpdateError)
      // Don't fail the whole operation if this fails
    } else {
      console.log(`[Rider Webhooks] ✅ Updated assignment store with status ${mapping.assignmentStatus}`)
    }

    // 4. Update source system (IronXpress) status only if mapping specifies one
    if (mapping.sourceStatus) {
      const sourceStatusUpdated = await updateSourceSystemStatus(orderId, mapping.sourceStatus, status)
      
      if (!sourceStatusUpdated) {
        console.warn('[Rider Webhooks] ⚠️ Failed to update source system status')
        // Continue anyway - platform updates succeeded
      }
    } else {
      console.log('[Rider Webhooks] ℹ️ No source status update required for', status)
    }

    // 5. No special auto-transitions - IX admin must handle explicitly

    console.log(`[Rider Webhooks] ✅ Successfully processed ${status} for order ${orderId}`)
    
    return NextResponse.json({ 
      ok: true, 
      message: `Order ${orderId} status updated to ${status}`,
      platformStatus: mapping.platformStatus,
      sourceStatus: mapping.sourceStatus,
      assignmentStatus: mapping.assignmentStatus
    })
    
  } catch (e: any) {
    console.error('[Rider Webhooks] ❌ Unexpected error:', e)
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'unknown_error' },
      { status: 500 }
    )
  }
}

/* ------------ Helper Functions ------------ */

async function updateSourceSystemStatus(orderId: string, status: string, originalStatus: string) {
  try {
    console.log(`[Rider Webhooks] 🔄 Updating IronXpress via API: ${orderId} -> ${status}`)
    
    // Use IX API instead of direct DB to trigger notifications
    const response = await fetch(`${IRON_BASE}/api/admin/orders`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${INTERNAL_API_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: orderId,
        status: status
      })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`[Rider Webhooks] ❌ IronXpress API update failed: ${response.status} ${errorText}`)
      return false
    }

    const result = await response.json().catch(() => ({}))
    console.log(`[Rider Webhooks] ✅ IronXpress order ${orderId} updated to ${status} via API`)
    console.log('[Rider Webhooks] 🔔 IronXpress notifications should be triggered')
    return true
    
  } catch (e) {
    console.error('[Rider Webhooks] ❌ Exception updating IronXpress via API:', e)
    return false
  }
}

async function getRiderName(userId: string): Promise<string> {
  if (!userId) return 'Rider'
  
  try {
    // Try delivery_partners table first
    const { data: dp } = await supabaseAdmin
      .from('delivery_partners')
      .select('first_name, last_name')
      .eq('user_id', userId)
      .maybeSingle()
    
    const fullName = [dp?.first_name, dp?.last_name].filter(Boolean).join(' ').trim()
    if (fullName) return fullName

    // Fallback to users table
    const { data: u } = await supabaseAdmin
      .from('users')
      .select('email, phone')
      .eq('id', userId)
      .maybeSingle()

    return u?.email ?? u?.phone ?? `Rider-${userId.slice(0, 8)}`
    
  } catch (e) {
    console.warn('[Rider Webhooks] Could not fetch rider name:', e)
    return 'Rider'
  }
}
