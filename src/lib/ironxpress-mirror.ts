// Centralized utility for mirroring Pikago status updates to IronXpress
/* SAFE: minimal, idempotent; no build-time throws */

import { supabaseAdmin } from './supabase-admin';

// Environment configuration
const IRON_BASE_RAW = process.env.IRONXPRESS_BASE_URL || '';
const IRON_BASE = IRON_BASE_RAW.replace(/\/$/, ''); // normalize: strip trailing slash
const IRON_AUTH_SECRET =
  process.env.INTERNAL_API_SECRET ||
  process.env.INTERNAL_API_SHARED_SECRET ||
  '';

if (!IRON_BASE) {
  console.warn('[IronXpress Mirror] IRONXPRESS_BASE_URL not configured - IX sync disabled');
}
if (!IRON_AUTH_SECRET) {
  console.warn('[IronXpress Mirror] INTERNAL_API_SECRET not configured - IX sync disabled');
}

/** READ via GET /api/admin/orders/[id] */
async function getCurrentIXStatus(orderId: string): Promise<string | null> {
  if (!IRON_BASE) return null;
  try {
    const id = String(orderId).replace(/^#/, '').trim();
    const res = await fetch(`${IRON_BASE}/api/admin/orders/${id}`, {
      method: 'GET',
      headers: IRON_AUTH_SECRET ? { 'x-shared-secret': IRON_AUTH_SECRET } : undefined,
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const data = await res.json().catch(() => null as any);
    const order = data?.order || data?.data || data;

    const status =
      order?.order_status ??
      order?.status ??
      order?.data?.order_status ??
      null;

    return typeof status === 'string' ? status : null;
  } catch {
    return null;
  }
}

/** WRITE primary: POST /api/orders/update-status; fallbacks: PATCH [id] → PATCH collection */
async function patchIXStatus(orderId: string, ixStatus: string) {
  const normalized = String(orderId).replace(/^#/, '').trim();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (IRON_AUTH_SECRET) headers['x-shared-secret'] = IRON_AUTH_SECRET;

  // Primary: your current route
  let res = await fetch(`${IRON_BASE}/api/orders/update-status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ orderId: normalized, status: ixStatus }),
  });

  // Fallback 1: PATCH /api/admin/orders/[id]
  if (!res.ok && (res.status === 404 || res.status === 405)) {
    res = await fetch(`${IRON_BASE}/api/admin/orders/${normalized}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: ixStatus }),
    });
  }

  // Fallback 2: PATCH /api/admin/orders (collection)
  if (!res.ok && (res.status === 404 || res.status === 405)) {
    res = await fetch(`${IRON_BASE}/api/admin/orders`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ orderId: normalized, status: ixStatus }),
    });
  }

  return res;
}

/**
 * Mirror a Pikago order status to IronXpress
 */
export async function mirrorIXStatus(
  orderId: string,
  ixStatus: string,
  sourceContext = 'status_update'
): Promise<boolean> {
  if (!IRON_BASE || !IRON_AUTH_SECRET) {
    console.log(
      `[IX Mirror] Skipping ${sourceContext} → ${ixStatus} for ${orderId} (not configured)`
    );
    return false;
  }

  try {
    const normalized = String(orderId).replace(/^#/, '').trim();
    console.log(`[IX Mirror] 🔄 PG ${sourceContext} → IX ${ixStatus} for order ${normalized}`);

    // Idempotency check
    const current = await getCurrentIXStatus(normalized);
    if (current && current === ixStatus) {
      console.log(`[IX Mirror] ℹ️ Order ${normalized} already has IX status ${ixStatus}, skipping`);
      return true;
    }

    const response = await patchIXStatus(normalized, ixStatus);

    if (!response.ok) {
      const txt = await response.text().catch(() => 'Unknown error');
      console.warn(`[IX Mirror] ❌ Failed to sync ${normalized} → ${ixStatus}: ${response.status} ${txt}`);
      return false;
    }

    console.log(`[IX Mirror] ✅ Successfully synced order ${normalized} → ${ixStatus}`);
    return true;
  } catch (error) {
    console.warn(`[IX Mirror] ❌ Exception syncing ${orderId} → ${ixStatus}:`, error);
    return false;
  }
}

/** Convenience for picked_up → reached */
export async function mirrorPickedUpToReached(orderId: string): Promise<boolean> {
  return mirrorIXStatus(orderId, 'reached', 'picked_up');
}

/** Generic map-based mirroring */
export async function mirrorStatusToIX(
  orderId: string,
  pgStatus: string,
  ixStatusMap: Record<string, string> = {
    picked_up: 'reached',
    shipped: 'shipped',
  }
): Promise<boolean> {
  const ixStatus = ixStatusMap[pgStatus];
  if (!ixStatus) return true;
  return mirrorIXStatus(orderId, ixStatus, pgStatus);
}

/** Auto-sync picked_up status after assigned_orders changes */
export async function autoSyncPickedUpStatus(
  orderId: string,
  newStatus?: string
): Promise<boolean> {
  try {
    if (newStatus === 'picked_up') {
      return await mirrorPickedUpToReached(orderId);
    }
    if (newStatus && newStatus !== 'picked_up') return true;

    const { data: assignedOrder } = await supabaseAdmin
      .from('assigned_orders')
      .select('status')
      .eq('id', orderId)
      .maybeSingle();

    if (assignedOrder?.status === 'picked_up') {
      return await mirrorPickedUpToReached(orderId);
    }
    return true;
  } catch (error) {
    console.warn(
      `[IX Mirror] Exception in autoSyncPickedUpStatus for ${orderId}:`,
      error
    );
    return false;
  }
}
