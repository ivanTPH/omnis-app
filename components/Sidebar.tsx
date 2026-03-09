'use client'
import Link     from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut }     from 'next-auth/react'
import {
  Calendar, BookOpen, ClipboardList, Users, Folder,
  MessageSquare, Bell, BarChart2, Shield, LogOut, GraduationCap,
  Heart, FileText, AlertTriangle, LayoutDashboard, Settings,
  UserCheck, Clock, Sparkles, ShieldCheck, Building2, Wand2, CalendarX2, RefreshCw,
  Accessibility,
} from 'lucide-react'

type NavItem =
  | { label: string; href: string; icon: React.ElementType }
  | { divider: true; label: string }

const navByRole: Record<string, NavItem[]> = {
  TEACHER: [
    { label: 'Calendar',          href: '/dashboard',              icon: Calendar       },
    { label: 'Homework',          href: '/homework',               icon: ClipboardList  },
    { label: 'Classes',           href: '/classes',                icon: Users          },
    { label: 'Plans',             href: '/plans',                  icon: Folder         },
    { label: 'Messages',          href: '/messages',               icon: MessageSquare  },
    { label: 'Notifications',     href: '/notifications',          icon: Bell           },
    { label: 'Analytics',         href: '/analytics/teacher',      icon: BarChart2      },
    { label: 'Student Analytics', href: '/analytics/students',     icon: BarChart2      },
    { label: 'AI Generator',      href: '/ai-generator',           icon: Wand2          },
  ],
  HEAD_OF_DEPT: [
    { label: 'Calendar',          href: '/dashboard',              icon: Calendar       },
    { label: 'Homework',          href: '/homework',               icon: ClipboardList  },
    { label: 'Classes',           href: '/classes',                icon: Users          },
    { label: 'Analytics',         href: '/analytics/department',   icon: BarChart2      },
    { label: 'Student Analytics', href: '/analytics/students',     icon: BarChart2      },
    { label: 'AI Generator',      href: '/ai-generator',           icon: Wand2          },
    { label: 'Messages',          href: '/messages',               icon: MessageSquare  },
    { label: 'Notifications',     href: '/notifications',          icon: Bell           },
  ],
  HEAD_OF_YEAR: [
    { label: 'Calendar',          href: '/dashboard',              icon: Calendar       },
    { label: 'Analytics',         href: '/hoy/analytics',          icon: BarChart2      },
    { label: 'Student Analytics', href: '/analytics/students',     icon: BarChart2      },
    { label: 'AI Generator',      href: '/ai-generator',           icon: Wand2          },
    { label: 'Messages',          href: '/messages',               icon: MessageSquare  },
    { label: 'Notifications',     href: '/notifications',          icon: Bell           },
    { divider: true, label: 'Pastoral' },
    { label: 'Integrity',         href: '/hoy/integrity',          icon: AlertTriangle  },
    { label: 'Plans',             href: '/plans',                  icon: Folder         },
  ],
  SENCO: [
    { label: 'SEND Dashboard',    href: '/send/dashboard',         icon: Heart          },
    { label: 'ILP Records',       href: '/send/ilp',               icon: FileText       },
    { label: 'Review Due',        href: '/send/review-due',        icon: ClipboardList  },
    { label: 'Resource Scorer',   href: '/send-scorer',            icon: Sparkles       },
    { label: 'AI Generator',      href: '/ai-generator',           icon: Wand2          },
    { label: 'Student Analytics', href: '/analytics/students',     icon: BarChart2      },
    { label: 'Messages',          href: '/messages',               icon: MessageSquare  },
    { label: 'Notifications',     href: '/notifications',          icon: Bell           },
  ],
  SCHOOL_ADMIN: [
    { label: 'Dashboard',   href: '/admin/dashboard',  icon: LayoutDashboard },
    { label: 'Staff',       href: '/admin/staff',      icon: UserCheck       },
    { label: 'Students',    href: '/admin/students',   icon: Users           },
    { label: 'Classes',     href: '/admin/classes',    icon: BookOpen        },
    { label: 'Timetable',   href: '/admin/timetable',  icon: Clock           },
    { label: 'Calendar',    href: '/admin/calendar',   icon: Calendar        },
    { divider: true, label: 'Management' },
    { label: 'Analytics',   href: '/slt/analytics',    icon: BarChart2       },
    { label: 'Audit Log',   href: '/admin/audit',      icon: Shield          },
    { label: 'GDPR & Consent', href: '/admin/gdpr',   icon: ShieldCheck     },
    { label: 'AI Generator', href: '/ai-generator',   icon: Wand2           },
    { label: 'Cover',        href: '/admin/cover',    icon: CalendarX2      },
    { label: 'Messages',    href: '/messages',         icon: MessageSquare   },
  ],
  SLT: [
    { label: 'Dashboard',     href: '/dashboard',            icon: LayoutDashboard },
    { label: 'Analytics',     href: '/slt/analytics',        icon: BarChart2       },
    { label: 'Audit Log',     href: '/slt/audit',            icon: Shield          },
    { label: 'AI Generator', href: '/ai-generator',         icon: Wand2           },
    { label: 'Cover',        href: '/admin/cover',          icon: CalendarX2      },
    { label: 'Messages',      href: '/messages',             icon: MessageSquare   },
    { label: 'Notifications', href: '/notifications',        icon: Bell            },
    { divider: true, label: 'Pastoral' },
    { label: 'Integrity',     href: '/hoy/integrity',        icon: AlertTriangle   },
    { label: 'Plans',         href: '/plans',                icon: Folder          },
  ],
  COVER_MANAGER: [
    { label: 'Dashboard',     href: '/dashboard',            icon: LayoutDashboard },
    { label: 'Cover',         href: '/admin/cover',          icon: CalendarX2      },
    { label: 'Lessons',       href: '/lessons',              icon: BookOpen        },
    { label: 'Messages',      href: '/messages',             icon: MessageSquare   },
    { label: 'Notifications', href: '/notifications',        icon: Bell            },
  ],
  STUDENT: [
    { label: 'Dashboard',         href: '/student/dashboard',    icon: LayoutDashboard },
    { label: 'Homework',          href: '/student/homework',     icon: ClipboardList   },
    { label: 'Revision Planner',  href: '/revision',             icon: BookOpen        },
    { label: 'My Grades',         href: '/student/grades',       icon: GraduationCap   },
    { label: 'Messages',          href: '/messages',             icon: MessageSquare   },
  ],
  PLATFORM_ADMIN: [
    { label: 'Dashboard', href: '/platform-admin/dashboard', icon: LayoutDashboard },
    { label: 'Schools',   href: '/platform-admin/schools',   icon: Building2       },
    { label: 'Oak Sync',  href: '/platform-admin/oak-sync',  icon: RefreshCw       },
  ],
  PARENT: [
    { label: 'Dashboard',       href: '/parent/dashboard', icon: LayoutDashboard },
    { label: 'Progress',        href: '/parent/progress',  icon: BarChart2       },
    { label: 'Messages',        href: '/parent/messages',  icon: MessageSquare   },
    { label: 'Consent Settings', href: '/parent/consent', icon: ShieldCheck     },
  ],
}

