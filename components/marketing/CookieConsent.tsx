'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const COOKIE_KEY = 'omnis-cookie-consent'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(COOKIE_KEY)) {
      setVisible(true)
    }
  }, [])

  function accept() {
    localStorage.setItem(COOKIE_KEY, 'accepted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(COOKIE_KEY, 'essential')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 shadow-lg"
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-gray-600 flex-1">
          We use essential cookies to keep you signed in and protect your session. We don&apos;t use
          advertising or tracking cookies.{' '}
          <Link href="/marketing/privacy#10-cookies" className="text-blue-600 hover:underline">
            Cookie policy
          </Link>
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={decline}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded border border-gray-200 hover:border-gray-300 transition-colors"
          >
            Essential only
          </button>
          <button
            onClick={accept}
            className="text-sm font-medium bg-blue-700 hover:bg-blue-800 text-white px-4 py-1.5 rounded transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
