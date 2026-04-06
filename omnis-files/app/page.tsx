import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const session = await auth()

  if (!session) redirect('/login')

  const role = session.user.role

  if (role === 'STUDENT') redirect('/student/dashboard')
  if (role === 'PARENT') redirect('/parent/dashboard')
  if (role === 'SENCO') redirect('/send/dashboard')
  redirect('/dashboard')
}
