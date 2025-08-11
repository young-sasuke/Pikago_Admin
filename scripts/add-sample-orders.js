/**
 * Add Sample Orders to DemoPikago
 * 
 * This script adds sample orders to test the order management system
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Sample orders data
const sampleOrders = [
  {
    id: 'ORD-001-' + Date.now(),
    customer_name: 'John Doe',
    customer_phone: '+91 9876543210',
    customer_email: 'john.doe@email.com',
    pickup_address: 'ABC Restaurant, MG Road, Bangalore',
    delivery_address: '123 Park Street, Koramangala, Bangalore',
    pickup_lat: 12.9716,
    pickup_lng: 77.5946,
    delivery_lat: 12.9351,
    delivery_lng: 77.6245,
    order_type: 'food_delivery',
    status: 'confirmed',
    priority: 'high',
    estimated_delivery_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
    delivery_fee: 49,
    total_amount: 650,
    payment_status: 'paid',
    payment_method: 'online',
    notes: 'Extra spicy. Ring the bell twice.',
    items: [
      { name: 'Chicken Biryani', quantity: 2, price: 250 },
      { name: 'Raita', quantity: 1, price: 50 },
      { name: 'Gulab Jamun', quantity: 4, price: 100 }
    ],
    distance_km: 5.2,
    duration_minutes: 25,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'ORD-002-' + Date.now(),
    customer_name: 'Sarah Wilson',
    customer_phone: '+91 8765432109',
    customer_email: 'sarah.wilson@email.com',
    pickup_address: 'Indiranagar Metro Station, Bangalore',
    delivery_address: '456 Richmond Road, Bangalore',
    pickup_lat: 12.9719,
    pickup_lng: 77.6412,
    delivery_lat: 12.9698,
    delivery_lng: 77.6205,
    order_type: 'package_delivery',
    status: 'assigned',
    priority: 'normal',
    estimated_delivery_time: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45 minutes from now
    delivery_fee: 75,
    total_amount: 75,
    payment_status: 'pending',
    payment_method: 'cash',
    notes: 'Fragile items. Handle with care.',
    items: [
      { name: 'Electronics Package', quantity: 1, price: 0 }
    ],
    distance_km: 3.1,
    duration_minutes: 15,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    updated_at: new Date().toISOString()
  },
  {
    id: 'ORD-003-' + Date.now(),
    customer_name: 'Raj Patel',
    customer_phone: '+91 7654321098',
    customer_email: 'raj.patel@email.com',
    pickup_address: 'Big Bazaar, Forum Mall, Koramangala',
    delivery_address: '789 HSR Layout, Bangalore',
    pickup_lat: 12.9279,
    pickup_lng: 77.6271,
    delivery_lat: 12.9082,
    delivery_lng: 77.6476,
    order_type: 'grocery_delivery',
    status: 'picked_up',
    priority: 'normal',
    estimated_delivery_time: new Date(Date.now() + 20 * 60 * 1000).toISOString(), // 20 minutes from now
    delivery_fee: 30,
    total_amount: 1250,
    payment_status: 'paid',
    payment_method: 'online',
    notes: 'Leave at security desk if not home.',
    items: [
      { name: 'Vegetables', quantity: 1, price: 300 },
      { name: 'Fruits', quantity: 1, price: 250 },
      { name: 'Dairy Products', quantity: 1, price: 200 },
      { name: 'Snacks', quantity: 1, price: 150 }
    ],
    distance_km: 4.8,
    duration_minutes: 22,
    created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
    updated_at: new Date().toISOString()
  },
  {
    id: 'ORD-004-' + Date.now(),
    customer_name: 'Priya Sharma',
    customer_phone: '+91 6543210987',
    customer_email: 'priya.sharma@email.com',
    pickup_address: 'Cafe Coffee Day, Brigade Road',
    delivery_address: '321 Jayanagar, Bangalore',
    pickup_lat: 12.9698,
    pickup_lng: 77.6205,
    delivery_lat: 12.9279,
    delivery_lng: 77.5937,
    order_type: 'food_delivery',
    status: 'in_transit',
    priority: 'urgent',
    estimated_delivery_time: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
    delivery_fee: 40,
    total_amount: 380,
    payment_status: 'paid',
    payment_method: 'card',
    notes: 'Customer will be waiting at gate.',
    items: [
      { name: 'Cappuccino', quantity: 2, price: 120 },
      { name: 'Sandwich', quantity: 1, price: 150 },
      { name: 'Cake Slice', quantity: 2, price: 110 }
    ],
    distance_km: 6.2,
    duration_minutes: 18,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
    updated_at: new Date().toISOString()
  },
  {
    id: 'ORD-005-' + Date.now(),
    customer_name: 'Mike Johnson',
    customer_phone: '+91 5432109876',
    customer_email: 'mike.johnson@email.com',
    pickup_address: 'UB City Mall, Vittal Mallya Road',
    delivery_address: '654 Whitefield, Bangalore',
    pickup_lat: 12.9719,
    pickup_lng: 77.5937,
    delivery_lat: 12.9698,
    delivery_lng: 77.7499,
    order_type: 'package_delivery',
    status: 'delivered',
    priority: 'normal',
    estimated_delivery_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
    actual_delivery_time: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    delivery_fee: 120,
    total_amount: 120,
    payment_status: 'paid',
    payment_method: 'online',
    notes: 'Delivered successfully. Customer satisfied.',
    items: [
      { name: 'Documents Package', quantity: 1, price: 0 }
    ],
    distance_km: 12.5,
    duration_minutes: 35,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
    updated_at: new Date().toISOString()
  }
]

async function addSampleOrders() {
  console.log('📦 Adding sample orders to DemoPikago database...')
  
  try {
    // Clear existing sample orders first
    await supabase
      .from('orders')
      .delete()
      .like('id', 'ORD-%')
    
    console.log('🗑️  Cleared existing sample orders')
    
    // Add new sample orders
    const { data, error } = await supabase
      .from('orders')
      .insert(sampleOrders)
      .select()
    
    if (error) {
      console.error('❌ Error adding sample orders:', error.message)
      return false
    }
    
    console.log(`✅ Successfully added ${sampleOrders.length} sample orders!`)
    
    // Show order summary
    console.log('\n📊 Order Summary:')
    sampleOrders.forEach((order, index) => {
      console.log(`${index + 1}. ${order.customer_name} - ${order.status.toUpperCase()} - ₹${order.total_amount}`)
    })
    
    console.log('\n🎉 Sample orders are now available in your admin dashboard!')
    console.log('🌐 Go to: http://localhost:3000/admin/orders to see them')
    
    return true
    
  } catch (error) {
    console.error('❌ Error in addSampleOrders:', error.message)
    return false
  }
}

async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('count')
      .limit(1)
      
    if (error) {
      console.error('❌ Database connection failed:', error.message)
      return false
    }
    
    console.log('✅ Database connection successful')
    return true
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message)
    return false
  }
}

async function main() {
  console.log('🔧 DemoPikago Sample Orders Script\n')
  
  // Test connection first
  const connected = await testConnection()
  if (!connected) {
    console.error('❌ Cannot connect to database. Please check your configuration.')
    process.exit(1)
  }
  
  // Add sample orders
  const success = await addSampleOrders()
  if (success) {
    console.log('\n✅ Sample orders added successfully!')
  } else {
    console.error('\n❌ Failed to add sample orders')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message)
  process.exit(1)
})
