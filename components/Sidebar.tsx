'use client'
import Link     from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut }     from 'next-auth/react'
import Icon from '@/components/ui/Icon'
import OmnisLogo from '@/components/ui/OmnisLogo'
import UnreadBadge from '@/components/messaging/UnreadBadge'
import NotificationUnreadBadge from '@/components/notifications/NotificationUnreadBadge'
import StudentSearch from '@/components/StudentSearch'

const STAFF_ROLES = new Set(['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SENCO','SLT','SCHOOL_ADMIN','COVER_MANAGER','TEACHING_ASSISTANT'])

type NavItem =
  | { label: string; href: string; icon: string }
  | { divider: true; label: string }

const navByRole: Record<string, NavItem[]> = {
  TEACHER: [
    { label: 'Dashboard',         href: '/dashboard',          icon: 'dashboard'      },
    { divider: true, label: 'Teaching' },
    { label: 'Calendar',          href: '/calendar',           icon: 'calendar_today' },
    { label: 'My Timetable',      href: '/timetable',          icon: 'event_note'     },
    { label: 'Homework',          href: '/homework',           icon: 'assignment'     },
    { label: 'My Classes',        href: '/classes',            icon: 'groups'         },
    { label: 'My SEND Students', href: '/send-caseload',      icon: 'support'        },
    { label: 'Year Group Plans',  href: '/plans/year-group',   icon: 'folder_special' },
    { divider: true, label: 'Learning' },
    { label: 'Revision',          href: '/revision-program',   icon: 'menu_book'      },
    { label: 'Adaptive Learning', href: '/analytics/adaptive', icon: 'psychology'     },
    { label: 'Resource Library',  href: '/resources',          icon: 'folder_open'    },
    { label: 'AI Generator',      href: '/ai-generator',       icon: 'auto_awesome'   },
    { divider: true, label: 'Communication' },
    { label: 'Messages',          href: '/messages',           icon: 'chat'           },
    { label: 'Notifications',     href: '/notifications',      icon: 'notifications'  },
  ],
  HEAD_OF_DEPT: [
    { label: 'Dashboard',            href: '/hod/dashboard',          icon: 'dashboard'       },
    { divider: true, label: 'Department' },
    { label: 'Staff Overview',       href: '/hod/staff',              icon: 'people'          },
    { label: 'Curriculum Map',       href: '/hod/curriculum',         icon: 'map'             },
    { label: 'Classes & Analytics',  href: '/analytics',              icon: 'groups'          },
    { label: 'Teacher Analytics',    href: '/analytics/teacher',      icon: 'person_search'   },
    { label: 'Dept Analytics',       href: '/analytics/department',   icon: 'domain'          },
    { label: 'Performance',          href: '/hod/performance',        icon: 'bar_chart'       },
    { label: 'Subjects & Boards',    href: '/admin/subjects',         icon: 'school'          },
    { divider: true, label: 'Teaching' },
    { label: 'Calendar',             href: '/calendar',               icon: 'calendar_today'  },
    { label: 'My Timetable',         href: '/timetable',              icon: 'event_note'      },
    { label: 'Homework',             href: '/homework',               icon: 'assignment'      },
    { label: 'Revision',             href: '/revision-program',       icon: 'bookmark'        },
    { label: 'Year Group Plans',     href: '/plans/year-group',       icon: 'menu_book'       },
    { label: 'Adaptive Learning',    href: '/analytics/adaptive',     icon: 'psychology'      },
    { label: 'AI Generator',         href: '/ai-generator',           icon: 'auto_fix_high'   },
    { divider: true, label: 'SEND' },
    { label: 'SEND Concerns',        href: '/senco/concerns',         icon: 'favorite'        },
    { label: 'Early Warning',        href: '/senco/early-warning',    icon: 'warning'         },
    { divider: true, label: 'Communication' },
    { label: 'Messages',             href: '/messages',               icon: 'chat'            },
    { label: 'Notifications',        href: '/notifications',          icon: 'notifications'   },
  ],
  HEAD_OF_YEAR: [
    { label: 'Dashboard',            href: '/hoy/dashboard',      icon: 'dashboard'      },
    { divider: true, label: 'Teaching' },
    { label: 'Calendar',             href: '/calendar',           icon: 'calendar_today' },
    { label: 'My Timetable',         href: '/timetable',          icon: 'event_note'     },
    { label: 'Homework',             href: '/homework',           icon: 'assignment'     },
    { label: 'Classes & Analytics',  href: '/analytics',          icon: 'groups'         },
    { label: 'Year Group Plans',     href: '/plans/year-group',   icon: 'menu_book'      },
    { label: 'Year Analytics',       href: '/hoy/analytics',      icon: 'bar_chart'      },
    { divider: true, label: 'Pastoral' },
    { label: 'Welfare',              href: '/hoy/welfare',        icon: 'favorite'       },
    { label: 'Absence Hub',          href: '/hoy/absence',        icon: 'event_busy'     },
    { label: 'Behaviour',            href: '/hoy/behaviour',      icon: 'emoji_events'   },
    { label: 'Detentions',           href: '/hoy/detentions',     icon: 'timer'          },
    { label: 'Exclusions',           href: '/hoy/exclusions',     icon: 'block'          },
    { label: 'Safeguarding',         href: '/hoy/safeguarding',   icon: 'shield'         },
    { label: 'Integrity',            href: '/hoy/integrity',      icon: 'verified_user'  },
    { label: 'SEND Concerns',        href: '/senco/concerns',     icon: 'report_problem' },
    { label: 'ILP Records',          href: '/senco/ilp',          icon: 'description'    },
    { divider: true, label: 'Tools' },
    { label: 'Revision',             href: '/revision-program',   icon: 'bookmark'       },
    { label: 'AI Generator',         href: '/ai-generator',       icon: 'auto_fix_high'  },
    { label: 'Subjects & Boards',    href: '/admin/subjects',     icon: 'school'         },
    { label: 'Messages',             href: '/messages',           icon: 'chat'           },
    { label: 'Notifications',        href: '/notifications',      icon: 'notifications'  },
  ],
  SENCO: [
    { label: 'SENCO Dashboard', href: '/senco/dashboard',       icon: 'dashboard'      },
    { label: 'Concerns',        href: '/senco/concerns',        icon: 'warning'        },
    { label: 'ILP Records',     href: '/senco/ilp',             icon: 'description'    },
    { label: 'APDR Cycles',     href: '/senco/apdr',            icon: 'loop'           },
    { label: 'EHCP Plans',      href: '/senco/ehcp',            icon: 'fact_check'     },
    { label: 'ILP Evidence',    href: '/senco/ilp-evidence',    icon: 'bar_chart'      },
    { label: 'Early Warning',   href: '/senco/early-warning',   icon: 'notifications'  },
    { label: 'AI Insights',     href: '/senco/agent-insights',  icon: 'psychology'     },
    { label: 'Interventions',   href: '/senco/interventions',   icon: 'people_alt'     },
    { label: 'Year Group Plans', href: '/plans/year-group',     icon: 'menu_book'      },
    { label: 'Resource Scorer', href: '/send-scorer',           icon: 'auto_awesome'   },
    { label: 'AI Generator',    href: '/ai-generator',          icon: 'auto_fix_high'  },
    { label: 'Analytics',       href: '/analytics',             icon: 'analytics'      },
    { label: 'Messages',        href: '/messages',              icon: 'chat'           },
  ],
  SCHOOL_ADMIN: [
    { label: 'Dashboard',        href: '/admin/dashboard',  icon: 'dashboard'        },
    { label: 'Subjects & Boards', href: '/admin/subjects',  icon: 'school'           },
    { label: 'Revision',         href: '/revision-program', icon: 'bookmark'        },
    { label: 'Year Group Plans', href: '/plans/year-group', icon: 'menu_book'       },
    { label: 'All Users',        href: '/admin/users',      icon: 'supervisor_account' },
    { label: 'Staff',            href: '/admin/staff',      icon: 'manage_accounts' },
    { label: 'Students',         href: '/admin/students',   icon: 'people'          },
    { label: 'Subject Options',  href: '/admin/options',    icon: 'menu_book'       },
    { label: 'Classes',          href: '/admin/classes',    icon: 'school'          },
    { label: 'Timetable',        href: '/admin/timetable',  icon: 'schedule'        },
    { label: 'Calendar',         href: '/admin/calendar',   icon: 'calendar_today'  },
    { divider: true, label: 'Management' },
    { label: 'SEND Overview',         href: '/admin/send-overview',       icon: 'favorite'           },
    { label: 'Parent Engagement',     href: '/admin/parent-engagement',   icon: 'supervisor_account' },
    { label: 'Analytics',        href: '/slt/analytics',    icon: 'bar_chart'       },
    { label: 'Attendance',       href: '/admin/attendance', icon: 'directions_run'  },
    { label: 'Behaviour',        href: '/hoy/behaviour',    icon: 'emoji_events'    },
    { label: 'Detentions',       href: '/hoy/detentions',   icon: 'timer'           },
    { label: 'Exclusions',       href: '/hoy/exclusions',   icon: 'block'           },
    { label: 'Safeguarding',     href: '/hoy/safeguarding', icon: 'shield'          },
    { label: 'Communications',   href: '/admin/communications', icon: 'campaign'    },
    { label: 'Audit Log',        href: '/admin/audit',      icon: 'security'        },
    { label: 'GDPR & Consent',   href: '/admin/gdpr',       icon: 'verified_user'   },
    { label: 'AI Generator',     href: '/ai-generator',     icon: 'auto_fix_high'   },
    { label: 'Cover',            href: '/admin/cover',      icon: 'event_busy'      },
    { label: 'MIS Sync',          href: '/admin/wonde',     icon: 'sync'               },
    { label: 'Messages',          href: '/messages',        icon: 'chat'               },
    { label: 'Parent Messages',   href: '/admin/messages',  icon: 'supervisor_account' },
  ],
  SLT: [
    { label: 'Dashboard',          href: '/dashboard',        icon: 'dashboard'     },
    { label: 'Revision',           href: '/revision-program', icon: 'bookmark'      },
    { label: 'Year Group Plans',   href: '/plans/year-group', icon: 'menu_book'     },
    { label: 'Analytics',          href: '/slt/analytics',          icon: 'bar_chart'     },
    { label: 'Teacher Analytics',  href: '/analytics/teacher',      icon: 'person_search' },
    { label: 'Dept Analytics',     href: '/analytics/department',   icon: 'domain'        },
    { label: 'Attendance',         href: '/admin/attendance',       icon: 'directions_run'},
    { label: 'SEND Reporting',     href: '/slt/send',               icon: 'favorite'      },
    { label: 'Population',         href: '/slt/population',   icon: 'group'         },
    { label: 'Audit Log',          href: '/slt/audit',        icon: 'security'      },
    { label: 'AI Generator',       href: '/ai-generator',     icon: 'auto_fix_high' },
    { label: 'Subjects & Boards',  href: '/admin/subjects',   icon: 'school'        },
    { label: 'Cover',              href: '/admin/cover',      icon: 'event_busy'    },
    { label: 'Messages',         href: '/messages',         icon: 'chat'          },
    { label: 'Parent Messages',  href: '/admin/messages',   icon: 'supervisor_account' },
    { label: 'Notifications',    href: '/notifications',    icon: 'notifications' },
    { divider: true, label: 'Pastoral' },
    { label: 'Integrity',        href: '/hoy/integrity',    icon: 'warning'       },
    { label: 'Detentions',       href: '/hoy/detentions',   icon: 'timer'         },
    { label: 'Exclusions',       href: '/hoy/exclusions',   icon: 'block'         },
    { label: 'Safeguarding',     href: '/hoy/safeguarding', icon: 'shield'        },
    { label: 'Communications',   href: '/admin/communications', icon: 'campaign'  },
    { label: 'Plans',            href: '/plans',            icon: 'folder'        },
  ],
  COVER_MANAGER: [
    { label: 'Dashboard',     href: '/dashboard',     icon: 'dashboard'    },
    { label: 'Cover',         href: '/admin/cover',   icon: 'event_busy'   },
    { label: 'Lessons',       href: '/lessons',       icon: 'menu_book'    },
    { label: 'Messages',      href: '/messages',      icon: 'chat'         },
    { label: 'Notifications', href: '/notifications', icon: 'notifications'},
  ],
  STUDENT: [
    { label: 'Dashboard',        href: '/student/dashboard',  icon: 'dashboard'      },
    { label: 'My Timetable',     href: '/student/timetable',  icon: 'calendar_today' },
    { label: 'Homework',         href: '/student/homework',   icon: 'assignment'     },
    { label: 'Revision Planner', href: '/student/revision',   icon: 'menu_book'      },
    { label: 'My Grades',        href: '/student/grades',     icon: 'school'         },
    { label: 'My Support',       href: '/student/support',    icon: 'support'        },
    { label: 'Messages',         href: '/messages',           icon: 'chat'           },
  ],
  PLATFORM_ADMIN: [
    { label: 'Dashboard',        href: '/platform-admin/dashboard', icon: 'dashboard'      },
    { label: 'Academy Overview', href: '/academy/dashboard',        icon: 'account_balance' },
    { label: 'Schools',          href: '/platform-admin/schools',   icon: 'business'       },
    { label: 'Oak Sync',         href: '/platform-admin/oak-sync',  icon: 'sync'           },
  ],
  ACADEMY_ADMIN: [
    { label: 'Academy Dashboard', href: '/academy/dashboard', icon: 'account_balance' },
    { label: 'Schools',           href: '/academy/schools',   icon: 'business'        },
    { label: 'SEND Overview',     href: '/academy/send',      icon: 'favorite'        },
    { label: 'Reports',           href: '/academy/reports',   icon: 'summarize'       },
  ],
  PARENT: [
    { label: 'Dashboard',        href: '/parent/dashboard',  icon: 'dashboard'      },
    { label: 'Progress',         href: '/parent/progress',   icon: 'bar_chart'      },
    { label: 'Reports',          href: '/parent/report',     icon: 'picture_as_pdf' },
    { label: 'Behaviour',        href: '/parent/behaviour',  icon: 'emoji_events'   },
    { label: 'Letters Home',     href: '/parent/communications', icon: 'campaign'   },
    { label: 'Messages',         href: '/parent/messages',   icon: 'chat'           },
    { label: 'Consent Settings', href: '/parent/consent',    icon: 'verified_user'  },
  ],
  TEACHING_ASSISTANT: [
    { label: 'Student Notes', href: '/ta/notes',       icon: 'add_comment'    },
    { label: 'Messages',      href: '/messages',       icon: 'chat'           },
    { label: 'Notifications', href: '/notifications',  icon: 'notifications'  },
  ],
}

