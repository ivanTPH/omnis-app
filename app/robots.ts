import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/marketing/'],
        disallow: [
          '/login',
          '/api/',
          '/admin/',
          '/platform-admin/',
          '/academy/',
          '/senco/',
          '/slt/',
          '/hoy/',
          '/hod/',
          '/ta/',
          '/student/',
          '/parent/',
          '/dashboard',
          '/homework',
          '/classes',
          '/analytics/',
          '/messages/',
          '/notifications',
          '/plans',
          '/revision',
          '/revision-program',
          '/settings/',
          '/resources',
          '/lessons',
          '/send/',
          '/send-scorer',
          '/ai-generator',
          '/accept-dpa',
          '/accept-terms',
          '/accept-invite',
          '/forgot-password',
          '/reset-password',
        ],
      },
    ],
    sitemap: 'https://omnis.education/sitemap.xml',
  }
}
