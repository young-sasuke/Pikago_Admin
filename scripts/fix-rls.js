/**
 * Fix RLS Policies Script
 * 
 * This script fixes the RLS policies to allow admin dashboard access
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// DemoPikago Database with service role for admin operations
const supabase = createClient(
  'https://dflyeqxytzoujtktogxb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbHllcXh5dHpvdWp0a3RvZ3hiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY1MTcyNiwiZXhwIjoyMDcwMjI3NzI2fQ.C9J0-D8dRG3KiO6TVza_EEPta70X2WTbyia-Rdltl4o'
)

console.log('🔧 Fixing RLS policies for admin dashboard...')

async function fixRLSPolicies() {
  try {
    console.log('📋 Step 1: Drop existing problematic policies...')
    
    // Drop all existing policies that might cause recursion
    const dropPolicies = [
      'DROP POLICY IF EXISTS "Admins can view all orders" ON orders;',
      'DROP POLICY IF EXISTS "Admin read access" ON orders;', 
      'DROP POLICY IF EXISTS "Enable read access for admins" ON orders;',
      'DROP POLICY IF EXISTS "Admins can read all orders" ON orders;',
      'DROP POLICY IF EXISTS "Admin full access" ON orders;'
    ]
    
    for (const policy of dropPolicies) {
      try {
        const { error } = await supabase.rpc('sql', { query: policy })
        if (error) {
          console.log(`⚠️  Policy drop failed (might not exist): ${error.message}`)
        } else {
          console.log(`✅ Dropped policy: ${policy.split(' ON ')[0]}`)
        }
      } catch (err) {
        console.log(`⚠️  Policy drop error: ${err.message}`)
      }
    }

    console.log('📋 Step 2: Create simple RLS policy for orders...')
    
    // Create a simple policy that allows anon access to orders (since this is a demo)
    const createOrdersPolicy = `
      CREATE POLICY "Allow anon access to orders" ON orders
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
    `
    
    const { error: ordersError } = await supabase.rpc('sql', { query: createOrdersPolicy })
    if (ordersError) {
      console.error('❌ Failed to create orders policy:', ordersError.message)
    } else {
      console.log('✅ Created orders access policy for anon users')
    }

    console.log('📋 Step 3: Ensure RLS is enabled on orders...')
    
    // Enable RLS on orders table
    const enableRLS = `ALTER TABLE orders ENABLE ROW LEVEL SECURITY;`
    const { error: rlsError } = await supabase.rpc('sql', { query: enableRLS })
    if (rlsError) {
      console.log('⚠️  RLS enable failed (might already be enabled):', rlsError.message)
    } else {
      console.log('✅ RLS enabled on orders table')
    }

    console.log('📋 Step 4: Test anon access...')
    
    // Test with anon client
    const anonSupabase = createClient(
      'https://dflyeqxytzoujtktogxb.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbHllcXh5dHpvdWp0a3RvZ3hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NTE3MjYsImV4cCI6MjA3MDIyNzcyNn0.3MO3y-3rX0AjFmburoTOKO2dNMeK4bRo4PmG3Fb1nFo'
    )
    
    const { data, error } = await anonSupabase.from('orders').select('id').limit(1)
    if (error) {
      console.error('❌ Anon access still failing:', error.message)
      
      // Alternative: Temporarily disable RLS for demo purposes
      console.log('📋 Alternative: Disabling RLS on orders table for demo...')
      const disableRLS = `ALTER TABLE orders DISABLE ROW LEVEL SECURITY;`
      const { error: disableError } = await supabase.rpc('sql', { query: disableRLS })
      if (disableError) {
        console.error('❌ Failed to disable RLS:', disableError.message)
      } else {
        console.log('✅ RLS disabled on orders table (demo mode)')
        
        // Test again
        const { data: testData, error: testError } = await anonSupabase.from('orders').select('id').limit(1)
        if (testError) {
          console.error('❌ Still failing after disabling RLS:', testError.message)
        } else {
          console.log('✅ Anon access now working! Found', testData?.length, 'orders')
        }
      }
    } else {
      console.log('✅ Anon access working! Found', data?.length, 'orders')
    }

  } catch (error) {
    console.error('❌ Error fixing RLS policies:', error.message)
  }
}

// Main execution
fixRLSPolicies().then(() => {
  console.log('🎉 RLS fix complete! Try accessing the admin dashboard now.')
  process.exit(0)
}).catch(error => {
  console.error('❌ Fatal error:', error.message)
  process.exit(1)
})
