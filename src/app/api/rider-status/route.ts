// app/api/rider-status/route.ts (Pikago) - Comprehensive Two-Leg Rider Webhooks
/* SAFE: removed top-level env throws; added internal checks; minor cleanups */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { upsertAssignedOrderWithSync } from '@/lib/db-sync';

export const runtime = 'nodejs';

// Status mapping for the comprehensive two-leg system
const STATUS_MAPPING = {
  // Pickup leg (rider 1)
  picked_up: {
    platformStatus: 'picked_up',
    assignmentStatus: 'picked_up',
    sourceStatus: 'reached', // IX sees "reached", enables Received button
    customerNotification: null,
  },
  // In transit status (UI compatibility)
  in_transit: {
    platformStatus: 'in_transit',
    assignmentStatus: 'in_transit',
    sourceStatus: 'working_in_progress',
    customerNotification: null,
  },
  // End of pickup leg (delivery to store) - alias for 'reached'
  delivered_to_store: {
    platformStatus: 'delivered_to_store',
    assignmentStatus: 'reached',
    sourceStatus: 'delivered_to_store',
    customerNotification: null,
  },
  // Reached at store (end of pickup leg)
  reached: {
    platformStatus: 'delivered_to_store',
    assignmentStatus: 'reached',
    sourceStatus: 'reached',
    customerNotification: null,
  },
  // Delivery leg started (rider leaves store)
  shipped: {
    platformStatus: 'shipped',
    assignmentStatus: 'out_for_delivery',
    sourceStatus: 'shipped',
    customerNotification: 'Out for delivery',
  },
  // Alias for shipped
  out_for_delivery: {
    platformStatus: 'shipped',
    assignmentStatus: 'out_for_delivery',
    sourceStatus: 'shipped',
    customerNotification: 'Out for delivery',
  },
  // Delivery completed
  delivered: {
    platformStatus: 'delivered',
    assignmentStatus: 'delivered',
    sourceStatus: 'delivered',
    customerNotification: 'Order completed',
  },
  delivered_to_customer: {
    platformStatus: 'delivered',
    assignmentStatus: 'delivered',
    sourceStatus: 'delivered',
    customerNotification: 'Order completed',
  },
} as const;

