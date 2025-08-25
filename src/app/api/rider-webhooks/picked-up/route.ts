// app/api/rider-webhooks/picked-up/route.ts (Pikago)
import { NextRequest, NextResponse } from 'next/server'

/**
 * Rider webhook: "Picked up" 
 * → mark the platform order as picked_up and the assignment as picked_up
 * → set the source system state to "order_received" and immediately to "work_in_progress"
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

    // Forward to the main rider-status webhook with "picked_up" status
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/rider-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shared-secret': process.env.ASSIGN_UPDATE_SECRET || process.env.IMPORT_SHARED_SECRET || '',
      },
      body: JSON.stringify({
        orderId,
        status: 'picked_up',
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
      message: 'Order marked as picked up successfully',
      ...result
    })

  } catch (e: any) {
    console.error('[Picked Up Webhook] Error:', e)
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'unknown_error' },
      { status: 500 }
    )
  }
}
