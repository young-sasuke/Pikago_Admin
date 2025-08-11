require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Create a Supabase client with the service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Environment check:');
console.log('- Supabase URL:', supabaseUrl ? 'Set' : 'Missing');
console.log('- Service Key:', supabaseServiceKey ? 'Set' : 'Missing');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase URL or service role key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  console.log('\n🔍 Testing database connection...');
  
  try {
    // Try to test connection by inserting demo data directly
    console.log('📦 Creating demo order...');
    
    const demoOrder = {
      source_order_id: '00000000-0000-0000-0000-000000000001', // Example UUID
      full_name: 'John Test Customer',
      email: 'john@test.com',
      phone: '+1234567890',
      items: [{ name: 'Test Item', quantity: 1, price: 100 }],
      total_amount: 100,
      payment_status: 'paid',
      order_status: 'accepted',
      pickup_date: new Date().toISOString(),
      delivery_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      delivery_type: 'home_delivery',
      delivery_address: '123 Test Street, Test City'
    };
    
    // Try to insert the demo order
    const { data, error } = await supabase
      .from('pikago_orders')
      .upsert(demoOrder, { onConflict: 'source_order_id' })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error inserting demo order:', error.message);
      console.log('\n📋 You need to create the tables manually in Supabase Dashboard:');
      console.log(`
-- Create pikago_orders table
CREATE TABLE IF NOT EXISTS pikago_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_order_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  total_amount NUMERIC,
  payment_status TEXT,
  order_status TEXT DEFAULT 'accepted',
  pickup_date TIMESTAMPTZ,
  delivery_date TIMESTAMPTZ,
  delivery_type TEXT,
  delivery_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create riders table
CREATE TABLE IF NOT EXISTS riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pikago_order_id UUID REFERENCES pikago_orders(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES riders(id),
  status TEXT DEFAULT 'assigned',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and create policies
ALTER TABLE pikago_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admin full access to pikago_orders" ON pikago_orders
  FOR ALL TO anon USING (true);
  
CREATE POLICY "Admin full access to riders" ON riders
  FOR ALL TO anon USING (true);
  
CREATE POLICY "Admin full access to assignments" ON assignments
  FOR ALL TO anon USING (true);

-- Insert demo riders
INSERT INTO riders (name, phone, is_active) VALUES 
  ('John Rider', '+1234567890', true),
  ('Sarah Delivery', '+0987654321', true),
  ('Miguel Express', '+1122334455', true)
ON CONFLICT DO NOTHING;
      `);
      return false;
    }
    
    console.log('✅ Demo order created successfully!');
    console.log('📋 Order ID:', data.id);
    
    // Now test creating demo riders
    console.log('\n👥 Creating demo riders...');
    const demoRiders = [
      { name: 'John Rider', phone: '+1234567890', is_active: true },
      { name: 'Sarah Delivery', phone: '+0987654321', is_active: true },
      { name: 'Miguel Express', phone: '+1122334455', is_active: true }
    ];
    
    const { error: ridersError } = await supabase
      .from('riders')
      .upsert(demoRiders, { onConflict: 'name' });
    
    if (ridersError) {
      console.error('❌ Error creating demo riders:', ridersError.message);
      return false;
    }
    
    console.log('✅ Demo riders created successfully!');
    
    // Test fetching data
    console.log('\n🔍 Testing data retrieval...');
    
    const { data: orders, error: ordersError } = await supabase
      .from('pikago_orders')
      .select('*')
      .limit(5);
    
    if (ordersError) {
      console.error('❌ Error fetching orders:', ordersError.message);
      return false;
    }
    
    console.log('✅ Successfully fetched', orders.length, 'orders');
    
    const { data: riders, error: ridersErrorFetch } = await supabase
      .from('riders')
      .select('*')
      .limit(5);
    
    if (ridersErrorFetch) {
      console.error('❌ Error fetching riders:', ridersErrorFetch.message);
      return false;
    }
    
    console.log('✅ Successfully fetched', riders.length, 'riders');
    
    console.log('\n🎉 Database setup and test completed successfully!');
    console.log('🚀 You can now start the admin dashboard with: npm run dev');
    
    return true;
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    return false;
  }
}

testConnection();
