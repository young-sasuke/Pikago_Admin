/**
 * Order Synchronization Service
 * 
 * This service syncs accepted orders from IronXpress DB to DemoPikago DB
 * Run this service to keep both databases synchronized
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// IronXpress Database (Source)
const ironxpressClient = createClient(
  'https://qehtgclgjhzdlqcjujpp.supabase.co', // IronXpress URL
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlaHRnY2xnamh6ZGxxY2p1anBwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg0OTY3NiwiZXhwIjoyMDY2NDI1Njc2fQ.6wlzcNTxYbpWcP_Kbi6PNiFU7WgfQ66hDf3Zx8mvur0' // IronXpress service role
)

// DemoPikago Database (Destination) 
const pikagoClient = createClient(
  'https://dflyeqxytzoujtktogxb.supabase.co', // DemoPikago URL
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbHllcXh5dHpvdWp0a3RvZ3hiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY1MTcyNiwiZXhwIjoyMDcwMjI3NzI2fQ.C9J0-D8dRG3KiO6TVza_EEPta70X2WTbyia-Rdltl4o' // DemoPikago service role
)

console.log('🔄 Starting Order Synchronization Service...')
console.log('📦 IronXpress -> DemoPikago Order Sync')
console.log('⏰ Monitoring for accepted orders...\n')

// Track synced orders to avoid duplicates
const syncedOrderIds = new Set()

async function getAcceptedOrders() {
  try {
    console.log('🔍 Checking IronXpress for accepted orders...')
    
    const { data: orders, error } = await ironxpressClient
      .from('orders')
      .select('*')
      .in('order_status', ['confirmed', 'accepted']) // Get both confirmed and accepted orders
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching IronXpress orders:', error.message)
      return []
    }

    console.log(`📊 Found ${orders?.length || 0} confirmed orders in IronXpress`)
    return orders || []
    
  } catch (error) {
    console.error('❌ Error in getAcceptedOrders:', error.message)
    return []
  }
}

async function syncOrderToPikago(order) {
  try {
    // Skip if already synced
    if (syncedOrderIds.has(order.id)) {
      return false
    }

    console.log(`📦 Syncing order ${order.id} to DemoPikago...`)

    // Transform order data from IronXpress to DemoPikago format
    // Using only fields that exist in both databases
    const pikagoOrder = {
      id: order.id,
      user_id: order.user_id,
      total_amount: order.total_amount,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      payment_id: order.payment_id,
      order_status: order.order_status, // Keep the confirmed status
      pickup_date: order.pickup_date,
      pickup_slot_id: order.pickup_slot_id,
      delivery_date: order.delivery_date,
      delivery_slot_id: order.delivery_slot_id,
      delivery_type: order.delivery_type,
      delivery_address: order.delivery_address,
      address_details: order.address_details,
      applied_coupon_code: order.applied_coupon_code,
      discount_amount: order.discount_amount,
      created_at: order.created_at,
      updated_at: new Date().toISOString(),
      status: null, // Keep null for now
      cancelled_at: order.cancelled_at,
      cancellation_reason: order.cancellation_reason,
      can_be_cancelled: order.can_be_cancelled,
      original_pickup_slot_id: order.original_pickup_slot_id,
      original_delivery_slot_id: order.original_delivery_slot_id,
      pickup_slot_display_time: order.pickup_slot_display_time,
      pickup_slot_start_time: order.pickup_slot_start_time,
      pickup_slot_end_time: order.pickup_slot_end_time,
      delivery_slot_display_time: order.delivery_slot_display_time,
      delivery_slot_start_time: order.delivery_slot_start_time,
      delivery_slot_end_time: order.delivery_slot_end_time
    }

    // Insert or update order in DemoPikago
    const { data, error } = await pikagoClient
      .from('orders')
      .upsert(pikagoOrder, {
        onConflict: 'id'
      })
      .select()

    if (error) {
      console.error(`❌ Error syncing order ${order.id}:`, error.message)
      return false
    }

    console.log(`✅ Successfully synced order ${order.id} to DemoPikago`)
    
    // Mark as synced
    syncedOrderIds.add(order.id)
    return true

  } catch (error) {
    console.error(`❌ Error syncing order ${order.id}:`, error.message)
    return false
  }
}

async function syncAllOrders() {
  try {
    const acceptedOrders = await getAcceptedOrders()
    
    if (acceptedOrders.length === 0) {
      console.log('📭 No new accepted orders to sync')
      return
    }

    let syncedCount = 0
    
    for (const order of acceptedOrders) {
      const synced = await syncOrderToPikago(order)
      if (synced) {
        syncedCount++
      }
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (syncedCount > 0) {
      console.log(`🎉 Successfully synced ${syncedCount} orders to DemoPikago!`)
    }

  } catch (error) {
    console.error('❌ Error in syncAllOrders:', error.message)
  }
}

// Real-time sync using Supabase subscriptions
async function startRealtimeSync() {
  try {
    console.log('🔔 Starting real-time sync...')
    
    // Subscribe to IronXpress orders table
    const subscription = ironxpressClient
      .channel('order-sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        async (payload) => {
          // Only sync if order is confirmed or accepted
          if (['confirmed', 'accepted'].includes(payload.new.order_status)) {
            console.log('🔔 Real-time order update detected:', payload.new.id, payload.new.order_status)
            await syncOrderToPikago(payload.new)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        async (payload) => {
          // Only sync if order is confirmed or accepted
          if (['confirmed', 'accepted'].includes(payload.new.order_status)) {
            console.log('🔔 Real-time new order detected:', payload.new.id, payload.new.order_status)
            await syncOrderToPikago(payload.new)
          }
        }
      )
      .subscribe()

    console.log('✅ Real-time sync enabled!')

  } catch (error) {
    console.error('❌ Error setting up real-time sync:', error.message)
  }
}

// Manual sync function
async function performManualSync() {
  console.log('🔄 Performing manual sync...')
  await syncAllOrders()
}

// Periodic sync (every 30 seconds)
async function startPeriodicSync() {
  console.log('⏰ Starting periodic sync (every 30 seconds)...')
  
  setInterval(async () => {
    console.log('\n⏰ Periodic sync check...')
    await syncAllOrders()
  }, 30000) // 30 seconds
}

// Test connection function
async function testConnections() {
  console.log('🔍 Testing database connections...')
  
  try {
    // Test IronXpress connection
    const { data: ironData, error: ironError } = await ironxpressClient
      .from('orders')
      .select('count')
      .limit(1)
      
    if (ironError) {
      console.error('❌ IronXpress connection failed:', ironError.message)
      return false
    }
    console.log('✅ IronXpress connection successful')

    // Test DemoPikago connection
    const { data: pikagoData, error: pikagoError } = await pikagoClient
      .from('orders')
      .select('count')
      .limit(1)
      
    if (pikagoError) {
      console.error('❌ DemoPikago connection failed:', pikagoError.message)
      return false
    }
    console.log('✅ DemoPikago connection successful')
    
    return true

  } catch (error) {
    console.error('❌ Connection test failed:', error.message)
    return false
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'sync'

  switch (command) {
    case 'test':
      await testConnections()
      break
      
    case 'sync':
      const connected = await testConnections()
      if (!connected) {
        console.error('❌ Connection test failed. Exiting...')
        process.exit(1)
      }
      
      // Perform initial sync
      await performManualSync()
      
      // Start real-time and periodic sync
      await startRealtimeSync()
      await startPeriodicSync()
      
      console.log('\n🚀 Order sync service is running!')
      console.log('Press Ctrl+C to stop')
      break
      
    case 'manual':
      await performManualSync()
      process.exit(0)
      break
      
    default:
      console.log(`
🔧 Pikago Order Sync Service

Usage:
  node scripts/order-sync.js [command]

Commands:
  sync     Start continuous sync service (default)
  manual   Perform one-time manual sync
  test     Test database connections

Examples:
  node scripts/order-sync.js sync
  node scripts/order-sync.js manual
  node scripts/order-sync.js test
      `)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down order sync service...')
  process.exit(0)
})

// Run main function
main().catch(error => {
  console.error('❌ Fatal error:', error.message)
  process.exit(1)
})
