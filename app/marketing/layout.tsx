import type { Metadata } from 'next'
import Link from 'next/link'
import OmnisLogo from '@/components/ui/OmnisLogo'
import CookieConsent from '@/components/marketing/CookieConsent'

export const metadata: Metadata = {
  title: {
    template: '%s | Omnis Education',
    default:  'Omnis Education — AI Learning & SEND Platform for UK Schools',
  },
  description: 'AI-powered learning and SEND management platform for UK secondary schools. Lesson planning, adaptive homework, ILP/EHCP tracking, and MIS sync in one place.',
  openGraph: {
    siteName: 'Omnis Education',
    type:     'website',
    locale:   'en_GB',
  },
  twitter: {
    card:    'summary_large_image',
    site:    '@OmnisEducation',
    creator: '@OmnisEducation',
  },
  alternates: {
    canonical: 'https://omnis.education/marketing/home',
  },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Sticky nav */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <Link href="/marketing/home">
            <OmnisLogo variant="sidebar" />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link href="/marketing/home" className="hover:text-gray-900 transition-colors">Home</Link>
            <Link href="/marketing/features" className="hover:text-gray-900 transition-colors">Features</Link>
            <Link href="/marketing/beta" className="hover:text-gray-900 transition-colors">Request Beta</Link>
            <Link href="/marketing/investors" className="hover:text-gray-900 transition-colors">Investors</Link>
          </nav>
          <Link href="/login" className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Sign in
          </Link>
        </div>
      </header>

      {children}

      <CookieConsent />

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-24">
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <OmnisLogo variant="sidebar" />
            <span className="text-sm text-gray-500 ml-1">Learning &amp; SEND Intelligence Platform</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/marketing/features" className="hover:text-gray-900 transition-colors">Features</Link>
            <Link href="/marketing/beta" className="hover:text-gray-900 transition-colors">Beta access</Link>
            <Link href="/marketing/investors" className="hover:text-gray-900 transition-colors">Investors</Link>
            <Link href="/marketing/privacy" className="hover:text-gray-900 transition-colors">Privacy</Link>
            <Link href="/marketing/terms" className="hover:text-gray-900 transition-colors">Terms</Link>
            <Link href="/login" className="hover:text-gray-900 transition-colors">Sign in</Link>
          </nav>
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} Omnis Education Ltd.</p>
        </div>
      </footer>
    </div>
  )
}
