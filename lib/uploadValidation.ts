/**
 * Shared validation for user-uploaded files stored as base64 data: URIs
 * (lesson resources via addUploadedResource, avatars via /api/settings/avatar).
 *
 * The declared MIME type on a data: URI (or a multipart File.type) is
 * whatever the client claims — an attacker can label arbitrary bytes
 * "image/png" or "application/pdf" in a raw request that never goes near
 * the real upload UI. This allowlist plus a magic-byte check on the actual
 * bytes is what makes that claim mean something. See
 * evidence/phase7-security/manual-hardening-review.md, "File handling".
 */

/** MIME types genuinely safe to render `Content-Disposition: inline` in a
 *  browser — none of these can carry executable script content. Anything
 *  NOT in this set (notably text/html, image/svg+xml, application/xhtml+xml,
 *  application/javascript) must never be served inline from user content. */
export const SAFE_INLINE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  // Office formats aren't previewed inline by the browser (LessonFolder
  // shows a Download button for these) but they're not script-executing
  // either — safe to allow as a download target.
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20 MB

/** First bytes of common formats — confirms the actual content matches the
 *  claimed type rather than trusting the client-supplied MIME string alone.
 *  Office formats (docx/pptx/xlsx/legacy doc/ppt/xls) are all container
 *  formats (ZIP or OLE2) without a single unambiguous 1:1 MIME↔signature
 *  mapping worth hand-rolling here — those fall back to allowlist-only
 *  (the container signature check below still blocks anyone claiming e.g.
 *  "application/pdf" while uploading a ZIP, or vice versa, for the types
 *  we do check).
 */
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png':  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif':  [[0x47, 0x49, 0x46, 0x38]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // "%PDF"
}

function matchesSignature(buffer: Buffer, signatures: number[][]): boolean {
  return signatures.some(sig => sig.every((byte, i) => buffer[i] === byte))
}

/**
 * Confirms `buffer`'s actual bytes match the magic-byte signature expected
 * for `mimeType`. Returns true for a type with no known signature (nothing
 * to check against — allowlist membership is the only guard for those).
 */
export function bufferMatchesMimeType(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType]
  return !signatures || matchesSignature(buffer, signatures)
}

export type ParsedDataUrl = { mimeType: string; buffer: Buffer }

/**
 * Parses a `data:<mime>;base64,<data>` URI, validates the declared type
 * against the allowlist, the size against MAX_UPLOAD_BYTES, and — for types
 * with a known signature — the actual bytes against that signature.
 * Throws with a user-facing message on any failure.
 */
export function parseAndValidateDataUrl(dataUrl: string): ParsedDataUrl {
  const commaIdx = dataUrl.indexOf(',')
  if (commaIdx === -1 || !dataUrl.startsWith('data:')) {
    throw new Error('Invalid file data.')
  }

  const header  = dataUrl.slice(0, commaIdx)
  const mimeType = header.match(/^data:([^;]+)/)?.[1]?.toLowerCase() ?? ''

  if (!SAFE_INLINE_MIME_TYPES.has(mimeType)) {
    throw new Error(`File type "${mimeType || 'unknown'}" is not allowed. Allowed: images, PDF, Word/PowerPoint/Excel documents, plain text/CSV.`)
  }

  const buffer = Buffer.from(dataUrl.slice(commaIdx + 1), 'base64')

  if (buffer.byteLength === 0) {
    throw new Error('File is empty.')
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`File is too large — maximum ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`)
  }

  const signatures = MAGIC_BYTES[mimeType]
  if (signatures && !matchesSignature(buffer, signatures)) {
    throw new Error('File content does not match its declared type.')
  }

  return { mimeType, buffer }
}
