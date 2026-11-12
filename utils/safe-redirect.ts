/**
 * Valida un destino de redirección recibido por query (?redirect=...).
 * Solo admite rutas relativas internas para evitar "open redirects"
 * (p. ej. ?redirect=https://phishing.example o //phishing.example).
 */
export function safeRedirect(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  // Bloquea esquemas incrustados o caracteres de control
  if (/[\u0000-\u001F]/.test(value) || /^\/[a-z][a-z0-9+.-]*:/i.test(value)) return fallback
  return value
}
