/**
 * Slug SEO en kebab-case ASCII, compatible con la restricción de BD ^[a-z0-9]+(-[a-z0-9]+)*$
 * Transliteración alemana (ä→ae, ö→oe, ü→ue, ß→ss) y eliminación de acentos (é→e, ñ→n).
 */
export function slugify(input: string, maxLength = 80): string {
  const s = input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[œ]/g, 'oe')
    .replace(/[æ]/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s.slice(0, maxLength).replace(/-+$/g, '')
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