export async function POST(req: NextRequest) {
  console.log('[Rider Webhooks] 📥 Received rider status update');

  try {
    // --- Auth (supports multiple secret headers) ---
    const ASSIGN_UPDATE_SECRET =
      process.env.ASSIGN_UPDATE_SECRET ?? process.env.INTERNAL_API_SECRET;
    const IMPORT_SHARED_SECRET = process.env.IMPORT_SHARED_SECRET;

    const expectedSecret = ASSIGN_UPDATE_SECRET || IMPORT_SHARED_SECRET;
    if (!expectedSecret) {
      console.error('[Rider Webhooks] ❌ No authentication secret configured');
      return NextResponse.json(
        { ok: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get('authorization');
    const sharedSecretHeader =
      req.headers.get('x-shared-secret') || req.headers.get('x-rider-secret');

    const isValidAuth =
      (authHeader === `Bearer ${expectedSecret}`) ||
      (sharedSecretHeader === expectedSecret);

    if (!isValidAuth) {
      console.error('[Rider Webhooks] ❌ Unauthorized request');
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // --- Parse body ---
    const body = await req.json().catch(() => ({}));
    const { orderId: rawOrderId, status, riderId, riderName } = body;
    const orderId = String(rawOrderId ?? '').replace(/^#/, '').trim();

    console.log('[Rider Webhooks] Request payload:', JSON.stringify(body, null, 2));

    if (!orderId || !status) {
      return NextResponse.json(
        { ok: false, error: 'orderId and status are required' },
        { status: 400 }
      );
    }

    const mapping = (STATUS_MAPPING as any)[status];
    if (!mapping) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid status: ${status}. Valid: ${Object.keys(STATUS_MAPPING).join(', ')}`,
        },
        { status: 400 }
      );
    }

    console.log(`[Rider Webhooks] 🔄 Processing ${status} for order ${orderId}`);

    const nowIso = new Date().toISOString();

    // --- 1) Read current order (for assigned mirror payload) ---
    const { data: currentOrder, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { ok: false, error: `Failed to fetch order: ${fetchError.message}` },
        { status: 500 }
      );
    }
    if (!currentOrder) {
      return NextResponse.json(
        { ok: false, error: `Order ${orderId} not found` },
        { status: 404 }
      );
    }

    // --- 2) Update platform orders table ---
    const { error: orderUpdateError } = await supabaseAdmin
      .from('orders')
      .update({
        order_status: mapping.platformStatus,
        updated_at: nowIso,
      })
      .eq('id', orderId);

    if (orderUpdateError) {
      return NextResponse.json(
        { ok: false, error: `Order update failed: ${orderUpdateError.message}` },
        { status: 500 }
      );
    }

    // --- 3) Mirror to assigned_orders (with auto-sync for picked_up) ---
    const assignedOrderPayload = {
      ...currentOrder,
      status: mapping.assignmentStatus,
      user_id: riderId || currentOrder.user_id,
      rider_name:
        riderName || (await getRiderName(riderId || currentOrder.user_id)),
      updated_at: nowIso,
    };

    const { error: assignedUpdateError } = await upsertAssignedOrderWithSync(
      assignedOrderPayload,
      { onConflict: 'id' }
    );

    if (assignedUpdateError) {
      console.warn('[Rider Webhooks] ⚠️ assigned_orders upsert failed:', assignedUpdateError);
      // continue
    }

    // --- 4) Source system (IronXpress) status updates ---
    // For picked_up we explicitly sync to 'reached' in db-sync helper.
    // For everything else (including shipped), call IX API here.
    if (mapping.sourceStatus && status !== 'picked_up') {
      const ok = await updateSourceSystemStatus(orderId, mapping.sourceStatus, status);
      if (!ok) console.warn('[Rider Webhooks] ⚠️ IX source status update failed');
    }

    console.log(`[Rider Webhooks] ✅ Success ${status} for ${orderId}`);

    return NextResponse.json({
      ok: true,
      message: `Order ${orderId} status updated to ${status}`,
      platformStatus: mapping.platformStatus,
      sourceStatus: mapping.sourceStatus,
      assignmentStatus: mapping.assignmentStatus,
    });
  } catch (e: any) {
    console.error('[Rider Webhooks] ❌ Unexpected error:', e);
    return NextResponse.json(
        { ok: false, error: e?.message ?? 'unknown_error' },
        { status: 500 }
    );
  }
}

/* ------------ Helpers ------------ */

async function updateSourceSystemStatus(
  orderId: string,
  status: string,
  _originalStatus: string
) {
  try {
    const ironBase = (process.env.IRONXPRESS_BASE_URL || '').replace(/\/$/, '');
    const internalSecret = process.env.INTERNAL_API_SECRET;

    if (!ironBase || !internalSecret) {
      console.warn('[Rider Webhooks] IX config missing; skip source update');
      return false;
    }

    const id = String(orderId).replace(/^#/, '').trim();

    // ✅ Primary: POST /api/orders/update-status
    let res = await fetch(`${ironBase}/api/orders/update-status`, {
      method: 'POST',
      headers: {
        'x-shared-secret': internalSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId: id, status }),
    });

    // Fallback 1: PATCH /api/admin/orders/[id]
    if (!res.ok && (res.status === 404 || res.status === 405)) {
      res = await fetch(`${ironBase}/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: {
          'x-shared-secret': internalSecret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
    }

    // Fallback 2: PATCH /api/admin/orders (collection)
    if (!res.ok && (res.status === 404 || res.status === 405)) {
      res = await fetch(`${ironBase}/api/admin/orders`, {
        method: 'PATCH',
        headers: {
          'x-shared-secret': internalSecret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId: id, status }),
      });
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => 'Unknown error');
      console.error(`[Rider Webhooks] ❌ IX API update failed: ${res.status} ${txt}`);
      return false;
    }

    await res.json().catch(() => ({}));
    console.log(`[Rider Webhooks] ✅ IX order ${id} -> ${status}`);
    return true;
  } catch (e) {
    console.error('[Rider Webhooks] ❌ Exception updating IX via API:', e);
    return false;
  }
}

async function getRiderName(userId?: string): Promise<string> {
  if (!userId) return 'Rider';
  try {
    const { data: dp } = await supabaseAdmin
      .from('delivery_partners')
      .select('first_name, last_name')
      .eq('user_id', userId)
      .maybeSingle();

    const full = [dp?.first_name, dp?.last_name].filter(Boolean).join(' ').trim();
    if (full) return full;

    const { data: u } = await supabaseAdmin
      .from('users')
      .select('email, phone')
      .eq('id', userId)
      .maybeSingle();

    return u?.email ?? u?.phone ?? `Rider-${String(userId).slice(0, 8)}`;
  } catch (e) {
    console.warn('[Rider Webhooks] Could not fetch rider name:', e);
    return 'Rider';
  }
}
