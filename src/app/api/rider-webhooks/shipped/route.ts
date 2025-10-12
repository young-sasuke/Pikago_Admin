import { NextRequest, NextResponse } from 'next/server'
import { mirrorIXStatus } from '@/lib/ironxpress-mirror'

export const runtime = 'nodejs'

/**
 * Rider webhook: "Shipped" (delivery leg starts)
 * Proxies to /api/rider-status with status=shipped so that:
 *  - PG orders.order_status -> out_for_delivery
 *  - assigned_orders.status -> out_for_delivery
 *  - Ironxpress receives 'shipped' to trigger customer notification
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { orderId, riderId, riderName } = body

    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: 'orderId is required' },
        { status: 400 }
      )
    }

    // Use request origin (no hardcoded domain)
    const origin = new URL(req.url).origin

    // Sync order status to IronXpress
    const ixStatus = 'shipped' // Status to send to IronXpress
    const success = await mirrorIXStatus(orderId, ixStatus)

    if (!success) {
      return NextResponse.json(
        { ok: false, error: 'Failed to sync with IronXpress' },
        { status: 500 }
      )
    }

    // Proxy request to the rider status API
    const response = await fetch(`${origin}/api/rider-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shared-secret': process.env.ASSIGN_UPDATE_SECRET || process.env.IMPORT_SHARED_SECRET || '',
      },
      body: JSON.stringify({
        orderId,
        status: 'shipped',
        riderId,
        riderName,
      }),
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json(result, { status: response.status })
    }

    return NextResponse.json({
      ok: true,
      message: 'Order marked as out for delivery (shipped)',
      ...result,
    })
  } catch (e: any) {
    console.error('[Shipped Webhook] Error:', e)
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'unknown_error' },
      { status: 500 }
    )
  }
}
