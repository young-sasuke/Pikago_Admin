import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';

function sr() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    // verify IronXpress→Pikago call
    const caller = req.headers.get('x-shared-secret');
    if (!caller || caller !== process.env.IMPORT_SHARED_SECRET) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { orderId, source } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

    // fetch the order from IronXpress (with THEIR secret)
    const ironBase = process.env.IRONXPRESS_BASE_URL!;
    const ironSecret = process.env.PIKAGO_SHARED_SECRET!;
    const res = await fetch(`${ironBase}/api/admin/orders/${orderId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-shared-secret': ironSecret },
    });
    if (!res.ok) {
      const t = await res.text();
      console.error('IronXpress fetch failed', res.status, t);
      return NextResponse.json({ error: 'iron_fetch_failed', details: t }, { status: 502 });
    }

    const o = await res.json();
    const supabase = sr();

    // upsert into the table the dashboard reads: public.orders
   // Build payload using ONLY columns that exist in Pikago public.orders
// and set Pikago.id = IronXpress.id (both TEXT)
const payload = {
  id: String(o.id),

  // required not-null columns in Pikago schema
  user_id: o.user_id,                                 // uuid
  total_amount: o.total_amount ?? 0,                  // numeric
  payment_method: o.payment_method ?? 'online',       // text
  payment_status: o.payment_status ?? 'pending',      // text
  order_status: 'accepted',                           // force accepted on import
  pickup_date: o.pickup_date,                         // date
  delivery_date: o.delivery_date,                     // date
  delivery_type: o.delivery_type,                     // text
  delivery_address: o.delivery_address,               // text

  // optional / nullable fields (map if present)
  payment_id: o.payment_id ?? null,
  pickup_slot_id: o.pickup_slot_id ?? null,
  delivery_slot_id: o.delivery_slot_id ?? null,
  address_details: o.address_details ?? null,
  applied_coupon_code: o.applied_coupon_code ?? null,
  discount_amount: o.discount_amount ?? 0,
  status: o.status ?? null,
  cancelled_at: o.cancelled_at ?? null,
  cancellation_reason: o.cancellation_reason ?? null,
  can_be_cancelled: o.can_be_cancelled ?? true,
  original_pickup_slot_id: o.original_pickup_slot_id ?? null,
  original_delivery_slot_id: o.original_delivery_slot_id ?? null,
  pickup_slot_display_time: o.pickup_slot_display_time ?? null,
  pickup_slot_start_time: o.pickup_slot_start_time ?? null,
  pickup_slot_end_time: o.pickup_slot_end_time ?? null,
  delivery_slot_display_time: o.delivery_slot_display_time ?? null,
  delivery_slot_start_time: o.delivery_slot_start_time ?? null,
  delivery_slot_end_time: o.delivery_slot_end_time ?? null,

  // provenance (these exist in Pikago schema)
  source_order_id: null,          // leave null (uuid type in your schema)
  source_system: 'ironxpress',

  // timestamps (optional: keep IronXpress times if present)
  created_at: o.created_at ?? new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Upsert by PRIMARY KEY 'id' (TEXT)
const { data, error } = await supabase
  .from('orders')
  .upsert(payload, { onConflict: 'id' })
  .select()
  .single();


    if (error) {
      console.error('Upsert failed', error);
      return NextResponse.json({ error: 'db_upsert_failed', details: error.message }, { status: 500 });
    }

    // optional notification
    await supabase.from('notifications').insert({
      recipient_type: 'admin',
      notification_type: 'order_imported',
      title: 'New Accepted Order',
      message: `Order ${o.id} imported from ${source || 'IronXpress'}`,
      priority: 'high',
      is_read: false,
      is_sent: true,
      related_order_id: o.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, pikagoOrderId: data.id, sourceOrderId: orderId });
  } catch (e: any) {
    console.error('import-order error', e?.message || e);
    return NextResponse.json({ error: 'internal_server_error', details: e?.message || 'unknown' }, { status: 500 });
  }
}
