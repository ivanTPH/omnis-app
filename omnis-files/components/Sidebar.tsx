'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard, BookOpen, ClipboardList, Users,
  MessageSquare, BarChart2, Shield, LogOut, GraduationCap,
  Heart, FileText
} from 'lucide-react'
import clsx from 'clsx'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const navByRole: Record<string, NavItem[]> = {
  TEACHER: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Lessons', href: '/lessons', icon: BookOpen },
    { label: 'Homework', href: '/homework', icon: ClipboardList },
    { label: 'Messages', href: '/messages', icon: MessageSquare },
  ],
  HEAD_OF_DEPT: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Lessons', href: '/lessons', icon: BookOpen },
    { label: 'Homework', href: '/homework', icon: ClipboardList },
    { label: 'Analytics', href: '/analytics/department', icon: BarChart2 },
  ],
  HEAD_OF_YEAR: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Integrity', href: '/hoy/integrity', icon: Shield },
    { label: 'Analytics', href: '/hoy/analytics', icon: BarChart2 },
  ],
  SENCO: [
    { label: 'SEND Dashboard', href: '/send/dashboard', icon: Heart },
    { label: 'ILP Records', href: '/send/ilp', icon: FileText },
    { label: 'Review Due', href: '/send/review-due', icon: ClipboardList },
  ],
  SCHOOL_ADMIN: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Audit Log', href: '/admin/audit', icon: Shield },
    { label: 'Settings', href: '/admin/settings', icon: BarChart2 },
  ],
  SLT: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Analytics', href: '/slt/analytics', icon: BarChart2 },
    { label: 'Audit Log', href: '/slt/audit', icon: Shield },
  ],
  STUDENT: [
    { label: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
    { label: 'Homework', href: '/student/homework', icon: ClipboardList },
    { label: 'My Grades', href: '/student/grades', icon: GraduationCap },
  ],
  PARENT: [
    { label: 'Dashboard', href: '/parent/dashboard', icon: LayoutDashboard },
    { label: 'Progress', href: '/parent/progress', icon: BarChart2 },
    { label: 'Messages', href: '/parent/messages', icon: MessageSquare },
  ],
}

interface SidebarProps {
  role: string
  firstName: string
  lastName: string
  schoolName: string
}

export default function Sidebar({ role, firstName, lastName, schoolName }: SidebarProps) {
  const pathname = usePathname()
  const navItems = navByRole[role] ?? navByRole['TEACHER']

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-700 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">O</span>
          </div>
          <div>
            <div className="font-bold text-gray-900 leading-tight">Omnis</div>
            <div className="text-xs text-gray-500 truncate max-w-[140px]">{schoolName}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-700 font-semibold text-sm">
              {firstName[0]}{lastName[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{firstName} {lastName}</div>
            <div className="text-xs text-gray-500">{role.replace(/_/g, ' ')}</div>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors w-full"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
