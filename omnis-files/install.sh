#!/bin/bash
# ══════════════════════════════════════════════════════════
#  OMNIS EDUCATION PLATFORM — INSTALLER
# ══════════════════════════════════════════════════════════
set -e

echo ""
echo "🏫  Setting up Omnis — this takes about 3-5 minutes..."
echo ""

# Step 1: Create Next.js project
echo "📦  Step 1/5: Creating project..."
npx create-next-app@latest omnis-app --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --yes 2>/dev/null
cd omnis-app

# Step 2: Install packages
echo "📦  Step 2/5: Installing packages..."
npm install next-auth@beta @auth/prisma-adapter @prisma/client prisma bcryptjs lucide-react clsx --silent
npm install -D @types/bcryptjs tsx --silent

# Step 3: Database
echo "🗄️   Step 3/5: Creating database..."
createdb omnis_dev 2>/dev/null || true
printf 'DATABASE_URL="postgresql://localhost:5432/omnis_dev"\nNEXTAUTH_SECRET="omnis-super-secret-key-change-in-production"\nNEXTAUTH_URL="http://localhost:3000"\n' > .env.local

# Step 4: Write all source files
echo "📝  Step 4/5: Writing application..."
mkdir -p lib "app/api/auth/[...nextauth]" components prisma

