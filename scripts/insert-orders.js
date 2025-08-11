/**
 * Direct Order Insert Script
 * 
 * Bypasses RLS to directly insert sample orders
 */

const { createClient } = require('@supabase/supabase-js')

// Use service role key to bypass RLS
const supabase = createClient(
  'https://dflyeqxytzoujtktogxb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbHllcXh5dHpvdWp0a3RvZ3hiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY1MTcyNiwiZXhwIjoyMDcwMjI3NzI2fQ.xNHkafXcOAFxoQQY6j3eiCWWR5W9vNy9FEKWvyIlvd0'
)

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
    estimated_delivery_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
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
    estimated_delivery_time: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
    delivery_fee: 75,
    total_amount: 75,
    payment_status: 'pending',
    payment_method: 'cash',
    notes: 'Fragile items. Handle with care.',
    items: [{ name: 'Electronics Package', quantity: 1, price: 0 }],
    distance_km: 3.1,
    duration_minutes: 15,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
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
    estimated_delivery_time: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
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
    created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString()
  }
]

async function insertOrders() {
  try {
    console.log('📦 Inserting sample orders...')
    
    const { data, error } = await supabase
      .from('orders')
      .insert(sampleOrders)
      .select()
    
    if (error) {
      console.error('❌ Error:', error.message)
      return
    }
    
    console.log(`✅ Successfully inserted ${sampleOrders.length} orders!`)
    console.log('🌐 Check your admin dashboard: http://localhost:3000/admin/orders')
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message)
  }
}

insertOrders()
