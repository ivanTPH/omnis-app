/**
 * Lightweight HTML sanitizer — strips <script>, <iframe>, <object>, <embed>,
 * and all on* event attributes from an HTML string.
 * Used to make AI-generated markdown output safe for dangerouslySetInnerHTML.
 * Not a full XSS solution — do not use for untrusted external HTML.
 */
export function sanitizeAiHtml(html: string): string {
  return html
    // Remove dangerous block elements entirely (including their content)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    // Remove on* event handlers (onclick, onload, onerror, etc.)
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '')
    // Remove javascript: hrefs
    .replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"')
    .replace(/src\s*=\s*["']\s*javascript:[^"']*["']/gi, '')
}
