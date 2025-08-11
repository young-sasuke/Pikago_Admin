'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-toastify'

const sampleOrders = [
  {
    id: 'ORD-001-SAMPLE',
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
    id: 'ORD-002-SAMPLE',
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
    id: 'ORD-003-SAMPLE',
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
  },
  {
    id: 'ORD-004-SAMPLE',
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
    estimated_delivery_time: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
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
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'ORD-005-SAMPLE',
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
    estimated_delivery_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    actual_delivery_time: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    delivery_fee: 120,
    total_amount: 120,
    payment_status: 'paid',
    payment_method: 'online',
    notes: 'Delivered successfully. Customer satisfied.',
    items: [{ name: 'Documents Package', quantity: 1, price: 0 }],
    distance_km: 12.5,
    duration_minutes: 35,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString()
  }
]

export default function SampleDataPage() {
  const [loading, setLoading] = useState(false)
  const [ordersAdded, setOrdersAdded] = useState(false)

  async function addSampleOrders() {
    setLoading(true)
    try {
      // First clear existing sample orders
      await supabase
        .from('orders')
        .delete()
        .like('id', '%SAMPLE%')

      // Add new sample orders
      const { data, error } = await supabase
        .from('orders')
        .insert(sampleOrders)
        .select()

      if (error) {
        throw error
      }

      toast.success(`Successfully added ${sampleOrders.length} sample orders!`)
      setOrdersAdded(true)
      
    } catch (error: any) {
      console.error('Error adding sample orders:', error)
      toast.error(`Error adding sample orders: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function clearSampleOrders() {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .like('id', '%SAMPLE%')

      if (error) {
        throw error
      }

      toast.success('Sample orders cleared successfully!')
      setOrdersAdded(false)
      
    } catch (error: any) {
      console.error('Error clearing sample orders:', error)
      toast.error(`Error clearing sample orders: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Sample Data Management</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sample Orders</h2>
          <p className="text-gray-600 mb-6">
            Add sample orders to test the order management system. This will create 5 sample orders 
            with different statuses: confirmed, assigned, picked up, in transit, and delivered.
          </p>
          
          <div className="space-y-4">
            <div className="flex gap-4">
              <Button
                onClick={addSampleOrders}
                isLoading={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Add Sample Orders
              </Button>
              
              <Button
                onClick={clearSampleOrders}
                isLoading={loading}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                Clear Sample Orders
              </Button>
            </div>
            
            {ordersAdded && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-green-800">
                  ✅ Sample orders added! Go to the{' '}
                  <a href="/admin/orders" className="font-medium underline">
                    Orders page
                  </a>{' '}
                  to see them.
                </p>
              </div>
            )}
          </div>
          
          <div className="mt-8">
            <h3 className="text-md font-semibold text-gray-900 mb-4">Sample Order Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sampleOrders.map((order, index) => (
                <div key={order.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{order.customer_name}</h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'assigned' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'picked_up' ? 'bg-purple-100 text-purple-800' :
                      order.status === 'in_transit' ? 'bg-orange-100 text-orange-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {order.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{order.order_type.replace('_', ' ')}</p>
                  <p className="text-sm text-gray-600 mb-1">₹{order.total_amount}</p>
                  <p className="text-xs text-gray-500">{order.pickup_address}</p>
                  <p className="text-xs text-gray-500">→ {order.delivery_address}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
