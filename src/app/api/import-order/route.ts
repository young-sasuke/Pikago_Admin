import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Create service role client for admin operations
function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(req: NextRequest) {
  try {
    // Validate shared secret
    const sharedSecret = req.headers.get('x-shared-secret');
    if (sharedSecret !== process.env.IMPORT_SHARED_SECRET) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { orderId, source } = body;
    
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }
    
    console.log(`📦 Importing order ${orderId} from ${source || 'IronXpress'}...`);
    
    // Fetch order details from IronXpress
    const ironxpressUrl = `${process.env.IRONXPRESS_BASE_URL}/api/admin/orders/${orderId}`;
    console.log(`🔍 Fetching order from: ${ironxpressUrl}`);
    
    const orderResponse = await fetch(ironxpressUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add any authentication headers needed for IronXpress API
      }
    });
    
    if (!orderResponse.ok) {
      console.error(`❌ Failed to fetch order from IronXpress: ${orderResponse.status} ${orderResponse.statusText}`);
      return NextResponse.json({ 
        error: 'fetch_failed',
        details: `IronXpress API returned ${orderResponse.status}`
      }, { status: 502 });
    }
    
    const order = await orderResponse.json();
    console.log(`✅ Fetched order data:`, { 
      id: order.id, 
      total_amount: order.total_amount,
      order_status: order.order_status 
    });
    
    // Create service role client
    const supabase = createServiceRoleClient();
    
    // Map order data to pikago_orders format
    const pikagoOrderPayload = {
      source_order_id: order.id,
      full_name: order.full_name || order.customer_name || null,
      email: order.email || order.customer_email || null,
      phone: order.phone || order.customer_phone || null,
      items: order.items || [],
      total_amount: order.total_amount || 0,
      payment_status: order.payment_status || 'pending',
      order_status: 'accepted', // Always set to accepted when imported
      pickup_date: order.pickup_date || null,
      delivery_date: order.delivery_date || null,
      delivery_type: order.delivery_type || null,
      delivery_address: order.delivery_address || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Insert/upsert into pikago_orders table
    const { data, error } = await supabase
      .from('pikago_orders')
      .upsert(pikagoOrderPayload, { 
        onConflict: 'source_order_id'
      })
      .select()
      .single();
    
    if (error) {
      console.error(`❌ Failed to insert order into Pikago database:`, error);
      return NextResponse.json({ 
        error: error.message 
      }, { status: 500 });
    }
    
    console.log(`✅ Successfully imported order ${orderId} as Pikago order ${data.id}`);
    
    return NextResponse.json({ 
      ok: true, 
      pikagoOrderId: data.id,
      sourceOrderId: orderId
    });
    
  } catch (error) {
    console.error('❌ Error in import-order endpoint:', error);
    return NextResponse.json({ 
      error: 'internal_server_error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
