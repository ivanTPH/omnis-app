'use client'
import { useState, useEffect } from 'react'
import { getUnreadNotificationCount } from '@/app/actions/messaging'

export default function NotificationUnreadBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        const n = await getUnreadNotificationCount()
        setCount(n)
      } catch {}
    }
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  if (count === 0) return null
  return (
    <span className="ml-auto w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shrink-0">
      {count > 9 ? '9+' : count}
    </span>
  )
}
