import type { Metadata } from 'next'
import InvestorsForm from './InvestorsForm'

export const metadata: Metadata = {
  title: 'Investors',
  description: 'Omnis is building the intelligence layer for UK secondary schools — AI-powered learning, adaptive SEND management, and MIS integration in one platform.',
  openGraph: {
    title: 'Investor Relations | Omnis Education',
    description: 'Transforming UK secondary education with AI. 3,600+ schools, £2.4bn EdTech market, 1 in 5 pupils with SEND needs.',
    url: 'https://omnis.education/marketing/investors',
  },
}

export default function InvestorsPage() {
  return <InvestorsForm />
}
