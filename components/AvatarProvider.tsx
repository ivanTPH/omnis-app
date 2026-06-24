'use client'
import { AvatarContext } from '@/lib/avatarContext'

export default function AvatarProvider({
  children,
  avatarUrl,
}: {
  children: React.ReactNode
  avatarUrl: string | null
}) {
  return <AvatarContext.Provider value={avatarUrl}>{children}</AvatarContext.Provider>
}
