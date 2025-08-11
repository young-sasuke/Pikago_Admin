import { createClient } from '@supabase/supabase-js'

// fix: Handle missing environment variables gracefully
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// fix: Only create client if env vars are present
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Types for our database tables
export interface Order {
  id: string
  user_id: string
  total_amount: number
  payment_method: string
  payment_status: string
  payment_id?: string
  order_status: string
  pickup_date: string
  pickup_slot_id?: string
  delivery_date: string
  delivery_slot_id?: string
  delivery_type: string
  delivery_address: string
  address_details?: any
  applied_coupon_code?: string
  discount_amount?: number
  created_at: string
  updated_at: string
  status?: string
  cancelled_at?: string
  cancellation_reason?: string
  can_be_cancelled?: boolean
  original_pickup_slot_id?: string
  original_delivery_slot_id?: string
  pickup_slot_display_time?: string
  pickup_slot_start_time?: string
  pickup_slot_end_time?: string
  delivery_slot_display_time?: string
  delivery_slot_start_time?: string
  delivery_slot_end_time?: string
}

export interface Admin {
  id: string
  email: string
  full_name: string
  role: 'super_admin' | 'admin' | 'viewer'
  is_active: boolean
  permissions: any
  last_login_at?: string
  created_at: string
  updated_at: string
}

export interface Rider {
  id: string
  rider_code: string
  full_name: string
  phone: string
  email?: string
  vehicle_type: 'motorcycle' | 'bicycle' | 'car' | 'scooter'
  vehicle_number?: string
  license_number?: string
  is_active: boolean
  is_available: boolean
  current_location?: any
  max_orders_per_day: number
  current_orders_count: number
  rating?: number
  total_deliveries: number
  successful_deliveries: number
  profile_image_url?: string
  emergency_contact?: any
  working_hours?: any
  preferred_areas?: string[]
  notes?: string
  hired_at: string
  created_at: string
  updated_at: string
}

export interface OrderAssignment {
  id: string
  order_id: string
  rider_id: string
  assigned_by: string
  assignment_status: 'assigned' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled' | 'failed'
  assignment_type: 'pickup_only' | 'delivery_only' | 'both'
  pickup_scheduled_at?: string
  pickup_started_at?: string
  pickup_completed_at?: string
  delivery_started_at?: string
  delivery_completed_at?: string
  estimated_pickup_time?: string
  estimated_delivery_time?: string
  actual_pickup_time?: string
  actual_delivery_time?: string
  pickup_location?: any
  delivery_location?: any
  distance_km?: number
  estimated_duration_minutes?: number
  actual_duration_minutes?: number
  pickup_notes?: string
  delivery_notes?: string
  customer_rating?: number
  customer_feedback?: string
  delivery_proof_urls?: string[]
  cancellation_reason?: string
  cancelled_at?: string
  cancelled_by?: string
  created_at: string
  updated_at: string
  
  // Joined data
  orders?: Order
  riders?: Rider
}

export interface Notification {
  id: string
  recipient_type: 'admin' | 'rider' | 'customer' | 'system'
  recipient_id?: string
  notification_type: string
  title: string
  message: string
  data?: any
  priority: 'low' | 'medium' | 'high' | 'urgent'
  is_read: boolean
  is_sent: boolean
  sent_at?: string
  read_at?: string
  expires_at?: string
  related_order_id?: string
  related_assignment_id?: string
  created_at: string
  updated_at: string
}

export interface DashboardStats {
  total_orders: number
  pending_orders: number
  assigned_orders: number
  in_transit_orders: number
  delivered_orders: number
  active_riders: number
  available_riders: number
  unread_notifications: number
  today_revenue: string
  today_orders: number
}
