export type PublicBucket = 'product-images' | 'site-assets'

/** URL pública (CDN) de un objeto en un bucket público de Supabase Storage. */
export function useStorageUrl() {
  const { url } = useRuntimeConfig().public.supabase
  return (bucket: PublicBucket, path: string | null | undefined): string | null => {
    if (!path) return null
    const encoded = path.split('/').map(encodeURIComponent).join('/')
    return `${url}/storage/v1/object/public/${bucket}/${encoded}`
  }
}
