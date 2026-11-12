/**
 * Optimización de imágenes en el navegador antes de subirlas a Supabase Storage:
 * redimensiona (lado mayor ≤ maxSize) y convierte a WebP. Solo usar en cliente.
 */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 // límite del bucket product-images
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024 // original aceptado antes de comprimir

export interface OptimizedImage {
  blob: Blob
  width: number
  height: number
  type: string
}

export async function optimizeImage(
  file: File,
  { maxSize = 1600, quality = 0.82, maxBytes = MAX_UPLOAD_BYTES } = {},
): Promise<OptimizedImage> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error('unsupported_type')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('file_too_large')

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  // Baja la calidad progresivamente hasta respetar el límite de tamaño
  let q = quality
  let blob: Blob | null = null
  while (q >= 0.5) {
    blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', q))
    if (blob && blob.size <= maxBytes) break
    q -= 0.1
  }
  if (!blob) throw new Error('encode_failed')
  if (blob.size > maxBytes) throw new Error('file_too_large')

  // Navegadores sin codificador WebP devuelven PNG
  return { blob, width, height, type: blob.type || 'image/webp' }
}

export function extensionFor(type: string): string {
  return type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : type === 'image/avif' ? 'avif' : 'webp'
}
