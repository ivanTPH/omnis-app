import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
export default async function RootPage() {
  const { role } = await requireAuth()
  if (role === 'STUDENT')            redirect('/student/dashboard')
  if (role === 'PARENT')             redirect('/parent/dashboard')
  if (role === 'SENCO')              redirect('/send/dashboard')
  if (role === 'SLT')                redirect('/slt/analytics')
  if (role === 'HEAD_OF_YEAR')       redirect('/hoy/dashboard')
  if (role === 'SCHOOL_ADMIN')       redirect('/admin/dashboard')
  if (role === 'PLATFORM_ADMIN')     redirect('/platform-admin/dashboard')
  if (role === 'ACADEMY_ADMIN')      redirect('/academy/dashboard')
  if (role === 'TEACHING_ASSISTANT') redirect('/ta/notes')
  redirect('/dashboard')
}
