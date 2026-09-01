import type { Metadata } from 'next'
import BetaForm from './BetaForm'
import { headers } from 'next/headers'

export const metadata: Metadata = {
  title: 'Request Beta Access',
  description: 'Apply to join the Omnis beta programme. UK secondary schools get full platform access, dedicated onboarding support, and direct input into the product roadmap.',
  openGraph: {
    title: 'Request Beta Access | Omnis Education',
    description: 'Join the first cohort of UK schools on Omnis — AI-powered learning & SEND management, free during the beta period.',
    url: 'https://omnis.education/marketing/beta',
  },
  alternates: { canonical: 'https://omnis.education/marketing/beta' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://omnis.education/marketing/beta#webpage',
      url: 'https://omnis.education/marketing/beta',
      name: 'Request Beta Access | Omnis Education',
      description: 'Apply to join the Omnis beta programme. UK secondary schools get full platform access, dedicated onboarding support, and direct input into the product roadmap.',
      isPartOf: { '@id': 'https://omnis.education/#website' },
      about: { '@id': 'https://omnis.education/#organization' },
      inLanguage: 'en-GB',
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://omnis.education/marketing/home' },
        { '@type': 'ListItem', position: 2, name: 'Request Beta Access', item: 'https://omnis.education/marketing/beta' },
      ],
    },
    {
      '@type': 'RegisterAction',
      name: 'Apply for Omnis beta access',
      description: 'Apply for free beta access to Omnis Education — AI-powered learning and SEND management for UK secondary schools.',
      target: { '@type': 'EntryPoint', urlTemplate: 'https://omnis.education/marketing/beta', httpMethod: 'POST' },
      object: { '@id': 'https://omnis.education/#organization' },
    },
  ],
}

export default async function BetaPage() {
  const nonce = (await headers()).get('x-nonce')
  return (
    <>
      <script type="application/ld+json" nonce={nonce ?? undefined} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BetaForm />
    </>
  )
}
