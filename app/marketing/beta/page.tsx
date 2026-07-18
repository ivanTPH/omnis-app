import type { Metadata } from 'next'
import BetaForm from './BetaForm'

export const metadata: Metadata = {
  title: 'Request Beta Access',
  description: 'Apply to join the Omnis beta programme. UK secondary schools get full platform access, dedicated onboarding support, and direct input into the product roadmap.',
  openGraph: {
    title: 'Request Beta Access | Omnis Education',
    description: 'Join the first cohort of UK schools on Omnis — AI-powered learning & SEND management, free during the beta period.',
    url: 'https://omnis.education/marketing/beta',
  },
}

export default function BetaPage() {
  return <BetaForm />
}
