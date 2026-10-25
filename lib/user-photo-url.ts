/** The URL every page uses for a stored photo; the route serves the bytes. */
export const photoProxyUrl = (userId: string) => `/api/student-photo/${userId}`

/** Splits a data: URL into its content type and raw bytes. */
export function parseDataUrl(dataUrl: string): { contentType: string; bytes: Buffer } | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl)
  if (!m || !m[2]) return null
  return { contentType: m[1] || 'image/jpeg', bytes: Buffer.from(m[3], 'base64') }
}
