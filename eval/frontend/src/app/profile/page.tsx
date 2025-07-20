'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/handler/account-settings')
  }, [router])

  return null
}