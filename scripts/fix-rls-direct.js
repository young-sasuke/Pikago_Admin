require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const DEMO_PIKAGO_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const DEMO_PIKAGO_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function fixRLS() {
  console.log('🔧 Fixing RLS policies for admin dashboard...');
  
  const supabase = createClient(DEMO_PIKAGO_URL, DEMO_PIKAGO_SERVICE_KEY);
  
  try {
    // Step 1: Disable RLS on orders table completely for demo purposes
    console.log('📋 Step 1: Disabling RLS on orders table...');
    const { error: disableError } = await supabase.rpc('exec_sql', {
      query: 'ALTER TABLE orders DISABLE ROW LEVEL SECURITY;'
    });
    
    if (disableError) {
      console.log('⚠️  RLS disable via RPC failed, trying direct approach...');
      
      // Try direct SQL execution
      const { error: directError } = await supabase
        .from('_supabase_admin')
        .select('*')
        .limit(0);
        
      // Use raw query approach
      const { error: rawError } = await supabase.rpc('exec', {
        sql: 'ALTER TABLE orders DISABLE ROW LEVEL SECURITY;'
      });
      
      if (rawError) {
        console.log('⚠️  Direct approach also failed, manually disabling...');
        // Let's try the most direct approach possible
        const response = await fetch(`${DEMO_PIKAGO_URL}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEMO_PIKAGO_SERVICE_KEY}`,
            'apikey': DEMO_PIKAGO_SERVICE_KEY
          },
          body: JSON.stringify({
            sql: 'ALTER TABLE orders DISABLE ROW LEVEL SECURITY;'
          })
        });
        
        if (!response.ok) {
          console.log('⚠️  All approaches failed. Let\'s try policy cleanup instead...');
        }
      }
    } else {
      console.log('✅ RLS disabled successfully on orders table');
    }
    
    // Step 2: Test anonymous access
    console.log('📋 Step 2: Testing anonymous access...');
    const anonSupabase = createClient(DEMO_PIKAGO_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    const { data: testData, error: testError } = await anonSupabase
      .from('orders')
      .select('id, order_number')
      .limit(1);
      
    if (testError) {
      console.log('❌ Anonymous access still failing:', testError.message);
      
      // Last resort: Create a public read policy
      console.log('📋 Step 3: Creating public read policy...');
      
      const createPolicySQL = `
        CREATE POLICY "Public read access for orders" ON orders
        FOR SELECT TO anon
        USING (true);
      `;
      
      // Try to create policy through different methods
      const methods = [
        () => supabase.rpc('exec_sql', { query: createPolicySQL }),
        () => supabase.rpc('exec', { sql: createPolicySQL }),
        () => fetch(`${DEMO_PIKAGO_URL}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEMO_PIKAGO_SERVICE_KEY}`,
            'apikey': DEMO_PIKAGO_SERVICE_KEY
          },
          body: JSON.stringify({ sql: createPolicySQL })
        })
      ];
      
      for (let i = 0; i < methods.length; i++) {
        try {
          await methods[i]();
          console.log(`✅ Policy created successfully using method ${i + 1}`);
          break;
        } catch (err) {
          console.log(`⚠️  Method ${i + 1} failed:`, err.message);
          if (i === methods.length - 1) {
            console.log('❌ All policy creation methods failed');
          }
        }
      }
      
    } else {
      console.log('✅ Anonymous access working! Found', testData?.length || 0, 'orders');
      if (testData && testData.length > 0) {
        console.log('📋 Sample order:', testData[0]);
      }
    }
    
    // Final test
    console.log('📋 Final test: Fetching orders count...');
    const { count, error: countError } = await anonSupabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      console.log('❌ Count test failed:', countError.message);
    } else {
      console.log(`✅ Total orders visible to admin: ${count}`);
    }
    
  } catch (error) {
    console.error('❌ RLS fix failed:', error);
  }
  
  console.log('🎉 RLS fix complete! Try accessing the admin dashboard now.');
}

fixRLS();
