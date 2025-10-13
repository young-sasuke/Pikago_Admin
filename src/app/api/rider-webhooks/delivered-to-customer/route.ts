// app/api/rider-webhooks/delivered-to-customer/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { mirrorIXStatus } from '@/lib/ironxpress-mirror'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { orderId: rawOrderId, riderId, riderName } = body

    if (!rawOrderId) {
      return NextResponse.json({ ok: false, error: 'orderId is required' }, { status: 400 })
    }

    const orderId = String(rawOrderId).replace(/^#/, '').trim()
    const origin = new URL(req.url).origin

    // 1) Mirror to IX, but DO NOT hard-fail
    let mirrorOk = false
    try {
      mirrorOk = await mirrorIXStatus(orderId, 'delivered', 'delivered_webhook')
      if (!mirrorOk) {
        console.warn(`[Delivered Webhook] IX mirror failed for ${orderId} (non-blocking)`)
      }
    } catch (e) {
      console.warn(`[Delivered Webhook] IX mirror exception for ${orderId}:`, e)
    }

    // 2) Proxy to PG rider-status to update platform tables
    const secret =
      process.env.ASSIGN_UPDATE_SECRET ||
      process.env.IMPORT_SHARED_SECRET ||
      process.env.INTERNAL_API_SECRET ||
      ''

    const res = await fetch(`${origin}/api/rider-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-shared-secret': secret },
      body: JSON.stringify({
        orderId,
        status: 'delivered_to_customer',
        riderId,
        riderName,
      }),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ ...json, mirrorOk }, { status: res.status })

    return NextResponse.json({
      ok: true,
      message: 'Order marked delivered to customer',
      mirrorOk,
      ...json,
    })
  } catch (e: any) {
    console.error('[Delivered to Customer Webhook] Error:', e)
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown_error' }, { status: 500 })
  }
}
