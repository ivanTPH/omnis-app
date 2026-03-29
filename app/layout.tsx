import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { auth }                    from '@/lib/auth'
import { getAccessibilitySettings } from '@/app/actions/accessibility'
import { settingsToClasses }        from '@/lib/accessibility'
import AccessibilityToolbar         from '@/components/accessibility/AccessibilityToolbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title:       'Omnis Education',
  description: 'Secondary Learning & SEND Intelligence Platform',
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Fetch accessibility settings server-side so classes are applied before paint
  let userId: string | null = null
  let accessibilityClasses = ''
  try {
    const session = await auth()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = session?.user as any
    if (user?.id) {
      userId = user.id
      const settings = await getAccessibilitySettings(user.id)
      accessibilityClasses = settingsToClasses(settings)
    }
  } catch {
    // Not authenticated — no classes applied
  }

  return (
    <html lang="en" className={accessibilityClasses || undefined}>
      <head>
        {/* Material Icons are self-hosted via public/fonts/material-icons.woff2
            and declared in globals.css — no external CDN request needed. */}
        {/* OpenDyslexic font — loaded when dyslexia-font class is active */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic-regular.min.css"
        />
      </head>
      <body className={inter.className}>
        {children}
        <AccessibilityToolbar userId={userId} />
      </body>
    </html>
  )
}
