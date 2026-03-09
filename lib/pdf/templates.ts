/** Shared base CSS for all PDF templates */
export const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    background: #fff;
  }
  h1 { font-size: 18pt; font-weight: 700; color: #1e3a5f; margin-bottom: 4pt; }
  h2 { font-size: 13pt; font-weight: 700; color: #2563eb; margin: 14pt 0 6pt; border-bottom: 1.5pt solid #e5e7eb; padding-bottom: 3pt; }
  h3 { font-size: 11pt; font-weight: 600; color: #374151; margin: 10pt 0 4pt; }
  p  { margin-bottom: 5pt; }
  ul, ol { padding-left: 18pt; margin-bottom: 6pt; }
  li { margin-bottom: 2pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10pt; font-size: 10pt; }
  th { background: #2563eb; color: #fff; font-weight: 600; padding: 5pt 8pt; text-align: left; }
  td { padding: 5pt 8pt; border-bottom: 0.5pt solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .badge {
    display: inline-block;
    padding: 1pt 6pt;
    border-radius: 4pt;
    font-size: 8pt;
    font-weight: 600;
    background: #dbeafe;
    color: #1d4ed8;
    margin-right: 4pt;
  }
  .card {
    border: 1pt solid #e5e7eb;
    border-radius: 6pt;
    padding: 10pt 12pt;
    margin-bottom: 10pt;
    background: #fafafa;
  }
  .card-blue { border-left: 3pt solid #2563eb; background: #eff6ff; }
  .card-green { border-left: 3pt solid #16a34a; background: #f0fdf4; }
  .card-amber { border-left: 3pt solid #d97706; background: #fffbeb; }
  .meta { font-size: 9pt; color: #6b7280; }
  .page-break { page-break-after: always; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; }
  .text-muted { color: #6b7280; }
  .text-sm { font-size: 9pt; }
  .spacer { height: 8pt; }
  .divider { border: none; border-top: 0.5pt solid #e5e7eb; margin: 10pt 0; }
`

/** Wraps template content in a full printable HTML document */
export function pdfShell(
  content:    string,
  title:      string,
  schoolName: string,
  extraCss?:  string,
): string {
  const now = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(title)}</title>
  <style>
    ${BASE_CSS}
    ${extraCss ?? ''}
    .pdf-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 10pt;
      border-bottom: 2pt solid #2563eb;
      margin-bottom: 16pt;
    }
    .pdf-header .school { font-size: 10pt; font-weight: 600; color: #6b7280; }
    .pdf-header .doc-title { font-size: 9pt; color: #9ca3af; text-align: right; }
    .pdf-header .doc-date  { font-size: 8pt; color: #9ca3af; text-align: right; }
  </style>
</head>
<body>
  <div class="pdf-header">
    <div class="school">${escHtml(schoolName)}</div>
    <div>
      <div class="doc-title">${escHtml(title)}</div>
      <div class="doc-date">${escHtml(now)}</div>
    </div>
  </div>
  ${content}
</body>
</html>`
}

export function escHtml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
