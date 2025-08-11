require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Create a Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase URL or service role key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabase() {
  console.log('🔧 Setting up Pikago demo database schema...');

  try {
    // Step 1: Create pikago_orders table
    console.log('📋 Creating pikago_orders table...');
    const createPikagoOrdersSQL = `
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
    `;
    
    const { error: ordersError } = await supabase.rpc('execute_sql', {
      sql: createPikagoOrdersSQL
    }).catch(e => ({ error: e }));
    
    if (ordersError) {
      console.error('❌ Error creating pikago_orders table:', ordersError.message);
      console.log('Trying alternative method...');
      
      // Use raw query
      const { error: rawOrdersError } = await supabase.auth.admin.executeSql(createPikagoOrdersSQL);
      
      if (rawOrdersError) {
        console.error('❌ Error creating pikago_orders table (alt method):', rawOrdersError.message);
      } else {
        console.log('✅ Created pikago_orders table successfully (alt method)');
      }
    } else {
      console.log('✅ Created pikago_orders table successfully');
    }
    
    // Step 2: Create riders table
    console.log('📋 Creating riders table...');
    const createRidersSQL = `
      CREATE TABLE IF NOT EXISTS riders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        phone TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    const { error: ridersError } = await supabase.rpc('execute_sql', {
      sql: createRidersSQL
    }).catch(e => ({ error: e }));
    
    if (ridersError) {
      console.error('❌ Error creating riders table:', ridersError.message);
      
      // Use raw query
      const { error: rawRidersError } = await supabase.auth.admin.executeSql(createRidersSQL);
      
      if (rawRidersError) {
        console.error('❌ Error creating riders table (alt method):', rawRidersError.message);
      } else {
        console.log('✅ Created riders table successfully (alt method)');
      }
    } else {
      console.log('✅ Created riders table successfully');
    }
    
    // Step 3: Create assignments table
    console.log('📋 Creating assignments table...');
    const createAssignmentsSQL = `
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
    `;
    
    const { error: assignmentsError } = await supabase.rpc('execute_sql', {
      sql: createAssignmentsSQL
    }).catch(e => ({ error: e }));
    
    if (assignmentsError) {
      console.error('❌ Error creating assignments table:', assignmentsError.message);
      
      // Use raw query
      const { error: rawAssignmentsError } = await supabase.auth.admin.executeSql(createAssignmentsSQL);
      
      if (rawAssignmentsError) {
        console.error('❌ Error creating assignments table (alt method):', rawAssignmentsError.message);
      } else {
        console.log('✅ Created assignments table successfully (alt method)');
      }
    } else {
      console.log('✅ Created assignments table successfully');
    }
    
    // Step 4: Create RLS policies for anonymous access to these tables
    console.log('📋 Setting up RLS policies...');
    const setupRLSSQL = `
      -- Enable RLS on all tables
      ALTER TABLE pikago_orders ENABLE ROW LEVEL SECURITY;
      ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
      ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
      
      -- Create policies for admin access (anon role for simplicity in demo)
      CREATE POLICY "Admin full access to pikago_orders" ON pikago_orders
        FOR ALL TO anon USING (true);
        
      CREATE POLICY "Admin full access to riders" ON riders
        FOR ALL TO anon USING (true);
        
      CREATE POLICY "Admin full access to assignments" ON assignments
        FOR ALL TO anon USING (true);
    `;
    
    const { error: rlsError } = await supabase.rpc('execute_sql', {
      sql: setupRLSSQL
    }).catch(e => ({ error: e }));
    
    if (rlsError) {
      console.error('❌ Error setting up RLS policies:', rlsError.message);
      
      // Use raw query
      const { error: rawRlsError } = await supabase.auth.admin.executeSql(setupRLSSQL);
      
      if (rawRlsError) {
        console.error('❌ Error setting up RLS policies (alt method):', rawRlsError.message);
      } else {
        console.log('✅ Set up RLS policies successfully (alt method)');
      }
    } else {
      console.log('✅ Set up RLS policies successfully');
    }
    
    // Step 5: Insert demo riders
    console.log('📋 Adding demo riders...');
    const demoRiders = [
      { name: 'John Rider', phone: '+1234567890', is_active: true },
      { name: 'Sarah Delivery', phone: '+0987654321', is_active: true },
      { name: 'Miguel Express', phone: '+1122334455', is_active: true }
    ];
    
    const { error: ridersInsertError } = await supabase
      .from('riders')
      .upsert(demoRiders, { onConflict: 'name' });
    
    if (ridersInsertError) {
      console.error('❌ Error adding demo riders:', ridersInsertError.message);
    } else {
      console.log('✅ Added demo riders successfully');
    }
    
    // Verify database setup
    console.log('📋 Verifying database setup...');
    
    // Check if tables exist
    const { data: tableList, error: tableError } = await supabase
      .from('riders')
      .select('id, name')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Database verification failed:', tableError.message);
    } else {
      console.log('✅ Database verification successful');
      console.log('🎉 Pikago demo database setup complete!');
    }
    
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
  }
}

setupDatabase();
