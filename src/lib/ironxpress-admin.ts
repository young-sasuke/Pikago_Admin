// src/lib/ironxpress-admin.ts
import { createClient } from '@supabase/supabase-js'

const IRON_URL = process.env.IRONXPRESS_SUPABASE_URL!
const IRON_SERVICE = process.env.IRONXPRESS_SERVICE_ROLE_KEY!

export const ironxpressAdmin = IRON_URL && IRON_SERVICE
  ? createClient(IRON_URL, IRON_SERVICE, { auth: { persistSession: false } })
  : null

export function ensureIronxpress() {
  if (!ironxpressAdmin) throw new Error('IRONXPRESS env missing')
  return ironxpressAdmin
}
