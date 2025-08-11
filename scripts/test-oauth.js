/**
 * Test Script for Google OAuth Integration
 * 
 * This script helps test and verify that Google OAuth is working correctly
 * and that your admin accounts are properly configured.
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testOAuthConfiguration() {
  console.log('🔍 Testing Google OAuth Configuration...\n')
  
  try {
    // Test 1: Check if we can connect to Supabase
    console.log('1️⃣ Testing Supabase Connection...')
    const { data, error } = await supabase.from('admins').select('count').limit(1)
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message)
      return false
    }
    console.log('✅ Supabase connection successful')

    // Test 2: List current admins
    console.log('\n2️⃣ Listing Admin Users...')
    const { data: admins, error: adminError } = await supabase
      .from('admins')
      .select('email, full_name, role, is_active, created_at')
      .order('created_at', { ascending: false })

    if (adminError) {
      console.error('❌ Error fetching admins:', adminError.message)
      return false
    }

    if (admins.length === 0) {
      console.log('⚠️  No admin users found. You need to add at least one admin.')
      console.log('Run: npm run add-admin your@email.com "Your Name" super_admin')
      return false
    }

    console.log(`✅ Found ${admins.length} admin user(s):`)
    admins.forEach((admin, index) => {
      console.log(`   ${index + 1}. ${admin.full_name} (${admin.email})`)
      console.log(`      Role: ${admin.role} | Active: ${admin.is_active ? 'Yes' : 'No'}`)
    })

    // Test 3: OAuth Configuration Check
    console.log('\n3️⃣ OAuth Configuration Checklist:')
    console.log('✅ Supabase URL configured:', supabaseUrl.substring(0, 30) + '...')
    console.log('✅ Anon key configured:', supabaseKey.substring(0, 20) + '...')
    console.log('📝 Make sure you have configured in Supabase Dashboard:')
    console.log('   - Auth > Providers > Google > Enabled: YES')
    console.log('   - Client ID and Client Secret from Google Cloud Console')
    console.log('   - Redirect URL: http://localhost:3000/auth/callback')
    console.log('   - Site URL: http://localhost:3000')

    console.log('\n4️⃣ Google Cloud Console Checklist:')
    console.log('📝 Make sure you have configured in Google Cloud Console:')
    console.log('   - APIs & Services > Credentials > OAuth 2.0 Client')
    console.log('   - Authorized JavaScript origins: http://localhost:3000')
    console.log('   - Authorized redirect URIs: ' + supabaseUrl + '/auth/v1/callback')

    console.log('\n✅ Configuration test complete!')
    console.log('\n🚀 To test Google OAuth:')
    console.log('1. Start the app: npm run dev')
    console.log('2. Go to: http://localhost:3000/admin/login')
    console.log('3. Click "Continue with Google"')
    console.log('4. Select your Google account')
    console.log('5. You should be redirected to /admin dashboard')
    
    console.log('\n⚠️  Important Notes:')
    console.log('- Your Google email must exist in the admins table')
    console.log('- The admin account must have is_active = true')
    console.log('- If login fails, check browser console for errors')

    return true

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    return false
  }
}

async function checkSpecificEmail(email) {
  console.log(`🔍 Checking admin access for: ${email}`)
  
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single()

    if (error || !data) {
      console.log('❌ Admin access denied:')
      console.log('   - Email not found in admins table, or')
      console.log('   - Account is not active')
      console.log('\n💡 To fix this, run:')
      console.log(`   npm run add-admin "${email}" "Your Name" super_admin`)
      return false
    }

    console.log('✅ Admin access granted!')
    console.log(`   Name: ${data.full_name}`)
    console.log(`   Role: ${data.role}`)
    console.log(`   Permissions:`, JSON.stringify(data.permissions, null, 2))
    return true

  } catch (error) {
    console.error('❌ Error checking admin access:', error.message)
    return false
  }
}

// Parse command line arguments
const args = process.argv.slice(2)

if (args.length > 0) {
  checkSpecificEmail(args[0])
} else {
  testOAuthConfiguration()
}
