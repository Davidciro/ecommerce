const LOCALE_TAGS: Record<string, string> = { fr: 'fr-CH', de: 'de-CH', es: 'es-ES' }

/** Formatea un importe (CHF/EUR) según el idioma. */
export function formatMoney(amount: number | string | null | undefined, currency: string, locale = 'fr'): string {
  const n = typeof amount === 'string' ? Number(amount) : (amount ?? 0)
  return new Intl.NumberFormat(LOCALE_TAGS[locale] ?? locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0)
}

export function formatNumber(value: number | string | null | undefined, locale = 'fr', digits = 0): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0)
  return new Intl.NumberFormat(LOCALE_TAGS[locale] ?? locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(n) ? n : 0)
}

export function formatDate(value: string | Date | null | undefined, locale = 'fr', withTime = false): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale] ?? locale, {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
    timeZone: 'Europe/Zurich',
  }).format(d)
}

/** Redondeo comercial a 2 decimales (evita 0.1 + 0.2 = 0.30000000000000004). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
