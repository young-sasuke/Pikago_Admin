import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // avoid route caching in dev

// GET  -> list store addresses (id, address)
// POST -> add a new address (accepts {address: <object>} in your schema)
// DELETE -> remove by id (?id=...)

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('store_address')
    .select('id, address')
    .order('id', { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, data: data ?? [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))
    let address = body?.address

    if (!address || typeof address !== 'object') {
      return NextResponse.json({ ok: false, error: 'address is required' }, { status: 400 })
    }

    // Server-side safety: fill required fields and defaults
    const now = new Date().toISOString()
    address = {
      id: address.id || crypto.randomUUID(),
      city: address.city ?? '',
      state: address.state ?? '',
      pincode: address.pincode ?? '',
      user_id: address.user_id ?? null,
      landmark: address.landmark ?? null,
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
      created_at: address.created_at ?? now,
      is_default: !!address.is_default,
      updated_at: now,
      address_type: address.address_type ?? 'Home',
      phone_number: address.phone_number ?? '',
      address_line_1: address.address_line_1 ?? '',
      address_line_2: address.address_line_2 ?? '',
      recipient_name: address.recipient_name ?? '',
    }

    const { data, error } = await supabaseAdmin
      .from('store_address')
      .insert({ address })
      .select('id, address')
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, data }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown_error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 })
  }
  const { error } = await supabaseAdmin.from('store_address').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