# --- prisma/schema.prisma ---
cat > prisma/schema.prisma << 'EOF'
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
enum Role { SUPER_ADMIN SCHOOL_ADMIN SLT HEAD_OF_DEPT HEAD_OF_YEAR COVER_MANAGER TEACHER SENCO STUDENT PARENT }
enum HomeworkStatus { DRAFT PUBLISHED CLOSED }
enum SubmissionStatus { SUBMITTED UNDER_REVIEW RESUBMISSION_REQ MARKED RETURNED }
enum ILPStatus { DRAFT ACTIVE UNDER_REVIEW ARCHIVED }
enum AuditAction { HOMEWORK_CREATED HOMEWORK_PUBLISHED HOMEWORK_ADAPTED SUBMISSION_GRADED GRADE_OVERRIDDEN SUBMISSION_RETURNED RESUBMISSION_REQUESTED ILP_CREATED ILP_ACTIVATED ILP_REVIEWED ILP_SHARED_WITH_PARENT SEND_STATUS_CHANGED INTEGRITY_FLAGGED INTEGRITY_REVIEWED MESSAGE_SENT USER_CREATED USER_ROLE_CHANGED USER_DEACTIVATED LESSON_PUBLISHED WONDE_SYNC_COMPLETED }
model School { id String @id @default(cuid()); name String; wondeId String? @unique; aiOptIn Boolean @default(false); createdAt DateTime @default(now()); users User[]; classes SchoolClass[]; lessons Lesson[]; homework Homework[]; submissions Submission[]; ilps ILP[]; messages Message[]; auditLogs AuditLog[]; termDates TermDate[]; integritySignals IntegritySignal[] }
model TermDate { id String @id @default(cuid()); school School @relation(fields: [schoolId], references: [id]); schoolId String; label String; startsAt DateTime; endsAt DateTime }
model User { id String @id @default(cuid()); school School @relation(fields: [schoolId], references: [id]); schoolId String; email String @unique; passwordHash String; role Role; firstName String; lastName String; department String?; yearGroup Int?; isActive Boolean @default(true); createdAt DateTime @default(now()); teacherClasses ClassTeacher[]; enrolments Enrolment[]; parentLinks ParentStudentLink[]; childLinks ParentStudentLink[] @relation("child"); submissions Submission[]; ilpNotes ILPNote[]; sentMessages Message[] @relation("sender"); receivedMessages MessageRecipient[]; auditLogs AuditLog[]; @@index([schoolId, role]) }
model SchoolClass { id String @id @default(cuid()); school School @relation(fields: [schoolId], references: [id]); schoolId String; name String; subject String; yearGroup Int; department String; teachers ClassTeacher[]; enrolments Enrolment[]; lessons Lesson[]; homework Homework[]; @@index([schoolId]) }
model ClassTeacher { classId String; userId String; class SchoolClass @relation(fields: [classId], references: [id]); user User @relation(fields: [userId], references: [id]); @@id([classId, userId]) }
model Enrolment { classId String; userId String; class SchoolClass @relation(fields: [classId], references: [id]); user User @relation(fields: [userId], references: [id]); @@id([classId, userId]) }
model ParentStudentLink { parentId String; studentId String; parent User @relation(fields: [parentId], references: [id]); child User @relation("child", fields: [studentId], references: [id]); @@id([parentId, studentId]) }
model Lesson { id String @id @default(cuid()); school School @relation(fields: [schoolId], references: [id]); schoolId String; class SchoolClass @relation(fields: [classId], references: [id]); classId String; title String; objectives String[]; scheduledAt DateTime; published Boolean @default(false); createdBy String; createdAt DateTime @default(now()); homework Homework[]; @@index([schoolId, classId]) }
model Homework { id String @id @default(cuid()); school School @relation(fields: [schoolId], references: [id]); schoolId String; class SchoolClass @relation(fields: [classId], references: [id]); classId String; lesson Lesson? @relation(fields: [lessonId], references: [id]); lessonId String?; title String; instructions String; modelAnswer String?; gradingBands Json?; dueAt DateTime; status HomeworkStatus @default(DRAFT); isAdapted Boolean @default(false); adaptedFor String?; createdBy String; createdAt DateTime @default(now()); submissions Submission[]; @@index([schoolId, classId]) }
model Submission { id String @id @default(cuid()); school School @relation(fields: [schoolId], references: [id]); schoolId String; homework Homework @relation(fields: [homeworkId], references: [id]); homeworkId String; student User @relation(fields: [studentId], references: [id]); studentId String; content String; grade String?; feedback String?; status SubmissionStatus @default(SUBMITTED); submittedAt DateTime @default(now()); markedAt DateTime?; integritySignal IntegritySignal?; @@unique([homeworkId, studentId]); @@index([schoolId, studentId]) }
model IntegritySignal { id String @id @default(cuid()); school School @relation(fields: [schoolId], references: [id]); schoolId String; submission Submission @relation(fields: [submissionId], references: [id]); submissionId String @unique; pasteCount Int @default(0); pasteCharRatio Float @default(0); timeOnTaskSecs Int @default(0); flagged Boolean @default(false); flagReason String?; reviewedBy String?; reviewedAt DateTime?; createdAt DateTime @default(now()); @@index([schoolId]) }
model ILP { id String @id @default(cuid()); school School @relation(fields: [schoolId], references: [id]); schoolId String; studentId String; status ILPStatus @default(DRAFT); needsSummary String; reviewDueAt DateTime?; activatedAt DateTime?; activatedBy String?; createdAt DateTime @default(now()); updatedAt DateTime @updatedAt; targets ILPTarget[]; notes ILPNote[]; @@index([schoolId, studentId]) }
model ILPTarget { id String @id @default(cuid()); ilp ILP @relation(fields: [ilpId], references: [id]); ilpId String; description String; successCriteria String; achieved Boolean @default(false); subject String? }
model ILPNote { id String @id @default(cuid()); ilp ILP @relation(fields: [ilpId], references: [id]); ilpId String; author User @relation(fields: [authorId], references: [id]); authorId String; content String; isInternal Boolean @default(true); createdAt DateTime @default(now()) }
model Message { id String @id @default(cuid()); school School @relation(fields: [schoolId], references: [id]); schoolId String; sender User @relation("sender", fields: [senderId], references: [id]); senderId String; subject String; body String; sentAt DateTime @default(now()); recipients MessageRecipient[]; @@index([schoolId, senderId]) }
model MessageRecipient { messageId String; userId String; read Boolean @default(false); message Message @relation(fields: [messageId], references: [id]); user User @relation(fields: [userId], references: [id]); @@id([messageId, userId]) }
model AuditLog { id String @id @default(cuid()); school School @relation(fields: [schoolId], references: [id]); schoolId String; actor User @relation(fields: [actorId], references: [id]); actorId String; action AuditAction; targetType String; targetId String; metadata Json?; createdAt DateTime @default(now()); @@index([schoolId, action]); @@index([schoolId, createdAt]) }
EOF

