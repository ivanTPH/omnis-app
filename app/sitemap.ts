import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://omnis.education'
  const lastModified = new Date('2026-07-18')

  return [
    { url: `${base}/marketing/home`,      lastModified, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/marketing/features`,  lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/marketing/beta`,      lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/marketing/investors`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/marketing/privacy`,   lastModified, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/marketing/terms`,     lastModified, changeFrequency: 'yearly',  priority: 0.3 },
  ]
}
