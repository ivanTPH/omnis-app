'use client'
import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { getMyAvatarUrl } from '@/app/actions/settings'

export default function AppShell({
  role, firstName, lastName, schoolName, children,
}: {
  role:       string
  firstName:  string
  lastName:   string
  schoolName: string
  children:   React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    getMyAvatarUrl().then(url => setAvatarUrl(url ?? null)).catch(() => {})
  }, [])

  return (
    <div className="flex h-dvh overflow-hidden bg-white">

      {/* Desktop sidebar — always in flow on md+ (768px+) */}
      <div className="hidden md:flex shrink-0">
        <Sidebar role={role} firstName={firstName} lastName={lastName} schoolName={schoolName} avatarUrl={avatarUrl} />
      </div>

      {/* Mobile drawer — rendered as overlay when open (below md) */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          {/* Drawer */}
          <div className="absolute inset-y-0 left-0 z-10">
            <Sidebar
              role={role}
              firstName={firstName}
              lastName={lastName}
              schoolName={schoolName}
              avatarUrl={avatarUrl}
              onClose={() => setOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Mobile top bar with hamburger — hidden on md+ */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-gray-200 bg-white shrink-0 md:hidden">
          <button
            onClick={() => setOpen(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">O</span>
            </div>
            <span className="font-semibold text-gray-900 text-sm">Omnis</span>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {children}
        </div>

      </div>
    </div>
  )
}
