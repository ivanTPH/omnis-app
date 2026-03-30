'use client'
import Link     from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut }     from 'next-auth/react'
import Icon from '@/components/ui/Icon'
import UnreadBadge from '@/components/messaging/UnreadBadge'
import NotificationUnreadBadge from '@/components/notifications/NotificationUnreadBadge'

type NavItem =
  | { label: string; href: string; icon: string }
  | { divider: true; label: string }

const navByRole: Record<string, NavItem[]> = {
  TEACHER: [
    { label: 'Calendar',             href: '/dashboard',          icon: 'calendar_today'  },
    { label: 'Homework',             href: '/homework',           icon: 'assignment'       },
    { label: 'Revision',             href: '/revision-program',   icon: 'bookmark'         },
    { label: 'Classes & Analytics',  href: '/analytics',          icon: 'groups'           },
    { label: 'Plans',                href: '/plans',              icon: 'folder'           },
    { label: 'Messages',             href: '/messages',           icon: 'chat'             },
    { label: 'Notifications',        href: '/notifications',      icon: 'notifications'    },
    { label: 'Adaptive Learning',    href: '/analytics/adaptive', icon: 'psychology'       },
    { label: 'AI Generator',         href: '/ai-generator',       icon: 'auto_fix_high'    },
  ],
  HEAD_OF_DEPT: [
    { label: 'Calendar',             href: '/dashboard',          icon: 'calendar_today'  },
    { label: 'Homework',             href: '/homework',           icon: 'assignment'       },
    { label: 'Revision',             href: '/revision-program',   icon: 'bookmark'         },
    { label: 'Classes & Analytics',  href: '/analytics',          icon: 'groups'           },
    { label: 'Adaptive Learning',    href: '/analytics/adaptive', icon: 'psychology'       },
    { label: 'AI Generator',         href: '/ai-generator',       icon: 'auto_fix_high'    },
    { label: 'Messages',             href: '/messages',           icon: 'chat'             },
    { label: 'Notifications',        href: '/notifications',      icon: 'notifications'    },
  ],
  HEAD_OF_YEAR: [
    { label: 'Calendar',             href: '/dashboard',          icon: 'calendar_today' },
    { label: 'Revision',             href: '/revision-program',   icon: 'bookmark'       },
    { label: 'Classes & Analytics',  href: '/analytics',          icon: 'groups'         },
    { label: 'AI Generator',         href: '/ai-generator',       icon: 'auto_fix_high'  },
    { label: 'Messages',             href: '/messages',           icon: 'chat'           },
    { label: 'Notifications',        href: '/notifications',      icon: 'notifications'  },
    { divider: true, label: 'Pastoral' },
    { label: 'Integrity',     href: '/hoy/integrity',      icon: 'warning'        },
    { label: 'SEND Concerns', href: '/senco/concerns',     icon: 'favorite'       },
    { label: 'Plans',         href: '/plans',              icon: 'folder'         },
  ],
  SENCO: [
    { label: 'SENCO Dashboard', href: '/senco/dashboard',    icon: 'dashboard'      },
    { label: 'Concerns',        href: '/senco/concerns',     icon: 'warning'        },
    { label: 'ILP Records',     href: '/senco/ilp',          icon: 'description'    },
    { label: 'EHCP Plans',      href: '/senco/ehcp',         icon: 'fact_check'     },
    { label: 'ILP Evidence',    href: '/senco/ilp-evidence', icon: 'bar_chart'      },
    { label: 'Early Warning',   href: '/senco/early-warning', icon: 'notifications' },
    { label: 'Resource Scorer', href: '/send-scorer',        icon: 'auto_awesome'   },
    { label: 'AI Generator',    href: '/ai-generator',       icon: 'auto_fix_high'  },
    { label: 'Analytics',       href: '/analytics',          icon: 'bar_chart'      },
    { label: 'Messages',        href: '/messages',           icon: 'chat'           },
  ],
  SCHOOL_ADMIN: [
    { label: 'Dashboard',      href: '/admin/dashboard',  icon: 'dashboard'       },
    { label: 'Revision',       href: '/revision-program', icon: 'bookmark'        },
    { label: 'Staff',          href: '/admin/staff',      icon: 'manage_accounts' },
    { label: 'Students',       href: '/admin/students',   icon: 'people'          },
    { label: 'Classes',        href: '/admin/classes',    icon: 'menu_book'       },
    { label: 'Timetable',      href: '/admin/timetable',  icon: 'schedule'        },
    { label: 'Calendar',       href: '/admin/calendar',   icon: 'calendar_today'  },
    { divider: true, label: 'Management' },
    { label: 'Analytics',      href: '/slt/analytics',    icon: 'bar_chart'       },
    { label: 'Audit Log',      href: '/admin/audit',      icon: 'security'        },
    { label: 'GDPR & Consent', href: '/admin/gdpr',       icon: 'verified_user'   },
    { label: 'AI Generator',   href: '/ai-generator',     icon: 'auto_fix_high'   },
    { label: 'Cover',          href: '/admin/cover',      icon: 'event_busy'      },
    { label: 'MIS Sync',       href: '/admin/wonde',      icon: 'sync'            },
    { label: 'Messages',       href: '/messages',         icon: 'chat'            },
  ],
  SLT: [
    { label: 'Dashboard',     href: '/dashboard',        icon: 'dashboard'     },
    { label: 'Revision',      href: '/revision-program', icon: 'bookmark'      },
    { label: 'Analytics',     href: '/slt/analytics',    icon: 'bar_chart'     },
    { label: 'Audit Log',     href: '/slt/audit',        icon: 'security'      },
    { label: 'AI Generator',  href: '/ai-generator',     icon: 'auto_fix_high' },
    { label: 'Cover',         href: '/admin/cover',      icon: 'event_busy'    },
    { label: 'Messages',      href: '/messages',         icon: 'chat'          },
    { label: 'Notifications', href: '/notifications',    icon: 'notifications' },
    { divider: true, label: 'Pastoral' },
    { label: 'Integrity',     href: '/hoy/integrity',    icon: 'warning'       },
    { label: 'Plans',         href: '/plans',            icon: 'folder'        },
  ],
  COVER_MANAGER: [
    { label: 'Dashboard',     href: '/dashboard',     icon: 'dashboard'    },
    { label: 'Cover',         href: '/admin/cover',   icon: 'event_busy'   },
    { label: 'Lessons',       href: '/lessons',       icon: 'menu_book'    },
    { label: 'Messages',      href: '/messages',      icon: 'chat'         },
    { label: 'Notifications', href: '/notifications', icon: 'notifications'},
  ],
  STUDENT: [
    { label: 'Dashboard',        href: '/student/dashboard', icon: 'dashboard'   },
    { label: 'Homework',         href: '/student/homework',  icon: 'assignment'  },
    { label: 'Revision',         href: '/student/revision',  icon: 'bookmark'    },
    { label: 'Revision Planner', href: '/revision',          icon: 'menu_book'   },
    { label: 'My Grades',        href: '/student/grades',    icon: 'school'      },
    { label: 'Messages',         href: '/messages',          icon: 'chat'        },
  ],
  PLATFORM_ADMIN: [
    { label: 'Dashboard', href: '/platform-admin/dashboard', icon: 'dashboard' },
    { label: 'Schools',   href: '/platform-admin/schools',   icon: 'business'  },
    { label: 'Oak Sync',  href: '/platform-admin/oak-sync',  icon: 'sync'      },
  ],
  PARENT: [
    { label: 'Dashboard',        href: '/parent/dashboard', icon: 'dashboard'      },
    { label: 'Progress',         href: '/parent/progress',  icon: 'bar_chart'      },
    { label: 'Messages',         href: '/parent/messages',  icon: 'chat'           },
    { label: 'Consent Settings', href: '/parent/consent',   icon: 'verified_user'  },
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
      <div className="px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-700 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">O</span>
          </div>
          <div className="min-w-0">
            <div className="font-bold text-gray-900 text-[14px] leading-tight">Omnis</div>
            <div className="text-[11px] text-gray-400 truncate">{schoolName}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-auto py-3 px-3">
        {nav.map((item, i) => {
          if ('divider' in item) {
            return (
              <div key={`d-${i}`} className="pt-4 pb-1 px-2">
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
              className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13px] font-medium transition-colors mb-0.5 ${
                active
                  ? 'bg-blue-50 text-blue-700'
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

      {/* Settings + Accessibility */}
      <div className="px-3 pb-1 shrink-0">
        <Link
          href="/settings"
          onClick={onClose}
          className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13px] font-medium transition-colors mb-0.5 ${
            pathname === '/settings' && !pathname.startsWith('/settings/accessibility')
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Icon name="settings" size="sm" className="shrink-0" />Settings
        </Link>
        <Link
          href="/settings/accessibility"
          onClick={onClose}
          className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13px] font-medium transition-colors mb-0.5 ${
            pathname === '/settings/accessibility'
              ? 'bg-blue-50 text-blue-700'
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
