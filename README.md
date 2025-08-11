# Pikago Admin Dashboard

A modern, real-time admin dashboard for managing Pikago delivery operations. Built with Next.js 15, Supabase, and Tailwind CSS.

## Features

### 🔐 Authentication
- **Email/Password Login**: Secure admin authentication
- **Google OAuth**: One-click Google sign-in integration
- **Role-based Access**: Support for super_admin, admin, and viewer roles
- **Protected Routes**: Automatic redirect for unauthorized access

### 📊 Real-time Dashboard
- **Live Statistics**: Real-time order and rider metrics
- **Recent Activity**: Latest orders and assignments feed
- **Interactive Charts**: Data visualization with Recharts
- **Toast Notifications**: Real-time updates for all operations

### 📦 Order Management
- **Order Overview**: Complete order listing with search and filters
- **Order Details**: Full order information in modal view
- **Assign Riders**: Quick rider assignment with RPC integration
- **Status Tracking**: Real-time order status updates

### 🎨 Modern UI
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Dark/Light Themes**: Automatic theme detection
- **Loading States**: Smooth loading animations
- **Accessible Components**: WCAG compliant UI elements

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Supabase project with Pikago database schema
- Google OAuth credentials (for Google sign-in)

### Installation

1. **Clone and Setup**:
   ```bash
   cd pikago-admin
   npm install
   ```

2. **Environment Configuration**:
   Create `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Add Your First Admin**:
   ```bash
   npm run add-admin admin@yourcompany.com "Your Name" super_admin
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

5. **Access Dashboard**: Open http://localhost:3000/admin

## Admin Management

### Adding New Admins
Use the built-in admin management script:

```bash
# Add a super admin (full access)
npm run add-admin admin@company.com "John Doe" super_admin

# Add a regular admin (can manage orders/riders)
npm run add-admin manager@company.com "Jane Smith" admin

# Add a viewer (read-only access)
npm run add-admin viewer@company.com "Bob Wilson" viewer
```

### List Current Admins
```bash
npm run list-admins
```

### Admin Roles
- **super_admin**: Full dashboard access including analytics
- **admin**: Can manage orders and riders, no analytics access
- **viewer**: Read-only access to all data

## Google OAuth Setup

For complete Google OAuth integration, follow the detailed guide in `GOOGLE_OAUTH_SETUP.md`:

1. Configure Google Cloud Console OAuth credentials
2. Set up Supabase Auth provider
3. Add authorized domains
4. Test the integration

## Database Schema

The dashboard expects these Supabase tables:

### `admins` Table
```sql
CREATE TABLE admins (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  permissions jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);
```

### Required Tables
- `orders`: Order management
- `riders`: Rider information
- `assignments`: Order-rider assignments
- `notifications`: System notifications

### Required Functions
- `assign_order_to_rider(order_id, rider_id)`: RPC function for order assignment

## Project Structure

```
pikago-admin/
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── dashboard/         # Dashboard page
│   │   │   ├── orders/           # Orders management
│   │   │   └── login/            # Authentication
│   │   ├── components/           # Reusable UI components
│   │   ├── hooks/               # Custom React hooks
│   │   └── lib/                 # Utilities and config
├── scripts/
│   └── add-admin.js             # Admin management script
├── GOOGLE_OAUTH_SETUP.md        # OAuth setup guide
└── README.md                    # This file
```

## Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint
- `npm run add-admin`: Add new admin user
- `npm run list-admins`: List all admin users

## Real-time Features

The dashboard includes real-time subscriptions for:

- **New Orders**: Instant notification when orders are placed
- **Order Updates**: Status changes and modifications
- **New Assignments**: Rider assignments and updates
- **System Notifications**: Important system messages

All real-time updates show toast notifications with relevant information.

## Security Features

- **Row Level Security**: Supabase RLS policies protect data
- **Role-based Permissions**: Granular access control
- **Secure Authentication**: JWT-based session management
- **Environment Variables**: Sensitive data protection
- **Input Validation**: All forms include proper validation

## Customization

### Adding New Pages
1. Create page component in `src/app/admin/[page]/page.tsx`
2. Add navigation link in `src/components/Layout/Sidebar.tsx`
3. Update permissions in admin roles as needed

### Modifying Styles
- Global styles: `src/app/globals.css`
- Component styles: Use Tailwind CSS classes
- Custom components: Extend existing design system

### Adding Real-time Features
Use the `useRealtimeSubscription` hook:

```typescript
const { data, loading } = useRealtimeSubscription('your_table', {
  onInsert: (payload) => {
    toast.success('New item added!')
  }
})
```

## Deployment

### Vercel (Recommended)
1. Connect your GitHub repository
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms
1. Build the project: `npm run build`
2. Set environment variables
3. Deploy the `.next` folder

## Support

For issues and questions:
1. Check existing GitHub issues
2. Review Supabase documentation
3. Check Next.js documentation
4. Create new issue with detailed description

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, HeadlessUI
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Notifications**: React Toastify

---

Built with ❤️ for efficient delivery management.
