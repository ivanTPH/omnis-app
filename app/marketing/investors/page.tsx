import type { Metadata } from 'next'
import InvestorsForm from './InvestorsForm'
import { headers } from 'next/headers'

export const metadata: Metadata = {
  title: 'Investors',
  description: 'Omnis is building the intelligence layer for UK secondary schools — AI-powered learning, adaptive SEND management, and MIS integration in one platform.',
  openGraph: {
    title: 'Investor Relations | Omnis Education',
    description: 'Transforming UK secondary education with AI. 3,600+ schools, £2.4bn EdTech market, 1 in 5 pupils with SEND needs.',
    url: 'https://omnis.education/marketing/investors',
  },
  alternates: { canonical: 'https://omnis.education/marketing/investors' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://omnis.education/marketing/investors#webpage',
      url: 'https://omnis.education/marketing/investors',
      name: 'Investor Relations | Omnis Education',
      description: 'Omnis is building the intelligence layer for UK secondary schools — AI-powered learning, adaptive SEND management, and MIS integration in one platform.',
      isPartOf: { '@id': 'https://omnis.education/#website' },
      about: { '@id': 'https://omnis.education/#organization' },
      inLanguage: 'en-GB',
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://omnis.education/marketing/home' },
        { '@type': 'ListItem', position: 2, name: 'Investors', item: 'https://omnis.education/marketing/investors' },
      ],
    },
  ],
}

export default async function InvestorsPage() {
  const nonce = (await headers()).get('x-nonce')
  return (
    <>
      <script type="application/ld+json" nonce={nonce ?? undefined} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <InvestorsForm />
    </>
  )
}
