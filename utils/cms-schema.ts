/**
 * Esquema de edición de site_sections.
 *  - content:  campos traducibles {fr, de, es}
 *  - settings: campos no traducibles (path = ruta dentro del JSON settings)
 * Las etiquetas salen de adm.cms.fields.<label ?? key>.
 */
export type ContentFieldType = 'text' | 'textarea' | 'markdown'
export type SettingFieldType = 'text' | 'url' | 'email' | 'number' | 'boolean' | 'image' | 'lines' | 'date'

export interface ContentField { key: string, type: ContentFieldType, max?: number }
export interface SettingField { path: string[], type: SettingFieldType, label: string, hint?: string }
export interface SectionSchema { content: ContentField[], settings: SettingField[] }

const legal = (withDate = true): SectionSchema => ({
  content: [
    { key: 'title', type: 'text', max: 200 },
    { key: 'body', type: 'markdown', max: 50000 },
  ],
  settings: withDate ? [{ path: ['last_updated'], type: 'date', label: 'last_updated' }] : [],
})

export const CMS_SCHEMA: Record<string, SectionSchema> = {
  'global.header': {
    content: [{ key: 'tagline', type: 'text', max: 200 }],
    settings: [],
  },
  'global.footer': {
    content: [
      { key: 'about_text', type: 'textarea', max: 1000 },
      { key: 'copyright', type: 'text', max: 200 },
    ],
    settings: [
      { path: ['social', 'instagram'], type: 'url', label: 'instagram' },
      { path: ['social', 'facebook'], type: 'url', label: 'facebook' },
    ],
  },
  'global.cookie_banner': {
    content: [
      { key: 'title', type: 'text', max: 200 },
      { key: 'body', type: 'textarea', max: 2000 },
      { key: 'accept_label', type: 'text', max: 60 },
      { key: 'reject_label', type: 'text', max: 60 },
      { key: 'settings_label', type: 'text', max: 60 },
    ],
    settings: [{ path: ['policy_version'], type: 'number', label: 'policy_version', hint: 'policy_version_hint' }],
  },
  'home.hero': {
    content: [
      { key: 'title', type: 'text', max: 120 },
      { key: 'intro', type: 'textarea', max: 1500 },
      { key: 'cta_label', type: 'text', max: 60 },
    ],
    settings: [{ path: ['hero_image_path'], type: 'image', label: 'hero_image_path' }],
  },
  'home.featured': {
    content: [
      { key: 'title', type: 'text', max: 120 },
      { key: 'subtitle', type: 'textarea', max: 500 },
    ],
    settings: [{ path: ['max_items'], type: 'number', label: 'max_items' }],
  },
  'about.story': {
    content: [
      { key: 'title', type: 'text', max: 120 },
      { key: 'history', type: 'markdown', max: 10000 },
      { key: 'what_we_do', type: 'markdown', max: 10000 },
      { key: 'why_we_do_it', type: 'markdown', max: 10000 },
    ],
    settings: [
      { path: ['since_year'], type: 'number', label: 'since_year' },
      { path: ['image_path'], type: 'image', label: 'image_path' },
    ],
  },
  'about.location': {
    content: [
      { key: 'title', type: 'text', max: 120 },
      { key: 'opening_hours', type: 'textarea', max: 1000 },
      { key: 'directions', type: 'textarea', max: 2000 },
    ],
    settings: [
      { path: ['street'], type: 'text', label: 'street' },
      { path: ['postal_code'], type: 'text', label: 'postal_code' },
      { path: ['city'], type: 'text', label: 'city' },
      { path: ['country'], type: 'text', label: 'country' },
      { path: ['latitude'], type: 'number', label: 'latitude' },
      { path: ['longitude'], type: 'number', label: 'longitude' },
      { path: ['map_embed_url'], type: 'url', label: 'map_embed_url', hint: 'map_embed_url_hint' },
      { path: ['map_link_url'], type: 'url', label: 'map_link_url' },
    ],
  },
  'about.contact': {
    content: [
      { key: 'title', type: 'text', max: 120 },
      { key: 'intro', type: 'textarea', max: 1500 },
    ],
    settings: [
      { path: ['contact_person'], type: 'text', label: 'contact_person' },
      { path: ['phones'], type: 'lines', label: 'phones', hint: 'phones_hint' },
      { path: ['email'], type: 'email', label: 'email' },
      { path: ['show_form'], type: 'boolean', label: 'show_form' },
    ],
  },
  'products.header': {
    content: [
      { key: 'title', type: 'text', max: 120 },
      { key: 'intro', type: 'textarea', max: 1500 },
    ],
    settings: [],
  },
  'legal.impressum': legal(false),
  'legal.privacy': legal(),
  'legal.terms': legal(),
  'legal.cookies': legal(),
}

/** Esquema de una sección; para claves desconocidas, deduce campos de texto del contenido. */
export function schemaFor(key: string, content: Record<string, unknown>): SectionSchema {
  return CMS_SCHEMA[key] ?? { content: Object.keys(content).map(k => ({ key: k, type: 'textarea' })), settings: [] }
}

export function getPath(obj: Record<string, unknown>, path: string[]): unknown {
  return path.reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), obj)
}

export function setPath(obj: Record<string, unknown>, path: string[], value: unknown): Record<string, unknown> {
  const [head, ...rest] = path
  if (!head) return obj
  const current = (obj[head] && typeof obj[head] === 'object' ? obj[head] : {}) as Record<string, unknown>
  return { ...obj, [head]: rest.length ? setPath(current, rest, value) : value }
}
