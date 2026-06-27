'use client'
import { AvatarContext } from '@/lib/avatarContext'
import { InitialNotificationCountContext } from '@/lib/initialNotificationCountContext'
import { InitialMessageCountContext } from '@/lib/initialMessageCountContext'

export default function AvatarProvider({
  children,
  avatarUrl,
  initialNotificationCount = 0,
  initialMessageCount = 0,
}: {
  children:                  React.ReactNode
  avatarUrl:                 string | null
  initialNotificationCount?: number
  initialMessageCount?:      number
}) {
  return (
    <AvatarContext.Provider value={avatarUrl}>
      <InitialNotificationCountContext.Provider value={initialNotificationCount}>
        <InitialMessageCountContext.Provider value={initialMessageCount}>
          {children}
        </InitialMessageCountContext.Provider>
      </InitialNotificationCountContext.Provider>
    </AvatarContext.Provider>
  )
}
