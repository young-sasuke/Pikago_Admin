import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Return users to the Assign modal (RLS-safe via service role)
export async function GET() {
  try {
    const { data: users, error: usersErr } = await supabaseAdmin
      .from('users')
      .select('id, email, phone, created_at')
      .order('created_at', { ascending: false })

    if (usersErr) {
      return NextResponse.json({ ok: false, error: usersErr.message }, { status: 500 })
    }

    // Optional enrichment from delivery_partners if it exists
    const ids = (users ?? []).map((u: any) => u.id)
    let dpByUser: Record<string, any> = {}

    if (ids.length) {
      const { data: dps } = await supabaseAdmin
        .from('delivery_partners')
        .select('user_id, first_name, last_name, is_active, is_available')
        .in('user_id', ids)
      if (Array.isArray(dps)) {
        dpByUser = Object.fromEntries(dps.map((r: any) => [String(r.user_id), r]))
      }
    }

    // Shape to the Assign modal’s expected structure
    const rows = (users ?? []).map((u: any) => {
      const dp = dpByUser[String(u.id)]
      const full_name =
        (dp && [dp.first_name, dp.last_name].filter(Boolean).join(' ').trim()) ||
        (u.email?.split('@')[0] ?? u.phone ?? 'User')

      return {
        id: String(u.id),
        full_name,
        email: u.email ?? null,
        phone: u.phone ?? null,
        is_active: dp?.is_active ?? true,     // default to true if no DP row
        is_available: dp?.is_available ?? true,
        created_at: u.created_at,
      }
    })

    return NextResponse.json({ ok: true, data: rows })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? 'Unknown error' }, { status: 500 })
  }
}
