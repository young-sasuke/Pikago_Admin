'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { LoadingCard } from '@/components/ui/Loading'
import { Plus, MapPin, Trash2, Store } from 'lucide-react'

type StoreRow = { id: string; address: any }

type FormState = {
  recipient_name: string
  phone_number: string
  address_line_1: string
  address_line_2: string
  landmark: string
  city: string
  state: string
  pincode: string
  address_type: 'Home' | 'Work' | 'Other'
  is_default: 'true' | 'false'
  latitude: string
  longitude: string
  user_id: string
}

const initialForm: FormState = {
  recipient_name: '',
  phone_number: '',
  address_line_1: '',
  address_line_2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  address_type: 'Home',
  is_default: 'true',
  latitude: '',
  longitude: '',
  user_id: '',
}

export default function StoreAddressesPage() {
  const [rows, setRows] = useState<StoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openForm, setOpenForm] = useState(false)
  const [form, setForm] = useState<FormState>(initialForm)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/store-address', { cache: 'no-store' })
      const data = await res.json()
      if (data?.ok) setRows(data.data ?? [])
      else throw new Error(data?.error || 'Failed to load store addresses')
    } catch (e) {
      console.error(e)
      alert('Failed to load store addresses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function onChange<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      // Build the JSON exactly as requested
      const now = new Date().toISOString()
      const address = {
        id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2), // fallback
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        user_id: form.user_id.trim() || null,
        landmark: form.landmark.trim() || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        created_at: now,
        is_default: form.is_default === 'true',
        updated_at: now,
        address_type: form.address_type,
        phone_number: form.phone_number.trim(),
        address_line_1: form.address_line_1.trim(),
        address_line_2: form.address_line_2.trim() || '',
        recipient_name: form.recipient_name.trim(),
      }

      const res = await fetch('/api/admin/store-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? 'Add failed')

      setForm(initialForm)
      setOpenForm(false)
      await load()
    } catch (err: any) {
      alert(err?.message ?? 'Failed to add store address')
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this store address?')) return
    try {
      const res = await fetch(`/api/admin/store-address?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? 'Delete failed')
      await load()
    } catch (err: any) {
      alert(err?.message ?? 'Failed to delete')
    }
  }

  const preview = useMemo(() => {
    const now = new Date().toISOString()
    const obj = {
      id: '<auto>',
      city: form.city,
      state: form.state,
      pincode: form.pincode,
      user_id: form.user_id || null,
      landmark: form.landmark || null,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      created_at: now,
      is_default: form.is_default === 'true',
      updated_at: now,
      address_type: form.address_type,
      phone_number: form.phone_number,
      address_line_1: form.address_line_1,
      address_line_2: form.address_line_2,
      recipient_name: form.recipient_name,
    }
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return ''
    }
  }, [form])

  const table = useMemo(
    () => (
      <div className="overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-6 py-3 text-left font-medium">ID</th>
              <th className="px-6 py-3 text-left font-medium">Store Details</th>
              <th className="px-6 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded max-w-fit">
                    {r.id.slice(0, 8)}...
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                      <MapPin className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900">{formatAddressSummary(r.address)}</div>
                      <div className="mt-1 text-sm text-gray-500">
                        {r.address?.phone_number && (
                          <span className="mr-3">📞 {r.address.phone_number}</span>
                        )}
                        {r.address?.address_type && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            r.address.address_type === 'Home' ? 'bg-green-100 text-green-800' :
                            r.address.address_type === 'Work' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {r.address.address_type}
                          </span>
                        )}
                        {r.address?.is_default && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Default
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(r.id)}
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <Store className="h-12 w-12 text-gray-400 mb-3" />
                    <h3 className="text-sm font-medium text-gray-900 mb-1">No store locations</h3>
                    <p className="text-sm text-gray-500">Get started by adding your first store location.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    ),
    [rows, loading]
  )

  const headerActions = (
    <Button
      onClick={() => setOpenForm((v) => !v)}
      className="flex items-center gap-2"
    >
      <Plus className="h-4 w-4" />
      {openForm ? 'Close Form' : 'Add Store'}
    </Button>
  )

  return (
    <AdminLayout title="Store Address" headerActions={headerActions}>
      <div className="space-y-6">

      {openForm && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-gray-500" />
              <h3 className="text-lg font-medium text-gray-900">Add New Store Location</h3>
            </div>
          </div>
          
          <form onSubmit={onAdd} className="p-6 space-y-6">
            {/* Contact Information */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-4">Contact Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Recipient name *"
                  value={form.recipient_name}
                  onChange={(v) => onChange('recipient_name', v)}
                  required
                />
                <Field
                  label="Phone number *"
                  value={form.phone_number}
                  onChange={(v) => onChange('phone_number', v)}
                  required
                />
              </div>
            </div>

            {/* Address Details */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-4">Address Details</h4>
              <div className="space-y-4">
                <Field
                  label="Address line 1 *"
                  value={form.address_line_1}
                  onChange={(v) => onChange('address_line_1', v)}
                  required
                />
                <Field
                  label="Address line 2"
                  value={form.address_line_2}
                  onChange={(v) => onChange('address_line_2', v)}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    label="Landmark"
                    value={form.landmark}
                    onChange={(v) => onChange('landmark', v)}
                  />
                  <Field
                    label="City *"
                    value={form.city}
                    onChange={(v) => onChange('city', v)}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    label="State *"
                    value={form.state}
                    onChange={(v) => onChange('state', v)}
                    required
                  />
                  <Field
                    label="Pincode *"
                    value={form.pincode}
                    onChange={(v) => onChange('pincode', v)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Store Settings */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-4">Store Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Address type"
                  value={form.address_type}
                  onChange={(v) => onChange('address_type', v as any)}
                  options={['Home', 'Work', 'Other']}
                />
                <Select
                  label="Is default location"
                  value={form.is_default}
                  onChange={(v) => onChange('is_default', v as any)}
                  options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
                />
              </div>
            </div>

            {/* Location Coordinates */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-4">Location Coordinates (Optional)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Latitude"
                  value={form.latitude}
                  onChange={(v) => onChange('latitude', v)}
                  placeholder="e.g. 20.3563749"
                />
                <Field
                  label="Longitude"
                  value={form.longitude}
                  onChange={(v) => onChange('longitude', v)}
                  placeholder="e.g. 85.8239589"
                />
              </div>
            </div>

            {/* Advanced Options */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-4">Advanced Options</h4>
              <Field
                label="User ID (optional)"
                value={form.user_id}
                onChange={(v) => onChange('user_id', v)}
                placeholder="UUID of linked user, if any"
              />
            </div>

            {/* Preview */}
            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Data Preview</h4>
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                <div className="mb-2 text-xs font-medium text-gray-600">JSON that will be stored:</div>
                <pre className="text-[11px] leading-relaxed text-gray-800 overflow-x-auto whitespace-pre-wrap">{preview}</pre>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenForm(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Store className="h-4 w-4" />
                    Save Store
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

        {/* Store Addresses Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-gray-500" />
              <h3 className="text-lg font-medium text-gray-900">Store Locations</h3>
            </div>
          </div>
          
          {loading ? (
            <div className="p-6">
              <LoadingCard />
            </div>
          ) : (
            table
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

/* ---------- small UI helpers ---------- */

function Field(props: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
}) {
  const { label, value, onChange, required, placeholder } = props
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-gray-700">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20"
      />
    </label>
  )
}

function Select(props: {
  label: string
  value: string
  options: (string | { value: string; label: string })[]
  onChange: (v: string) => void
}) {
  const { label, value, options, onChange } = props
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20"
      >
        {options.map((o) => {
          const optionValue = typeof o === 'string' ? o : o.value
          const optionLabel = typeof o === 'string' ? o : o.label
          return (
            <option key={optionValue} value={optionValue} className="text-gray-900">{optionLabel}</option>
          )
        })}
      </select>
    </label>
  )
}

/* ---------- helpers ---------- */

function formatAddressSummary(a: any): string {
  if (!a || typeof a !== 'object') return '—'
  const parts = [
    a.recipient_name,
    a.address_line_1,
    a.address_line_2,
    a.city,
    a.state,
    a.pincode,
  ].filter(Boolean).join(', ')
  return parts || '—'
}

function compactJson(a: any): string {
  try {
    return JSON.stringify(a)
  } catch {
    return ''
  }
}
