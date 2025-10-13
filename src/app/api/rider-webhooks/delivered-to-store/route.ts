// app/api/rider-webhooks/delivered-to-store/route.ts
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Rider webhook: "Delivered to store" (end of pickup leg)
 * -> PG updates only; IX status stays WIP here (no notification needed)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { orderId: rawOrderId, riderId, riderName } = body

    if (!rawOrderId) {
      return NextResponse.json(
        { ok: false, error: 'orderId is required' },
        { status: 400 }
      )
    }

    const orderId = String(rawOrderId).replace(/^#/, '').trim()
    const origin = new URL(req.url).origin

    const secret =
      process.env.ASSIGN_UPDATE_SECRET ||
      process.env.IMPORT_SHARED_SECRET ||
      process.env.INTERNAL_API_SECRET ||
      ''

    const res = await fetch(`${origin}/api/rider-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shared-secret': secret,
      },
      body: JSON.stringify({
        orderId,
        status: 'delivered_to_store',
        riderId,
        riderName,
      }),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json(json, { status: res.status })

    return NextResponse.json({
      ok: true,
      message: 'Order marked delivered to store',
      ...json,
    })
  } catch (e: any) {
    console.error('[Delivered to Store Webhook] Error:', e)
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'unknown_error' },
      { status: 500 }
    )
  }
}
