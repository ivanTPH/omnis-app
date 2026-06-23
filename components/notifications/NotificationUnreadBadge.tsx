'use client'
import { useNotificationCount } from '@/lib/notificationCountContext'

export default function NotificationUnreadBadge() {
  const count = useNotificationCount()
  if (count === 0) return null
  return (
    <span className="ml-auto w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shrink-0">
      {count > 9 ? '9+' : count}
    </span>
  )
}