# --- lib/prisma.ts ---
cat > lib/prisma.ts << 'EOF'
import { PrismaClient } from '@prisma/client'
const g = globalThis as any
export const prisma: PrismaClient = g.prisma ?? new PrismaClient({ log: ['error'] })
if (process.env.NODE_ENV !== 'production') g.prisma = prisma
prisma.$use(async (params: any, next: any) => {
  if (params.model === 'AuditLog' && ['update','updateMany','delete','deleteMany','upsert'].includes(params.action)) throw new Error('AuditLog is immutable')
  return next(params)
})
export async function writeAudit(data: { schoolId: string; actorId: string; action: string; targetType: string; targetId: string; metadata?: object }) {
  await prisma.auditLog.create({ data: { ...data, action: data.action as any, metadata: data.metadata ?? {} } })
}
EOF

# --- lib/auth.ts ---
cat > lib/auth.ts << 'EOF'
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [CredentialsProvider({ name: 'credentials', credentials: { email: { type: 'email' }, password: { type: 'password' } },
    async authorize(c: any) {
      if (!c?.email || !c?.password) return null
      const user = await prisma.user.findUnique({ where: { email: c.email }, include: { school: true } })
      if (!user || !user.isActive) return null
      if (!await bcrypt.compare(c.password, user.passwordHash)) return null
      return { id: user.id, email: user.email, name: `${user.firstName} ${user.lastName}`, schoolId: user.schoolId, schoolName: user.school.name, role: user.role, firstName: user.firstName, lastName: user.lastName }
    }
  })],
  callbacks: {
    async jwt({ token, user }: any) { if (user) Object.assign(token, { id: user.id, schoolId: user.schoolId, schoolName: user.schoolName, role: user.role, firstName: user.firstName, lastName: user.lastName }); return token },
    async session({ session, token }: any) { Object.assign(session.user, { id: token.id, schoolId: token.schoolId, schoolName: token.schoolName, role: token.role, firstName: token.firstName, lastName: token.lastName }); return session },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
})
EOF

# --- app/api/auth/[...nextauth]/route.ts ---
cat > "app/api/auth/[...nextauth]/route.ts" << 'EOF'
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
EOF

# --- app/globals.css ---
cat > app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
body { @apply bg-gray-50 text-gray-900; }
EOF

# --- app/layout.tsx ---
cat > app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
const inter = Inter({ subsets: ['latin'] })
export const metadata: Metadata = { title: 'Omnis Education', description: 'Secondary Learning & SEND Intelligence Platform' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={inter.className}>{children}</body></html>
}
EOF

# --- app/page.tsx ---
cat > app/page.tsx << 'EOF'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
export default async function RootPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = (session.user as any).role
  if (role === 'STUDENT') redirect('/student/dashboard')
  if (role === 'PARENT') redirect('/parent/dashboard')
  if (role === 'SENCO') redirect('/send/dashboard')
  redirect('/dashboard')
}
EOF

# --- app/login/page.tsx ---
mkdir -p app/login
cat > app/login/page.tsx << 'EOF'
'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const demos = [
  { role: 'Teacher', email: 'j.patel@omnisdemo.school' },
  { role: 'SENCo', email: 'r.morris@omnisdemo.school' },
  { role: 'Head of Year', email: 't.adeyemi@omnisdemo.school' },
  { role: 'Student (Alex)', email: 'a.hughes@students.omnisdemo.school' },
  { role: 'Student (Mia)', email: 'm.johnson@students.omnisdemo.school' },
  { role: 'Parent', email: 'l.hughes@parents.omnisdemo.school' },
  { role: 'Admin', email: 'admin@omnisdemo.school' },
  { role: 'Head of Dept', email: 'd.brooks@omnisdemo.school' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) { setError('Invalid email or password.'); setLoading(false) }
    else { router.push('/'); router.refresh() }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <span className="text-2xl font-bold text-blue-800">O</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Omnis</h1>
          <p className="text-blue-200 mt-1">Learning & SEND Intelligence Platform</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-4">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="you@school.ac.uk" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" required />
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
            <button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
        <div className="bg-white/10 backdrop-blur rounded-2xl p-5">
          <p className="text-blue-100 text-sm font-medium mb-3">🎓 Demo accounts — password: <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded">Demo1234!</span></p>
          <div className="grid grid-cols-2 gap-2">
            {demos.map(d => (
              <button key={d.email} onClick={() => { setEmail(d.email); setPassword('Demo1234!') }} className="text-left bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition">
                <div className="text-white text-xs font-medium">{d.role}</div>
                <div className="text-blue-200 text-xs truncate">{d.email.split('@')[0]}</div>
              </button>
            ))}
          </div>
          <p className="text-blue-300 text-xs mt-3">Click any account to fill in, then click Sign in</p>
        </div>
      </div>
    </div>
  )
}
EOF

