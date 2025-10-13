import { NextRequest, NextResponse } from 'next/server';
import { mirrorIXStatus } from '@/lib/ironxpress-mirror';

export const runtime = 'nodejs';

/**
 * Rider webhook: "Shipped" (delivery leg starts)
 * Proxies to /api/rider-status with status=shipped so that:
 *  - PG orders.order_status -> out_for_delivery
 *  - assigned_orders.status -> out_for_delivery
 *  - IronXpress receives 'shipped' to trigger customer notification
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId: rawOrderId, riderId, riderName } = body;

    if (!rawOrderId) {
      return NextResponse.json(
        { ok: false, error: 'orderId is required' },
        { status: 400 }
      );
    }

    // ✅ normalize orderId before any downstream call
    const orderId = String(rawOrderId).replace(/^#/, '').trim();
    console.log('[Shipped Webhook] normalized orderId:', orderId);

    // Use request origin (no hardcoded domain)
    const origin = new URL(req.url).origin;

    // --- 1) Sync order status to IronXpress (idempotent) ---
    const mirrored = await mirrorIXStatus(orderId, 'shipped', 'shipped_webhook');
    if (!mirrored) {
      return NextResponse.json(
        { ok: false, error: 'Failed to sync with IronXpress' },
        { status: 500 }
      );
    }

    // --- 2) Proxy to Pikago's rider-status to update local tables ---
    const secret =
      process.env.ASSIGN_UPDATE_SECRET ||
      process.env.IMPORT_SHARED_SECRET ||
      process.env.INTERNAL_API_SECRET ||
      '';

    const response = await fetch(`${origin}/api/rider-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shared-secret': secret,
      },
      body: JSON.stringify({
        orderId,            // use normalized ID
        status: 'shipped',
        riderId,
        riderName,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(result, { status: response.status });
    }

    console.log('[Shipped Webhook] ✅ mirrored to IX & updated PG for', orderId);
    return NextResponse.json({
      ok: true,
      message: 'Order marked as out for delivery (shipped)',
      ...result,
    });
  } catch (e: any) {
    console.error('[Shipped Webhook] Error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'unknown_error' },
      { status: 500 }
    );
  }
}
