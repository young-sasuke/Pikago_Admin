# Google OAuth Setup for Pikago Admin

## 🚀 Quick Setup Guide

Your Pikago Admin dashboard now supports **Google OAuth authentication**! Follow these steps to enable it:

### ✅ Admin Account Ready
- **Your Email:** `blackstorm5353@gmail.com`  
- **Role:** Super Admin  
- **Permissions:** Full access (orders, riders, analytics)

### 🔧 Configure Google OAuth in Supabase

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Navigate to your project: `dflyeqxytzoujtktogxb`

2. **Enable Google OAuth**
   - Go to **Authentication > Settings > Social Auth Providers**
   - Find **Google** and click **Enable**

3. **Configure Google Provider**
   - **Client ID:** (Get from Google Cloud Console - see below)
   - **Client Secret:** (Get from Google Cloud Console)
   - **Redirect URL:** `https://dflyeqxytzoujtktogxb.supabase.co/auth/v1/callback`

### 🛠️ Google Cloud Console Setup

1. **Create/Select Project**
   - Go to: https://console.cloud.google.com
   - Create a new project or select existing one

2. **Enable Google+ API**
   - Go to **APIs & Services > Library**
   - Search for "Google+ API" and enable it

3. **Create OAuth 2.0 Credentials**
   - Go to **APIs & Services > Credentials**
   - Click **Create Credentials > OAuth 2.0 Client IDs**
   - Application type: **Web application**
   - Name: `Pikago Admin`

4. **Configure OAuth Consent Screen**
   - Go to **OAuth consent screen**
   - User Type: **External** (for testing)
   - Fill in required fields:
     - App name: `Pikago Admin`
     - User support email: `blackstorm5353@gmail.com`
     - Developer contact: `blackstorm5353@gmail.com`

5. **Set Authorized Redirect URIs**
   - In your OAuth client settings, add:
   - `https://dflyeqxytzoujtktogxb.supabase.co/auth/v1/callback`
   - `http://localhost:3000` (for development)

### 🔐 Copy Credentials
- Copy **Client ID** and **Client Secret** from Google Cloud Console
- Paste them in Supabase Authentication settings

### 🧪 Testing

1. **Start the App**
   ```bash
   npm run dev
   ```

2. **Visit Login Page**
   - Go to: http://localhost:3000/admin/login
   - Click **"Continue with Google"**

3. **Sign in with Google**
   - Use your email: `blackstorm5353@gmail.com`
   - You should be redirected to the admin dashboard

### 🎯 What Happens After OAuth:

1. ✅ **Authentication:** Google handles login
2. ✅ **Authorization:** System checks if your email exists in `admins` table
3. ✅ **Access Granted:** You get full super admin access
4. ✅ **Session:** Persistent login session created

### 🚨 Security Notes:

- Only emails in the `admins` table can access the dashboard
- Even with valid Google OAuth, unauthorized users are rejected
- Your email (`blackstorm5353@gmail.com`) is pre-authorized as Super Admin

### 🆘 Troubleshooting:

**"Access denied" error?**
- Ensure your email is exactly `blackstorm5353@gmail.com` in Google account
- Check the `admins` table has your email with `is_active = true`

**OAuth redirect issues?**
- Verify redirect URIs match exactly in Google Cloud Console
- Check Supabase Auth settings have correct Google credentials

**Still having issues?**
- Check browser console for errors
- Verify Supabase project URL and keys in `.env.local`

### 🎉 You're Ready!

Once Google OAuth is configured:
- ✅ **Login:** Use Google OAuth or email/password
- ✅ **Dashboard:** Full access to orders, riders, assignments
- ✅ **Real-time:** Live updates and notifications
- ✅ **Security:** Admin-only access with RLS policies

---

**Project:** Pikago Admin Dashboard  
**Database:** Supabase (dflyeqxytzoujtktogxb)  
**Status:** ✅ Ready for Google OAuth setup
