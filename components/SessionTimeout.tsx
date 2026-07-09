'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { signOut } from 'next-auth/react'
import Icon from '@/components/ui/Icon'

const WARN_AFTER_MS  = 25 * 60 * 1000  // 25 minutes — show warning
const LOGOUT_AFTER_MS = 30 * 60 * 1000  // 30 minutes — force signout
const EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const

export default function SessionTimeout() {
  const [showWarning, setShowWarning] = useState(false)
  const [countdown,   setCountdown]   = useState(5 * 60) // seconds until forced logout
  const lastActivity = useRef<number>(0)
  const warnTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function clearTimers() {
    if (warnTimer.current)    clearTimeout(warnTimer.current)
    if (logoutTimer.current)  clearTimeout(logoutTimer.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }

  const scheduleTimers = useCallback(() => {
    clearTimers()
    setShowWarning(false)

    warnTimer.current = setTimeout(() => {
      setShowWarning(true)
      setCountdown(5 * 60)
      // Tick the countdown
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }, WARN_AFTER_MS)

    logoutTimer.current = setTimeout(() => {
      signOut({ callbackUrl: '/login?reason=timeout' })
    }, LOGOUT_AFTER_MS)
  }, [])

  const handleActivity = useCallback(() => {
    const now = Date.now()
    // Debounce: only reschedule if more than 30s since last reset
    if (now - lastActivity.current > 30_000) {
      lastActivity.current = now
      scheduleTimers()
    }
  }, [scheduleTimers])

  useEffect(() => {
    lastActivity.current = Date.now()
    scheduleTimers()
    for (const event of EVENTS) window.addEventListener(event, handleActivity, { passive: true })
    return () => {
      clearTimers()
      for (const event of EVENTS) window.removeEventListener(event, handleActivity)
    }
  }, [scheduleTimers, handleActivity])

  if (!showWarning) return null

  const mins = Math.floor(countdown / 60)
  const secs = String(countdown % 60).padStart(2, '0')

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <Icon name="timer" size="md" className="text-amber-600" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 text-lg">Session Expiring Soon</h2>
          <p className="text-sm text-gray-500 mt-1">
            For data security, your session will end in
          </p>
          <p className="text-3xl font-mono font-semibold text-amber-600 mt-2">
            {mins}:{secs}
          </p>
        </div>
        <p className="text-xs text-gray-400">
          Move your mouse or press any key to stay logged in.
        </p>
        <button
          onClick={() => {
            lastActivity.current = Date.now()
            scheduleTimers()
          }}
          className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          Stay Logged In
        </button>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full py-2 text-sm text-gray-400 hover:text-gray-600"
        >
          Log out now
        </button>
      </div>
    </div>
  )
}
