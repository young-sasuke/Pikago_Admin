// src/lib/address.ts (Pikago Admin)
export type AddressDTO = {
  label: string | null
  phone?: string | null
  address_text: string | null
  lat: number | null
  lng: number | null
}

export function toDisplay(a?: AddressDTO | null): string {
  if (!a) return '—'
  const parts = [a.label || undefined, a.address_text || undefined, a.phone || undefined].filter(Boolean)
  return parts.join(' • ')
}
