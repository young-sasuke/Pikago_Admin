/**
 * Admin Management Script for Pikago
 * 
 * This script helps you add new admin users to the Pikago admin dashboard.
 * Run this script when you want to authorize new email addresses for admin access.
 * 
 * Usage:
 *   node scripts/add-admin.js <email> <full_name> [role]
 * 
 * Examples:
 *   node scripts/add-admin.js admin@company.com "John Doe" super_admin
 *   node scripts/add-admin.js manager@company.com "Jane Smith" admin
 *   node scripts/add-admin.js viewer@company.com "Bob Wilson" viewer
 * 
 * Roles:
 *   - super_admin: Full access (default)
 *   - admin: Can manage orders and riders
 *   - viewer: Read-only access
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials in environment variables')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function addAdmin(email, fullName, role = 'super_admin') {
  // Validate role
  const validRoles = ['super_admin', 'admin', 'viewer']
  if (!validRoles.includes(role)) {
    console.error(`❌ Error: Invalid role "${role}". Must be one of: ${validRoles.join(', ')}`)
    process.exit(1)
  }

  // Set permissions based on role
  const permissions = {
    super_admin: {
      can_assign_orders: true,
      can_manage_riders: true,
      can_view_analytics: true
    },
    admin: {
      can_assign_orders: true,
      can_manage_riders: true,
      can_view_analytics: false
    },
    viewer: {
      can_assign_orders: false,
      can_manage_riders: false,
      can_view_analytics: false
    }
  }

  try {
    console.log(`🔄 Adding admin user: ${email}`)
    
    // Insert or update admin
    const { data, error } = await supabase
      .from('admins')
      .upsert({
        email: email.toLowerCase(),
        full_name: fullName,
        role: role,
        permissions: permissions[role],
        is_active: true
      }, {
        onConflict: 'email'
      })
      .select()

    if (error) {
      console.error('❌ Database error:', error.message)
      process.exit(1)
    }

    console.log('✅ Admin user added successfully!')
    console.log(`📧 Email: ${email}`)
    console.log(`👤 Name: ${fullName}`)
    console.log(`🔑 Role: ${role}`)
    console.log(`✨ They can now sign in with Google OAuth or email/password`)
    
  } catch (err) {
    console.error('❌ Unexpected error:', err.message)
    process.exit(1)
  }
}

async function listAdmins() {
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('email, full_name, role, is_active, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Database error:', error.message)
      process.exit(1)
    }

    console.log('\n👥 Current Admin Users:')
    console.log('─'.repeat(80))
    
    if (data.length === 0) {
      console.log('No admin users found.')
    } else {
      data.forEach((admin, index) => {
        console.log(`${index + 1}. ${admin.full_name}`)
        console.log(`   📧 ${admin.email}`)
        console.log(`   🔑 ${admin.role}`)
        console.log(`   ${admin.is_active ? '✅ Active' : '❌ Inactive'}`)
        console.log(`   📅 Added: ${new Date(admin.created_at).toLocaleDateString()}`)
        console.log('')
      })
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err.message)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)

if (args.length === 0 || args[0] === 'list') {
  listAdmins()
} else if (args.length >= 2) {
  const [email, fullName, role] = args
  
  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    console.error('❌ Error: Invalid email address')
    process.exit(1)
  }
  
  addAdmin(email, fullName, role)
} else {
  console.log(`
🔧 Pikago Admin Management Script

Usage:
  node scripts/add-admin.js <email> <full_name> [role]
  node scripts/add-admin.js list

Examples:
  node scripts/add-admin.js admin@company.com "John Doe" super_admin
  node scripts/add-admin.js manager@company.com "Jane Smith" admin
  node scripts/add-admin.js list

Roles:
  - super_admin: Full access (default)
  - admin: Can manage orders and riders  
  - viewer: Read-only access
  `)
}
