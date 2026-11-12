// Opciones de vue-i18n (formatos de número/fecha por idioma).
// Los textos de UI viven en i18n/locales/{fr,de,es}.json
const currency = { style: 'currency', currency: 'CHF', currencyDisplay: 'code' } as const
const dateShort = { year: 'numeric', month: '2-digit', day: '2-digit' } as const
const dateLong = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' } as const

export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'fr',
  missingWarn: false,
  fallbackWarn: false,
  numberFormats: {
    fr: { currency },
    de: { currency },
    es: { currency },
  },
  datetimeFormats: {
    fr: { short: dateShort, long: dateLong },
    de: { short: dateShort, long: dateLong },
    es: { short: dateShort, long: dateLong },
  },
}))
