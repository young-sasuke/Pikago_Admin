require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Create a Supabase client with the service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase URL or service role key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Function to execute SQL directly
async function executeSql(sql) {
  try {
    // Attempt to execute SQL - note that this requires specific permissions
    // and might not work without direct PostgreSQL access
    const { data, error } = await supabase.from('pikago_orders').select('count(*)').limit(1);
    
    if (error) {
      console.error('❌ Error connecting to database:', error.message);
      return false;
    }
    
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Error executing SQL:', error.message);
    return false;
  }
}

// Add demo riders directly to the database
async function addDemoRiders() {
  try {
    const demoRiders = [
      { name: 'John Rider', phone: '+1234567890', is_active: true },
      { name: 'Sarah Delivery', phone: '+0987654321', is_active: true },
      { name: 'Miguel Express', phone: '+1122334455', is_active: true }
    ];
    
    const { error } = await supabase.from('riders').upsert(demoRiders, { 
      onConflict: 'name'
    });
    
    if (error) {
      console.error('❌ Error adding demo riders:', error.message);
      return false;
    }
    
    console.log('✅ Added demo riders successfully');
    return true;
  } catch (error) {
    console.error('❌ Error adding demo riders:', error.message);
    return false;
  }
}

// Main function to set up the database
async function setupDatabase() {
  console.log('🔧 Setting up Pikago demo database (simplified)...');

  try {
    // Test connection to the database
    const connectionTest = await executeSql('SELECT 1');
    
    if (!connectionTest) {
      console.error('❌ Could not connect to the database. Check your credentials.');
      return;
    }
    
    // Check if tables exist by trying to access them
    console.log('📋 Checking if tables exist...');
    
    // Try to select from pikago_orders table
    const { error: ordersError } = await supabase.from('pikago_orders').select('count(*)').limit(1);
    
    if (ordersError) {
      console.log('❌ pikago_orders table might not exist:', ordersError.message);
      console.log('Please run the SQL commands manually using the Supabase dashboard:');
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

CREATE INDEX IF NOT EXISTS idx_pikago_orders_source_order_id 
ON pikago_orders(source_order_id);
      `);
    } else {
      console.log('✅ pikago_orders table exists');
    }
    
    // Try to select from riders table
    const { error: ridersError } = await supabase.from('riders').select('count(*)').limit(1);
    
    if (ridersError) {
      console.log('❌ riders table might not exist:', ridersError.message);
      console.log('Please run the SQL commands manually using the Supabase dashboard:');
      console.log(`
-- Create riders table
CREATE TABLE IF NOT EXISTS riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
      `);
    } else {
      console.log('✅ riders table exists');
      // Add demo riders if the table exists
      await addDemoRiders();
    }
    
    // Try to select from assignments table
    const { error: assignmentsError } = await supabase.from('assignments').select('count(*)').limit(1);
    
    if (assignmentsError) {
      console.log('❌ assignments table might not exist:', assignmentsError.message);
      console.log('Please run the SQL commands manually using the Supabase dashboard:');
      console.log(`
-- Create assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pikago_order_id UUID REFERENCES pikago_orders(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES riders(id),
  status TEXT DEFAULT 'assigned',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
      
CREATE INDEX IF NOT EXISTS idx_assignments_pikago_order_id 
ON assignments(pikago_order_id);
      
CREATE INDEX IF NOT EXISTS idx_assignments_rider_id 
ON assignments(rider_id);
      `);
    } else {
      console.log('✅ assignments table exists');
    }
    
    console.log('📋 RLS Policy check:');
    console.log(`
-- Set up RLS policies for anonymous access (if needed)
-- Enable RLS on tables
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
    `);
    
    console.log('🎉 Database setup process completed');
    
  } catch (error) {
    console.error('❌ Error in setup process:', error.message);
  }
}

setupDatabase();
