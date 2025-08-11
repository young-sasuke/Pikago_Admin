/**
 * Schema Inspector for IronXpress Database
 * 
 * This script inspects the IronXpress database schema to understand
 * what fields are available in the orders table
 */

const { createClient } = require('@supabase/supabase-js')

// IronXpress Database (Source)
const ironxpressClient = createClient(
  'https://qehtgclgjhzdlqcjujpp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlaHRnY2xnamh6ZGxxY2p1anBwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg0OTY3NiwiZXhwIjoyMDY2NDI1Njc2fQ.6wlzcNTxYbpWcP_Kbi6PNiFU7WgfQ66hDf3Zx8mvur0'
)

// DemoPikago Database (Destination)
const pikagoClient = createClient(
  'https://dflyeqxytzoujtktogxb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbHllcXh5dHpvdWp0a3RvZ3hiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY1MTcyNiwiZXhwIjoyMDcwMjI3NzI2fQ.C9J0-D8dRG3KiO6TVza_EEPta70X2WTbyia-Rdltl4o'
)

async function inspectSchemas() {
  try {
    console.log('🔍 Inspecting database schemas...\n')
    
    // Get sample order from IronXpress to see available fields
    console.log('📊 IronXpress Orders Table Structure:')
    const { data: ironOrders, error: ironError } = await ironxpressClient
      .from('orders')
      .select('*')
      .limit(1)
    
    if (ironError) {
      console.error('❌ Error fetching IronXpress order:', ironError.message)
    } else if (ironOrders && ironOrders.length > 0) {
      console.log('Available fields in IronXpress orders:')
      Object.keys(ironOrders[0]).forEach((field, index) => {
        console.log(`  ${index + 1}. ${field}: ${typeof ironOrders[0][field]} (${ironOrders[0][field]})`)
      })
    }

    console.log('\n' + '─'.repeat(80) + '\n')

    // Get sample order from DemoPikago to see expected fields
    console.log('📦 DemoPikago Orders Table Structure:')
    const { data: pikagoOrders, error: pikagoError } = await pikagoClient
      .from('orders')
      .select('*')
      .limit(1)
    
    if (pikagoError) {
      console.error('❌ Error fetching DemoPikago order:', pikagoError.message)
    } else if (pikagoOrders && pikagoOrders.length > 0) {
      console.log('Available fields in DemoPikago orders:')
      Object.keys(pikagoOrders[0]).forEach((field, index) => {
        console.log(`  ${index + 1}. ${field}: ${typeof pikagoOrders[0][field]}`)
      })
    } else {
      console.log('No orders in DemoPikago yet. Checking table structure...')
      
      // Try to insert a minimal record to see what fields are required
      const testOrder = {
        id: 'TEST_SCHEMA_CHECK',
        status: 'pending'
      }
      
      const { error: insertError } = await pikagoClient
        .from('orders')
        .insert([testOrder])
      
      if (insertError) {
        console.log('DemoPikago schema requirements based on error:', insertError.message)
      }
      
      // Clean up test record
      await pikagoClient
        .from('orders')
        .delete()
        .eq('id', 'TEST_SCHEMA_CHECK')
    }

    // Find common fields
    console.log('\n' + '─'.repeat(80) + '\n')
    
    if (ironOrders && ironOrders.length > 0) {
      const ironFields = Object.keys(ironOrders[0])
      console.log('🔗 Field Mapping Strategy:')
      console.log('Only map fields that exist in IronXpress:')
      
      const commonFields = [
        'id',
        'customer_name',
        'customer_phone', 
        'pickup_address',
        'delivery_address',
        'pickup_lat',
        'pickup_lng', 
        'delivery_lat',
        'delivery_lng',
        'order_type',
        'status',
        'priority',
        'estimated_delivery_time',
        'delivery_fee',
        'total_amount',
        'payment_status',
        'payment_method',
        'notes',
        'items',
        'distance_km',
        'duration_minutes',
        'created_at',
        'updated_at'
      ]
      
      console.log('Fields to map (if available in IronXpress):')
      commonFields.forEach(field => {
        const exists = ironFields.includes(field)
        console.log(`  ${exists ? '✅' : '❌'} ${field}`)
      })
    }

  } catch (error) {
    console.error('❌ Error inspecting schemas:', error.message)
  }
}

inspectSchemas()
