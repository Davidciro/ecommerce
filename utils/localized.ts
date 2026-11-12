/** Helpers para columnas JSONB multilenguaje {"es": "", "fr": "", "de": ""}. */
export const LOCALES = ['fr', 'de', 'es'] as const
export type Locale = (typeof LOCALES)[number]
export type Localized<T = string> = Record<Locale, T>

export function emptyLocalized(): Localized {
  return { fr: '', de: '', es: '' }
}

export function emptyLocalizedArray(): Localized<string[]> {
  return { fr: [], de: [], es: [] }
}

/** Normaliza un valor JSON (posiblemente incompleto) a Localized<string>. */
export function toLocalized(value: unknown): Localized {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    fr: typeof v.fr === 'string' ? v.fr : '',
    de: typeof v.de === 'string' ? v.de : '',
    es: typeof v.es === 'string' ? v.es : '',
  }
}

export function toLocalizedArray(value: unknown): Localized<string[]> {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const arr = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [])
  return { fr: arr(v.fr), de: arr(v.de), es: arr(v.es) }
}

/** Texto en el idioma pedido; si está vacío, cae al primer idioma con contenido (fr → de → es). */
export function pickLocalized(value: unknown, locale: string, fallback: Locale = 'fr'): string {
  const l = toLocalized(value)
  const wanted = (LOCALES as readonly string[]).includes(locale) ? (locale as Locale) : fallback
  if (l[wanted].trim()) return l[wanted]
  if (l[fallback].trim()) return l[fallback]
  return LOCALES.map(k => l[k]).find(s => s.trim()) ?? ''
}

/** Idiomas sin contenido (para indicadores de "falta traducir"). */
export function missingLocales(value: unknown): Locale[] {
  const l = toLocalized(value)
  return LOCALES.filter(k => !l[k].trim())
}
