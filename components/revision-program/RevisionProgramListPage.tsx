'use client'
import { useRouter } from 'next/navigation'
import RevisionProgramList from './RevisionProgramList'

export default function RevisionProgramListPage({ programs }: { programs: any[] }) {
  const router = useRouter()
  return <RevisionProgramList programs={programs} onNew={() => router.push('/revision-program/new')} />
}