export default function Sidebar({ role, firstName, lastName, schoolName, onClose, avatarUrl }: {
  role:        string
  firstName:   string
  lastName:    string
  schoolName:  string
  onClose?:    () => void
  avatarUrl?:  string | null
}) {
  const pathname = usePathname()
  const nav = navByRole[role] ?? navByRole['TEACHER']

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col h-dvh shrink-0">

      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100 shrink-0">
        <OmnisLogo variant="sidebar" />
        {schoolName && (
          <div className="text-[10px] text-gray-400 truncate mt-0.5 pl-[52px]">{schoolName}</div>
        )}
      </div>

      {/* Student search — staff roles only */}
      {STAFF_ROLES.has(role) && (
        <div className="px-3 pt-2 pb-1 shrink-0 border-b border-gray-100">
          <StudentSearch role={role} />
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-auto py-2 px-2">
        {nav.map((item, i) => {
          if ('divider' in item) {
            return (
              <div key={`d-${i}`} className="pt-3 pb-1 px-2">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{item.label}</span>
              </div>
            )
          }
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors mb-0.5 ${
                active
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon name={item.icon} size="sm" className="shrink-0" />
              {item.label}
              {item.href === '/messages'      && <UnreadBadge />}
              {item.href === '/notifications' && <NotificationUnreadBadge />}
            </Link>
          )
        })}
      </nav>

      {/* Help + Settings */}
      <div className="px-2 pb-1 shrink-0 border-t border-gray-100 pt-2">
        <Link
          href="/help"
          onClick={onClose}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors mb-0.5 ${
            pathname === '/help'
              ? 'bg-blue-700 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Icon name="help_outline" size="sm" className="shrink-0" />Help Centre
        </Link>
        <Link
          href="/settings"
          onClick={onClose}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors mb-0.5 ${
            pathname.startsWith('/settings') && !pathname.startsWith('/settings/accessibility')
              ? 'bg-blue-700 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Icon name="settings" size="sm" className="shrink-0" />Settings
        </Link>
        <Link
          href="/settings/accessibility"
          onClick={onClose}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors mb-0.5 ${
            pathname === '/settings/accessibility'
              ? 'bg-blue-700 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Icon name="accessibility" size="sm" className="shrink-0" />Accessibility
        </Link>
      </div>

      {/* User chip + sign out */}
      <div className="px-4 py-4 border-t border-gray-100 shrink-0">
        <Link href="/settings" className="flex items-center gap-2.5 mb-3 hover:opacity-80 transition-opacity">
          {avatarUrl ? (
            <img src={avatarUrl} alt={`${firstName} ${lastName}`} className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-blue-700 font-semibold text-xs">{firstName[0]}{lastName[0]}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-gray-900 truncate">{firstName} {lastName}</div>
            <div className="text-[11px] text-gray-400">{role.replace(/_/g, ' ')}</div>
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 text-[12px] text-gray-400 hover:text-red-500 transition-colors"
        >
          <Icon name="logout" size="sm" />Sign out
        </button>
      </div>
    </aside>
  )
}
