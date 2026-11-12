/**
 * Plantilla base de emails: tablas + estilos en línea (compatibilidad con Outlook/Gmail).
 */
import { escapeHtml } from '../utils/html'

export interface LayoutOptions {
  lang: string
  storeName: string
  siteUrl: string
  preheader?: string
  bodyHtml: string
  footerHtml?: string
}

export function renderEmailLayout(o: LayoutOptions): string {
  const pre = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(o.preheader)}</div>`
    : ''
  return `<!doctype html>
<html lang="${escapeHtml(o.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(o.storeName)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
      <tr><td style="padding:24px 32px;border-bottom:1px solid #e4e4e7">
        <a href="${escapeHtml(o.siteUrl)}" style="font-size:20px;font-weight:bold;color:#18181b;text-decoration:none">${escapeHtml(o.storeName)}</a>
      </td></tr>
      <tr><td style="padding:32px;font-size:15px;line-height:1.6">${o.bodyHtml}</td></tr>
      <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;line-height:1.5;color:#71717a">
        ${o.footerHtml ?? ''}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}
