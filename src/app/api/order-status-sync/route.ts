import { NextResponse } from 'next/server';
import { mirrorIXStatus } from '@/lib/ironxpress-mirror';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { orderId, status } = await req.json();

    if (!orderId || !status) {
      return NextResponse.json(
        { error: 'orderId and status are required' },
        { status: 400 }
      );
    }

    // Map Pikago status to IronXpress status
    const ixStatus = status === 'shipped' ? 'shipped' : status;

    // Sync with IronXpress (idempotent)
    const success = await mirrorIXStatus(orderId, ixStatus, 'generic_sync');

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to sync with IronXpress' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'unknown_error' },
      { status: 500 }
    );
  }
}
