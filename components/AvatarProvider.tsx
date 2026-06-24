'use client'
import { AvatarContext } from '@/lib/avatarContext'
import { InitialNotificationCountContext } from '@/lib/initialNotificationCountContext'

export default function AvatarProvider({
  children,
  avatarUrl,
  initialNotificationCount = 0,
}: {
  children:                  React.ReactNode
  avatarUrl:                 string | null
  initialNotificationCount?: number
}) {
  return (
    <AvatarContext.Provider value={avatarUrl}>
      <InitialNotificationCountContext.Provider value={initialNotificationCount}>
        {children}
      </InitialNotificationCountContext.Provider>
    </AvatarContext.Provider>
  )
}
