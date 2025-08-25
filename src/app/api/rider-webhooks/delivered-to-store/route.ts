// app/api/rider-webhooks/delivered-to-store/route.ts (Pikago)
import { NextRequest, NextResponse } from 'next/server'

/**
 * Rider webhook: "Delivered to store" (end of pickup leg)
 * → mark platform order and assignment as delivered_to_store
 * → source system can remain "work_in_progress"
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

    // Forward to the main rider-status webhook with "delivered_to_store" status
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/rider-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shared-secret': process.env.ASSIGN_UPDATE_SECRET || process.env.IMPORT_SHARED_SECRET || '',
      },
      body: JSON.stringify({
        orderId,
        status: 'delivered_to_store',
        riderId,
        riderName,
      }),
    })

    const result = await response.json()
    
    if (!response.ok) {
      return NextResponse.json(result, { status: response.status })
    }

    return NextResponse.json({
      ok: true,
      message: 'Order marked as delivered to store successfully',
      ...result
    })

  } catch (e: any) {
    console.error('[Delivered to Store Webhook] Error:', e)
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'unknown_error' },
      { status: 500 }
    )
  }
}
