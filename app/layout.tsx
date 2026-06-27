import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { auth }                    from '@/lib/auth'
import { getAccessibilitySettings } from '@/app/actions/accessibility'
import { getMyAvatarUrl }           from '@/app/actions/settings'
import { getUnreadNotificationCount, getUnreadMessageCount } from '@/app/actions/messaging'
import { settingsToClasses, ACCESSIBILITY_DEFAULTS } from '@/lib/accessibility'
import AccessibilityToolbar         from '@/components/accessibility/AccessibilityToolbar'
import AvatarProvider               from '@/components/AvatarProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title:       'Omnis Education',
  description: 'Secondary Learning & SEND Intelligence Platform',
  icons: {
    icon:   '/favicon.png',
    apple:  '/favicon.png',
  },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Fetch accessibility settings server-side so classes are applied before paint
  let userId: string | null = null
  let accessibilityClasses = ''
  let initialSettings = ACCESSIBILITY_DEFAULTS
  let avatarUrl: string | null = null
  let initialNotificationCount = 0
  let initialMessageCount = 0
  try {
    const session = await auth()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = session?.user as any
    if (user?.id) {
      userId = user.id
      ;[initialSettings, avatarUrl, initialNotificationCount, initialMessageCount] = await Promise.all([
        getAccessibilitySettings(user.id),
        getMyAvatarUrl(),
        getUnreadNotificationCount(),
        getUnreadMessageCount(),
      ])
      accessibilityClasses = settingsToClasses(initialSettings)
    }
  } catch {
    // Not authenticated — no classes applied
  }

  return (
    <html lang="en" className={accessibilityClasses || undefined}>
      <head>
        {/* Material Icons are self-hosted via public/fonts/material-icons.woff2
            and declared in globals.css — no external CDN request needed. */}
        {/* OpenDyslexic font — only loaded when user has dyslexia font enabled */}
        {initialSettings.dyslexiaFont && (
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic-regular.min.css"
          />
        )}
      </head>
      <body className={inter.className}>
        <AvatarProvider avatarUrl={avatarUrl} initialNotificationCount={initialNotificationCount} initialMessageCount={initialMessageCount}>
          {children}
        </AvatarProvider>
        <AccessibilityToolbar userId={userId} initialSettings={initialSettings} />
      </body>
    </html>
  )
}
