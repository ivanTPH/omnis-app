'use client'
import { useState, useEffect } from 'react'
import { getUnreadMessageCount } from '@/app/actions/messaging'

export default function UnreadBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        const n = await getUnreadMessageCount()
        setCount(n)
      } catch {}
    }
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  if (count === 0) return null
  return (
    <span className="ml-auto w-4 h-4 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center shrink-0">
      {count > 9 ? '9+' : count}
    </span>
  )
}
