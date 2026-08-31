import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitizes HTML produced by marked.parse() on AI-generated content before
 * it's passed to dangerouslySetInnerHTML.
 *
 * Was previously a hand-rolled set of regex replacements (strip <script>,
 * on* attributes, javascript: hrefs). Regex-based HTML "sanitization" is a
 * well-known bypassable pattern — it has no real HTML parser behind it, so
 * malformed/nested tags, HTML-entity-encoded scheme prefixes
 * (`javascript&#58;...`), and other mutation-XSS techniques can survive it.
 * Replaced with DOMPurify (via isomorphic-dompurify, which uses jsdom so
 * this also works correctly during Next.js SSR of the 'use client'
 * components that call it, not just in the browser).
 *
 * Explicit allowlist rather than DOMPurify's default profile — this only
 * ever needs to render markdown output (headings, lists, tables, code
 * blocks, basic inline formatting, links, images), so there's no reason to
 * allow the full default HTML surface.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark', 'sub', 'sup',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a', 'img',
  'div', 'span',
]

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel']

export function sanitizeAiHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i, // blocks javascript:/data:/vbscript: etc.
    ADD_ATTR: ['target'],
  })
}