# --- components/Sidebar.tsx ---
cat > components/Sidebar.tsx << 'EOF'
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LayoutDashboard, BookOpen, ClipboardList, Users, MessageSquare, BarChart2, Shield, LogOut, GraduationCap, Heart, FileText, AlertTriangle } from 'lucide-react'

const navByRole: Record<string, Array<{label:string;href:string;icon:any}>> = {
  TEACHER: [{label:'Dashboard',href:'/dashboard',icon:LayoutDashboard},{label:'Lessons',href:'/lessons',icon:BookOpen},{label:'Homework',href:'/homework',icon:ClipboardList},{label:'Messages',href:'/messages',icon:MessageSquare}],
  HEAD_OF_DEPT: [{label:'Dashboard',href:'/dashboard',icon:LayoutDashboard},{label:'Lessons',href:'/lessons',icon:BookOpen},{label:'Homework',href:'/homework',icon:ClipboardList},{label:'Analytics',href:'/analytics/department',icon:BarChart2}],
  HEAD_OF_YEAR: [{label:'Dashboard',href:'/dashboard',icon:LayoutDashboard},{label:'Integrity',href:'/hoy/integrity',icon:AlertTriangle},{label:'Analytics',href:'/hoy/analytics',icon:BarChart2}],
  SENCO: [{label:'SEND Dashboard',href:'/send/dashboard',icon:Heart},{label:'ILP Records',href:'/send/ilp',icon:FileText},{label:'Review Due',href:'/send/review-due',icon:ClipboardList}],
  SCHOOL_ADMIN: [{label:'Dashboard',href:'/dashboard',icon:LayoutDashboard},{label:'Users',href:'/admin/users',icon:Users},{label:'Audit Log',href:'/admin/audit',icon:Shield}],
  SLT: [{label:'Dashboard',href:'/dashboard',icon:LayoutDashboard},{label:'Analytics',href:'/slt/analytics',icon:BarChart2},{label:'Audit Log',href:'/slt/audit',icon:Shield}],
  STUDENT: [{label:'Dashboard',href:'/student/dashboard',icon:LayoutDashboard},{label:'Homework',href:'/student/homework',icon:ClipboardList},{label:'My Grades',href:'/student/grades',icon:GraduationCap}],
  PARENT: [{label:'Dashboard',href:'/parent/dashboard',icon:LayoutDashboard},{label:'Progress',href:'/parent/progress',icon:BarChart2},{label:'Messages',href:'/parent/messages',icon:MessageSquare}],
}

export default function Sidebar({ role, firstName, lastName, schoolName }: { role:string; firstName:string; lastName:string; schoolName:string }) {
  const pathname = usePathname()
  const nav = navByRole[role] ?? navByRole['TEACHER']
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 shrink-0">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-700 rounded-xl flex items-center justify-center shrink-0"><span className="text-white font-bold text-lg">O</span></div>
          <div className="min-w-0"><div className="font-bold text-gray-900 leading-tight">Omnis</div><div className="text-xs text-gray-500 truncate">{schoolName}</div></div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {nav.map(item => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
              <Icon size={18} />{item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center shrink-0"><span className="text-blue-700 font-semibold text-sm">{firstName[0]}{lastName[0]}</span></div>
          <div className="flex-1 min-w-0"><div className="text-sm font-medium text-gray-900 truncate">{firstName} {lastName}</div><div className="text-xs text-gray-500">{role.replace(/_/g,' ')}</div></div>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })} className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors w-full"><LogOut size={15} />Sign out</button>
      </div>
    </aside>
  )
}
EOF

