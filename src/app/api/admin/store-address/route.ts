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
    .from('store_addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, data: data ?? [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, addressData } = body

    if (!name || !addressData) {
      return NextResponse.json(
        { ok: false, error: 'name and addressData are required' },
        { status: 400 }
      )
    }

    // Validate required address fields
    const required = ['recipient_name', 'phone', 'line1', 'city', 'state', 'pincode']
    for (const field of required) {
      if (!addressData[field]) {
        return NextResponse.json(
          { ok: false, error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // If this is being set as default, unset other defaults first
    if (addressData.is_default) {
      await supabaseAdmin
        .from('store_addresses')
        .update({ is_default: false })
        .neq('id', '00000000-0000-0000-0000-000000000000') // dummy condition since we're creating new
    }

    const { data, error } = await supabaseAdmin
      .from('store_addresses')
      .insert({
        name,
        address: addressData,
        is_default: addressData.is_default || false
      })
      .select()
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
  const { error } = await supabaseAdmin.from('store_addresses').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
