import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AcceptTermsClient from './AcceptTermsClient'

export default async function AcceptTermsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const role = (session.user as any).role as string
  if (role !== 'PARENT' && role !== 'STUDENT') redirect('/')
  return <AcceptTermsClient role={role} />
}
