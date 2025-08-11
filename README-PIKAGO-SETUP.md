# Pikago Admin Dashboard Setup Guide

## Overview

This admin dashboard receives accepted orders from IronXpress, stores them in DemoPikago database, and allows admins to assign orders to riders for delivery.

## 🔧 Setup Instructions

### 1. Environment Configuration

Your `.env.local` file is already configured with:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://dflyeqxytzoujtktogxb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
IMPORT_SHARED_SECRET=dev-shared-secret-918273645
IRONXPRESS_BASE_URL=http://localhost:3000
```

### 2. Database Setup

**IMPORTANT:** You need to create the database tables manually in Supabase Dashboard first.

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to SQL Editor
3. Run the following SQL commands:

```sql
-- Create pikago_orders table
CREATE TABLE IF NOT EXISTS pikago_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_order_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  total_amount NUMERIC,
  payment_status TEXT,
  order_status TEXT DEFAULT 'accepted',
  pickup_date TIMESTAMPTZ,
  delivery_date TIMESTAMPTZ,
  delivery_type TEXT,
  delivery_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create riders table
CREATE TABLE IF NOT EXISTS riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pikago_order_id UUID REFERENCES pikago_orders(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES riders(id),
  status TEXT DEFAULT 'assigned',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and create policies
ALTER TABLE pikago_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admin full access to pikago_orders" ON pikago_orders
  FOR ALL TO anon USING (true);
  
CREATE POLICY "Admin full access to riders" ON riders
  FOR ALL TO anon USING (true);
  
CREATE POLICY "Admin full access to assignments" ON assignments
  FOR ALL TO anon USING (true);

-- Insert demo riders
INSERT INTO riders (name, phone, is_active) VALUES 
  ('John Rider', '+1234567890', true),
  ('Sarah Delivery', '+0987654321', true),
  ('Miguel Express', '+1122334455', true)
ON CONFLICT DO NOTHING;
```

### 3. Test Database Setup

After creating the tables, run:
```bash
npm run test-demo
```

This will:
- Test database connection
- Create a demo order
- Create demo riders
- Verify data can be retrieved

### 4. Start the Development Server

```bash
npm run dev
```

The admin dashboard will be available at: http://localhost:3001

## 📡 API Endpoints

### Import Order Endpoint
`POST /api/import-order`

**Headers:**
- `x-shared-secret`: Must match `IMPORT_SHARED_SECRET` environment variable
- `Content-Type: application/json`

**Body:**
```json
{
  "orderId": "uuid-of-order-from-ironxpress",
  "source": "IronXpress"
}
```

**Response:**
```json
{
  "ok": true,
  "pikagoOrderId": "uuid-of-created-pikago-order",
  "sourceOrderId": "uuid-of-source-order"
}
```

### Assign Rider Endpoint
`POST /api/assign`

**Body:**
```json
{
  "pikagoOrderId": "uuid-of-pikago-order",
  "riderId": "uuid-of-rider"
}
```

### Update Assignment Status
`PUT /api/assign`

**Body:**
```json
{
  "assignmentId": "uuid-of-assignment",
  "status": "picked_up|in_transit|completed|cancelled"
}
```

## 🔄 Integration Flow

1. **Order Acceptance in IronXpress**: When an order is accepted in IronXpress
2. **Import to Pikago**: IronXpress calls `/api/import-order` endpoint
3. **Order Appears in Dashboard**: Order shows up in Pikago admin dashboard
4. **Rider Assignment**: Admin assigns order to available rider
5. **Status Updates**: Rider or admin updates delivery status

## 🛠 Development Scripts

- `npm run dev` - Start development server on port 3001
- `npm run test-demo` - Test database connection and create demo data
- `npm run setup-db` - Display database setup instructions
- `npm run build` - Build for production
- `npm run start` - Start production server

## 📋 Admin Dashboard Features

### Orders Management
- View all imported orders from IronXpress
- Filter by status (accepted, assigned, picked_up, in_transit, delivered)
- Search by customer name, phone, or address
- Assign orders to available riders
- View detailed order information

### Rider Management
- View list of active riders
- Assign/reassign orders to riders
- Track rider availability

### Assignment Tracking
- Monitor order assignment status
- Update delivery status (assigned → picked_up → in_transit → completed)
- View assignment history

## 🔒 Security Notes

- The import endpoint uses a shared secret for authentication
- Row Level Security (RLS) is enabled on all tables
- Service role key is used for server-side operations
- Anonymous key is used for frontend operations with RLS policies

## 🐛 Troubleshooting

### Tables don't exist error
Run the SQL commands in Supabase Dashboard SQL Editor first.

### Connection errors
Verify your Supabase URL and keys in `.env.local`

### Import endpoint not working
Ensure IronXpress uses the correct shared secret: `dev-shared-secret-918273645`

### No orders appearing
Check that:
1. Tables are created correctly
2. RLS policies are set up
3. Orders are being imported via the API endpoint

## 📞 Testing Import

To test the import endpoint locally:
```bash
# Start the dev server first
npm run dev

# In another terminal, test the endpoint
node scripts/test-import-endpoint.js
```

## 🚀 Production Deployment

1. Set up production Supabase project
2. Update environment variables
3. Deploy to your hosting platform (Vercel, Netlify, etc.)
4. Update IronXpress with production import endpoint URL
