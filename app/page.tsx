import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
export default async function RootPage() {
  const user = await requireAuth()
  if (user.role === 'STUDENT')            redirect('/student/dashboard')
  if (user.role === 'PARENT')             redirect('/parent/dashboard')
  if (user.role === 'SENCO')              redirect('/send/dashboard')
  if (user.role === 'SLT')                redirect('/slt/analytics')
  if (user.role === 'HEAD_OF_YEAR')       redirect('/hoy/dashboard')
  if (user.role === 'SCHOOL_ADMIN')       redirect('/admin/dashboard')
  if (user.role === 'PLATFORM_ADMIN') {
    if (user.email === 'ivanyardley@me.com') redirect('/demo')
    redirect('/platform-admin/dashboard')
  }
  if (user.role === 'ACADEMY_ADMIN')      redirect('/academy/dashboard')
  if (user.role === 'TEACHING_ASSISTANT') redirect('/ta/notes')
  redirect('/dashboard')
}