# --- app/dashboard/page.tsx ---
mkdir -p app/dashboard
cat > app/dashboard/page.tsx << 'EOF'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { Plus, ClipboardList, BookOpen, AlertTriangle, ChevronRight } from 'lucide-react'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, id: userId, firstName, lastName, schoolName } = session.user as any

  const myClasses = await prisma.schoolClass.findMany({
    where: { schoolId, teachers: { some: { userId } } },
    include: { _count: { select: { enrolments: true } } },
  })
  const classIds = myClasses.map((c: any) => c.id)

  const recentHomework = await prisma.homework.findMany({
    where: { schoolId, classId: { in: classIds } },
    orderBy: { createdAt: 'desc' }, take: 6,
    include: { class: true, _count: { select: { submissions: true } } },
  })

  const flagged = await prisma.submission.findMany({
    where: { schoolId, status: 'UNDER_REVIEW', homework: { classId: { in: classIds } } },
    include: { student: true, homework: { include: { class: true } }, integritySignal: true },
    take: 10,
  })

  const pendingMark = await prisma.submission.count({ where: { schoolId, status: 'SUBMITTED', homework: { classId: { in: classIds } } } })

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar role={role} firstName={firstName} lastName={lastName} schoolName={schoolName} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Good morning, {firstName} 👋</h1>
              <p className="text-gray-500 mt-1">Here's your overview for today</p>
            </div>
            <Link href="/homework/new" className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"><Plus size={16} />New Homework</Link>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="text-3xl font-bold text-gray-900">{myClasses.length}</div><div className="text-sm text-gray-500 mt-1">My Classes</div></div>
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className={`text-3xl font-bold ${pendingMark > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{pendingMark}</div><div className="text-sm text-gray-500 mt-1">To Mark</div></div>
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className={`text-3xl font-bold ${flagged.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{flagged.length}</div><div className="text-sm text-gray-500 mt-1">Integrity Flags</div></div>
          </div>

          {flagged.length > 0 && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4"><AlertTriangle size={18} className="text-amber-600" /><h2 className="font-semibold text-amber-900">Integrity Review Required</h2><span className="ml-auto text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">{flagged.length} flagged</span></div>
              <div className="space-y-2">
                {flagged.map((sub: any) => (
                  <div key={sub.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-3">
                    <div><span className="font-medium text-gray-900">{sub.student.firstName} {sub.student.lastName}</span><span className="text-gray-500 text-sm ml-2">— {sub.homework.title}</span></div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded">{Math.round((sub.integritySignal?.pasteCharRatio ?? 0) * 100)}% pasted</span>
                      <Link href={`/homework/${sub.homeworkId}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">Review <ChevronRight size={14} /></Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4"><BookOpen size={18} className="text-blue-600" /><h2 className="font-semibold text-gray-900">My Classes</h2></div>
              <div className="space-y-2">
                {myClasses.map((cls: any) => (
                  <div key={cls.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div><div className="font-medium text-gray-900 text-sm">{cls.name}</div><div className="text-xs text-gray-500">{cls._count.enrolments} students</div></div>
                    <Link href={`/homework/new?classId=${cls.id}`} className="text-xs text-blue-600 hover:underline">+ Homework</Link>
                  </div>
                ))}
                {myClasses.length === 0 && <p className="text-gray-400 text-sm">No classes assigned yet</p>}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4"><ClipboardList size={18} className="text-blue-600" /><h2 className="font-semibold text-gray-900">Recent Homework</h2></div>
              <div className="space-y-2">
                {recentHomework.map((hw: any) => (
                  <Link key={hw.id} href={`/homework/${hw.id}`} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded px-1 transition">
                    <div><div className="font-medium text-gray-900 text-sm truncate max-w-[180px]">{hw.title}</div><div className="text-xs text-gray-500">{hw.class.name}</div></div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${hw.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{hw.status}</span>
                      <span className="text-xs text-gray-500">{hw._count.submissions}</span>
                    </div>
                  </Link>
                ))}
                {recentHomework.length === 0 && <p className="text-gray-400 text-sm">No homework yet — <Link href="/homework/new" className="text-blue-600 hover:underline">create some</Link></p>}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
EOF

# --- app/student/dashboard/page.tsx ---
mkdir -p app/student/dashboard
cat > app/student/dashboard/page.tsx << 'EOF'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { ClipboardList, Star, Clock } from 'lucide-react'

export default async function StudentDashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, id: userId, firstName, lastName, schoolName } = session.user as any
  if (role !== 'STUDENT') redirect('/dashboard')

  const enrolments = await prisma.enrolment.findMany({ where: { userId }, select: { classId: true } })
  const classIds = enrolments.map((e: any) => e.classId)

  const allHw = await prisma.homework.findMany({
    where: { schoolId, classId: { in: classIds }, status: 'PUBLISHED', OR: [{ isAdapted: false, adaptedFor: null }, { isAdapted: true, adaptedFor: userId }] },
    include: { class: true, submissions: { where: { studentId: userId }, select: { id: true, status: true, grade: true, submittedAt: true } } },
    orderBy: { dueAt: 'asc' },
  })

  // Prefer adapted version for same lesson
  const map = new Map<string, any>()
  for (const hw of allHw) {
    const key = hw.lessonId ?? hw.id
    if (hw.isAdapted || !map.has(key)) map.set(key, hw)
  }
  const homework = Array.from(map.values())
  const now = new Date()
  const pending = homework.filter((hw: any) => !hw.submissions[0])
  const overdue = pending.filter((hw: any) => new Date(hw.dueAt) < now)
  const upcoming = pending.filter((hw: any) => new Date(hw.dueAt) >= now)
  const graded = homework.filter((hw: any) => hw.submissions[0]?.grade)

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar role={role} firstName={firstName} lastName={lastName} schoolName={schoolName} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-8">
          <div className="mb-8"><h1 className="text-2xl font-bold text-gray-900">Welcome back, {firstName} 👋</h1><p className="text-gray-500 mt-1">Your homework overview</p></div>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className={`text-3xl font-bold ${overdue.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{pending.length}</div><div className="text-sm text-gray-500 mt-1">To Do</div>{overdue.length > 0 && <div className="text-xs text-red-600 mt-1">{overdue.length} overdue</div>}</div>
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="text-3xl font-bold text-amber-600">{homework.filter((hw: any) => hw.submissions[0] && !hw.submissions[0].grade).length}</div><div className="text-sm text-gray-500 mt-1">Awaiting Feedback</div></div>
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="text-3xl font-bold text-green-600">{graded.length}</div><div className="text-sm text-gray-500 mt-1">Graded</div></div>
          </div>
          {overdue.length > 0 && <div className="mb-6"><h2 className="font-semibold text-red-700 mb-3 flex items-center gap-2"><Clock size={16} />Overdue</h2><div className="space-y-2">{overdue.map((hw: any) => <Link key={hw.id} href={`/student/homework/${hw.id}`} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-5 py-4 hover:bg-red-100 transition"><div><div className="font-medium text-gray-900">{hw.title}</div><div className="text-sm text-gray-500">{hw.class.name}</div></div><div className="text-sm text-red-600 font-medium">Due {new Date(hw.dueAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div></Link>)}</div></div>}
          {upcoming.length > 0 && <div className="mb-6"><h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><ClipboardList size={16} />To Do</h2><div className="space-y-2">{upcoming.map((hw: any) => { const days = Math.ceil((new Date(hw.dueAt).getTime()-now.getTime())/(1000*60*60*24)); return <Link key={hw.id} href={`/student/homework/${hw.id}`} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:bg-blue-50 hover:border-blue-200 transition"><div><div className="font-medium text-gray-900">{hw.title}</div><div className="text-sm text-gray-500">{hw.class.name}</div></div><div className={`text-sm font-medium ${days<=2?'text-amber-600':'text-gray-500'}`}>{days===1?'Due tomorrow':`${days} days left`}</div></Link>})}</div></div>}
          {graded.length > 0 && <div><h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Star size={16} />Recently Graded</h2><div className="space-y-2">{graded.slice(0,5).map((hw: any) => <Link key={hw.id} href={`/student/homework/${hw.id}`} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:bg-gray-50 transition"><div><div className="font-medium text-gray-900">{hw.title}</div><div className="text-sm text-gray-500">{hw.class.name}</div></div><div className="bg-green-100 text-green-800 font-bold px-3 py-1 rounded-lg">{hw.submissions[0].grade}</div></Link>)}</div></div>}
          {homework.length === 0 && <div className="text-center py-16 text-gray-400"><ClipboardList size={48} className="mx-auto mb-3 opacity-30" /><p>No homework assigned yet</p></div>}
        </div>
      </main>
    </div>
  )
}
EOF

# --- app/parent/dashboard/page.tsx ---
mkdir -p app/parent/dashboard
cat > app/parent/dashboard/page.tsx << 'EOF'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Sidebar from '@/components/Sidebar'

export default async function ParentDashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, id: userId, firstName, lastName, schoolName } = session.user as any
  if (role !== 'PARENT') redirect('/dashboard')

  const links = await prisma.parentStudentLink.findMany({ where: { parentId: userId }, include: { child: { include: { enrolments: { include: { class: true } } } } } })
  const children = links.map((l: any) => l.child)

  const childData = await Promise.all(children.map(async (child: any) => {
    const classIds = child.enrolments.map((e: any) => e.classId)
    const homework = await prisma.homework.findMany({
      where: { schoolId, classId: { in: classIds }, status: 'PUBLISHED', OR: [{ isAdapted: false, adaptedFor: null }, { isAdapted: true, adaptedFor: child.id }] },
      include: { class: true, submissions: { where: { studentId: child.id }, select: { grade: true, status: true } } },
      orderBy: { dueAt: 'desc' }, take: 8,
    })
    const clean = homework.map((hw: any) => { const { isAdapted, adaptedFor, modelAnswer, gradingBands, ...safe } = hw; return safe })
    return { child, homework: clean, graded: clean.filter((h: any) => h.submissions[0]?.grade), pending: clean.filter((h: any) => !h.submissions[0]) }
  }))

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar role={role} firstName={firstName} lastName={lastName} schoolName={schoolName} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-8">
          <div className="mb-8"><h1 className="text-2xl font-bold text-gray-900">Welcome, {firstName}</h1><p className="text-gray-500 mt-1">Your child's progress at {schoolName}</p></div>
          {childData.map(({ child, homework, graded, pending }: any) => (
            <div key={child.id} className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center"><span className="text-blue-700 font-semibold">{child.firstName[0]}{child.lastName[0]}</span></div>
                <div><h2 className="font-semibold text-gray-900">{child.firstName} {child.lastName}</h2><p className="text-sm text-gray-500">Year {child.yearGroup}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="text-2xl font-bold text-amber-600">{pending.length}</div><div className="text-sm text-gray-500">Homework Due</div></div>
                <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="text-2xl font-bold text-green-600">{graded.length}</div><div className="text-sm text-gray-500">Graded</div></div>
                <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="text-2xl font-bold text-gray-900">{homework.length}</div><div className="text-sm text-gray-500">Total Set</div></div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-medium text-gray-900">Recent Homework</h3></div>
                <div className="divide-y divide-gray-100">
                  {homework.slice(0,6).map((hw: any) => {
                    const sub = hw.submissions[0]
                    return (
                      <div key={hw.id} className="flex items-center justify-between px-5 py-3">
                        <div><div className="text-sm font-medium text-gray-900">{hw.title}</div><div className="text-xs text-gray-500">{hw.class.name} · Due {new Date(hw.dueAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div></div>
                        <div>{sub?.grade ? <span className="bg-green-100 text-green-800 font-bold text-sm px-3 py-1 rounded-lg">{sub.grade}</span> : sub ? <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full">Submitted</span> : <span className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">Pending</span>}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
          {children.length === 0 && <div className="text-center py-16 text-gray-400"><p>No children linked to your account.</p><p className="text-sm mt-1">Please contact the school admin.</p></div>}
        </div>
      </main>
    </div>
  )
}
EOF

# --- app/send/dashboard/page.tsx ---
mkdir -p app/send/dashboard
cat > app/send/dashboard/page.tsx << 'EOF'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { Heart, Clock } from 'lucide-react'

export default async function SendDashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, firstName, lastName, schoolName } = session.user as any
  if (!['SENCO','SCHOOL_ADMIN','SLT'].includes(role)) redirect('/dashboard')

  const ilps = await prisma.iLP.findMany({ where: { schoolId }, include: { targets: true, notes: true }, orderBy: { updatedAt: 'desc' } })
  const students = await prisma.user.findMany({ where: { id: { in: ilps.map((i: any) => i.studentId) }, schoolId }, select: { id: true, firstName: true, lastName: true, yearGroup: true } })
  const sMap = Object.fromEntries(students.map((s: any) => [s.id, s]))
  const now = new Date()
  const reviewDue = ilps.filter((i: any) => i.reviewDueAt && new Date(i.reviewDueAt) <= now && i.status === 'ACTIVE')

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar role={role} firstName={firstName} lastName={lastName} schoolName={schoolName} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-8">
          <div className="mb-8"><h1 className="text-2xl font-bold text-gray-900">SEND Dashboard</h1><p className="text-gray-500 mt-1">Individual Learning Plans and SEND oversight</p></div>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="text-3xl font-bold text-blue-600">{ilps.filter((i: any)=>i.status==='ACTIVE').length}</div><div className="text-sm text-gray-500 mt-1">Active ILPs</div></div>
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="text-3xl font-bold text-amber-600">{ilps.filter((i: any)=>i.status==='DRAFT').length}</div><div className="text-sm text-gray-500 mt-1">Draft ILPs</div></div>
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className={`text-3xl font-bold ${reviewDue.length>0?'text-red-600':'text-gray-400'}`}>{reviewDue.length}</div><div className="text-sm text-gray-500 mt-1">Reviews Due</div></div>
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="text-3xl font-bold text-gray-900">{ilps.length}</div><div className="text-sm text-gray-500 mt-1">Total Students</div></div>
          </div>
          {reviewDue.length > 0 && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4"><Clock size={18} className="text-red-600" /><h2 className="font-semibold text-red-900">Reviews Overdue</h2></div>
              <div className="space-y-2">{reviewDue.map((ilp: any) => { const s = sMap[ilp.studentId]; return <Link key={ilp.id} href={`/send/ilp/${ilp.studentId}`} className="flex items-center justify-between bg-white rounded-lg px-4 py-3 hover:bg-red-50 transition"><div className="font-medium text-gray-900">{s?.firstName} {s?.lastName}<span className="text-gray-500 font-normal ml-2 text-sm">Year {s?.yearGroup}</span></div><span className="text-sm text-red-600">Due {new Date(ilp.reviewDueAt!).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span></Link>})}</div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2"><Heart size={18} className="text-blue-600" /><h2 className="font-semibold text-gray-900">All ILP Records</h2></div>
            <div className="divide-y divide-gray-100">
              {ilps.map((ilp: any) => { const s = sMap[ilp.studentId]; const colour = ({ACTIVE:'bg-green-100 text-green-700',DRAFT:'bg-gray-100 text-gray-600',UNDER_REVIEW:'bg-amber-100 text-amber-700',ARCHIVED:'bg-gray-100 text-gray-400'} as any)[ilp.status]; return (
                <Link key={ilp.id} href={`/send/ilp/${ilp.studentId}`} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition">
                  <div><div className="font-medium text-gray-900">{s?.firstName} {s?.lastName}</div><div className="text-sm text-gray-500">Year {s?.yearGroup} · {ilp.targets.length} targets · {ilp.notes.length} notes</div></div>
                  <div className="flex items-center gap-3">{ilp.reviewDueAt && <span className="text-xs text-gray-500">Review {new Date(ilp.reviewDueAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>}<span className={`text-xs px-2.5 py-1 rounded-full font-medium ${colour}`}>{ilp.status}</span></div>
                </Link>
              )})}
              {ilps.length === 0 && <div className="px-6 py-12 text-center text-gray-400"><Heart size={32} className="mx-auto mb-2 opacity-30" /><p>No ILP records yet</p></div>}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
EOF

# package.json seed config
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.prisma={seed:'tsx prisma/seed.ts'};fs.writeFileSync('package.json',JSON.stringify(p,null,2));"

# Step 5: Migrate and seed
echo ""
echo "🌱  Step 5/5: Setting up database and demo data..."
npx prisma generate --silent
npx prisma db push --accept-data-loss
npx tsx prisma/seed.ts

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🎉  OMNIS IS READY!"
echo "  👉  Open your browser and go to: http://localhost:3000"
echo "  👉  All demo accounts use password: Demo1234!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
open http://localhost:3000 2>/dev/null || true
npm run dev
