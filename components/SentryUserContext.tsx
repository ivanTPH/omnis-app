'use client'
/**
 * Sets Sentry user context for the authenticated session.
 * Renders nothing — side-effect only.
 * Mounted in AppShell so every authenticated page is covered.
 * We send role + schoolId but NOT email/name (minimise PII in error reports).
 */
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

interface Props {
  id:         string
  role:       string
  schoolId:   string
  schoolName: string
}

export default function SentryUserContext({ id, role, schoolId, schoolName }: Props) {
  useEffect(() => {
    Sentry.setUser({ id, role, schoolId, schoolName })
    return () => { Sentry.setUser(null) }
  }, [id, role, schoolId, schoolName])

  return null
}
