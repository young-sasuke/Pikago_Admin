'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin')
  }, [router])
  return null
}
