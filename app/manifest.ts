import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'Omnis Education',
    short_name:       'Omnis',
    description:      'AI-powered learning and SEND management platform for UK secondary schools.',
    start_url:        '/',
    display:          'standalone',
    background_color: '#1e3a8a',
    theme_color:      '#1e3a8a',
    lang:             'en-GB',
    icons: [
      { src: '/favicon.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/favicon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