export default function Sidebar({ role, firstName, lastName, schoolName, onClose }: {
  role:        string
  firstName:   string
  lastName:    string
  schoolName:  string
  onClose?:    () => void
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
          const Icon   = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors mb-0.5 ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon size={15} className="shrink-0" />{item.label}
            </Link>
          )
        })}
      </nav>

      {/* Settings + User */}
      <div className="px-3 pb-1 shrink-0">
        <Link
          href="/settings"
          onClick={onClose}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors mb-0.5 ${
            pathname === '/settings' && !pathname.startsWith('/settings/accessibility')
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Settings size={15} className="shrink-0" />Settings
        </Link>
        <Link
          href="/settings/accessibility"
          onClick={onClose}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors mb-0.5 ${
            pathname === '/settings/accessibility'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Accessibility size={15} className="shrink-0" />Accessibility
        </Link>
      </div>

      <div className="px-4 py-4 border-t border-gray-100 shrink-0">
        <Link href="/settings" className="flex items-center gap-2.5 mb-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <span className="text-blue-700 font-semibold text-xs">{firstName[0]}{lastName[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-gray-900 truncate">{firstName} {lastName}</div>
            <div className="text-[11px] text-gray-400">{role.replace(/_/g, ' ')}</div>
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 text-[12px] text-gray-400 hover:text-red-500 transition-colors"
        >
          <LogOut size={13} />Sign out
        </button>
      </div>
    </aside>
  )
}
