'use client'
import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import OmnisLogo from '@/components/ui/OmnisLogo'
import Sidebar from '@/components/Sidebar'
import { getTeacherDefaults } from '@/app/actions/analytics'
import { useInitialNotificationCount } from '@/lib/initialNotificationCountContext'
import { getUnreadNotificationCount } from '@/app/actions/messaging'
import { TeacherProfileContext, EMPTY_PROFILE, type TeacherProfile } from '@/lib/teacherProfileContext'
import { MobileMenuContext } from '@/lib/mobileMenuContext'
import { NotificationCountContext } from '@/lib/notificationCountContext'
import { ToastContainer } from '@/components/ui/Toast'
import GuideChatButton from '@/components/help/GuideChatButton'
import OnboardingChecklist from '@/components/help/OnboardingChecklist'
import GlobalSearch from '@/components/GlobalSearch'
import NotificationUnreadBadge from '@/components/notifications/NotificationUnreadBadge'
import Link from 'next/link'

/** Roles that have assigned classes and benefit from teacher-profile defaults */
const STAFF_ROLES = new Set(['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN'])

export default function AppShell({
  role, firstName, lastName, schoolName, children,
}: {
  role:       string
  firstName:  string
  lastName:   string
  schoolName: string
  children:   React.ReactNode
}) {
  const contextNotificationCount = useInitialNotificationCount()
  const [open,              setOpen]              = useState(false)
  const [teacherProfile,    setTeacherProfile]    = useState<TeacherProfile>(EMPTY_PROFILE)
  const [notificationCount, setNotificationCount] = useState(contextNotificationCount)

  // Sync when context updates — e.g. after router.refresh() following mark-as-read
  useEffect(() => { setNotificationCount(contextNotificationCount) }, [contextNotificationCount])

  // Notification poll — initial value comes from server via context, so skip
  // the immediate call and only poll at 60s intervals for subsequent updates.
  useEffect(() => {
    function loadNotifications() {
      getUnreadNotificationCount().then(setNotificationCount).catch(() => {})
    }
    const id = setInterval(loadNotifications, 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    // Fetch teacher defaults for staff roles only
    if (!STAFF_ROLES.has(role)) return
    getTeacherDefaults()
      .then(defaults => {
        const classes = defaults.teacherClasses

        // Compute unique subjects + year groups from assigned classes
        const subjectCounts = new Map<string, number>()
        const yearGroups    = new Set<number>()
        for (const c of classes) {
          subjectCounts.set(c.subject, (subjectCounts.get(c.subject) ?? 0) + 1)
          yearGroups.add(c.yearGroup)
        }

        // Primary subject = most frequently assigned; fall back to first class's subject
        const primarySubject = classes.length === 0 ? '' :
          [...subjectCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]

        const sortedSubjects   = [...subjectCounts.keys()].sort()
        const sortedYearGroups = [...yearGroups].sort((a, b) => a - b)

        // Default year group = the one that matches the primary subject first,
        // then overall lowest year group
        const primaryClassesForSubject = classes.filter(c => c.subject === primarySubject)
        const defaultYearGroup = primaryClassesForSubject.length > 0
          ? Math.min(...primaryClassesForSubject.map(c => c.yearGroup))
          : sortedYearGroups[0] ?? null

        setTeacherProfile({
          teacherClasses:    classes,
          teacherSubjects:   sortedSubjects,
          teacherYearGroups: sortedYearGroups,
          defaultSubject:    primarySubject,
          defaultYearGroup:  defaultYearGroup ?? null,
          isLoaded:          true,
        })
      })
      .catch(() => {
        // If fetch fails, mark as loaded so consumers don't keep waiting
        setTeacherProfile({ ...EMPTY_PROFILE, isLoaded: true })
      })
  }, [role]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MobileMenuContext.Provider value={{ openMenu: () => setOpen(true) }}>
    <NotificationCountContext.Provider value={notificationCount}>
    <TeacherProfileContext.Provider value={teacherProfile}>
      <div className="flex h-dvh overflow-hidden bg-white">

        {/* Desktop sidebar — always in flow on md+ (768px+) */}
        <div className="hidden md:flex shrink-0">
          <Sidebar role={role} firstName={firstName} lastName={lastName} schoolName={schoolName} />
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
                onClose={() => setOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Mobile top bar with hamburger — hidden on md+ and for student/parent (they have in-page nav) */}
          {(
            <div className="flex items-center gap-3 px-4 h-12 border-b border-gray-200 bg-white shrink-0 md:hidden">
              <button
                onClick={() => setOpen(true)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                aria-label="Open menu"
              >
                <Icon name="menu" size="md" />
              </button>
              <OmnisLogo variant="sidebar" />
              <div className="flex-1" />
              <Link href="/notifications" className="relative p-1.5 text-gray-400 hover:text-gray-600">
                <Icon name="notifications" size="md" />
                <span className="absolute top-0.5 right-0.5">
                  <NotificationUnreadBadge />
                </span>
              </Link>
            </div>
          )}

          {/* Page content */}
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
            {children}
          </div>

        </div>
      </div>
      <ToastContainer />
      <GuideChatButton />
      <OnboardingChecklist role={role} />
      {!['STUDENT', 'PARENT', 'TEACHING_ASSISTANT'].includes(role) && <GlobalSearch />}
    </TeacherProfileContext.Provider>
    </NotificationCountContext.Provider>
    </MobileMenuContext.Provider>
  )
}
