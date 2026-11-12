import type { AuthError } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'

export type Profile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'email' | 'full_name' | 'phone' | 'role' | 'preferred_locale'
>
export type AppLocale = Database['public']['Enums']['locale_code']

const PROFILE_COLUMNS = 'id, email, full_name, phone, role, preferred_locale'

/** Traduce errores de Supabase Auth a claves i18n (auth.errors.*) */
export function authErrorKey(error: Pick<AuthError, 'code' | 'message' | 'status'> | null | undefined): string {
  switch (error?.code) {
    case 'invalid_credentials':
      return 'auth.errors.invalid_credentials'
    case 'email_not_confirmed':
      return 'auth.errors.email_not_confirmed'
    case 'user_already_exists':
    case 'email_exists':
      return 'auth.errors.user_exists'
    case 'weak_password':
      return 'auth.errors.weak_password'
    case 'email_address_invalid':
    case 'validation_failed':
      return 'auth.errors.invalid_email'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'auth.errors.rate_limited'
  }
  if (error?.status === 429) return 'auth.errors.rate_limited'
  return 'auth.errors.generic'
}

/**
 * Estado y acciones de autenticación.
 *
 * Seguridad: `isAdmin` es solo para la UI. La autorización real la imponen
 * las políticas RLS en Postgres y `requireAdmin()` en las server routes.
 */
export function useAuth() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()
  const profile = useState<Profile | null>('auth:profile', () => null)
  const localePath = useLocalePath()
  // No usar useI18n(): solo funciona en setup() de componentes y useAuth también se
  // llama desde middlewares de ruta. $i18n está disponible en todo el contexto Nuxt.
  const locale = useNuxtApp().$i18n.locale
  const requestUrl = useRequestURL()

  const userId = computed(() => (user.value?.sub as string | undefined) ?? null)
  const isLoggedIn = computed(() => userId.value !== null)
  // El perfil debe pertenecer al usuario actual (evita estado obsoleto tras cambiar de cuenta)
  const currentProfile = computed(() =>
    profile.value && profile.value.id === userId.value ? profile.value : null,
  )
  const isAdmin = computed(() => currentProfile.value?.role === 'admin')
  const displayName = computed(
    () => currentProfile.value?.full_name || currentProfile.value?.email || (user.value?.email as string | undefined) || '',
  )

  /** URL absoluta de callback en el idioma actual (para emails y OAuth). */
  function callbackUrl(params: Record<string, string> = {}): string {
    const url = new URL(localePath('/auth/callback'), requestUrl.origin)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    return url.toString()
  }

  async function fetchProfile(force = false): Promise<Profile | null> {
    if (!userId.value) {
      profile.value = null
      return null
    }
    if (!force && currentProfile.value) return currentProfile.value

    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId.value)
      .maybeSingle()

    if (error) throw error
    profile.value = data
    return data
  }

  async function signInWithPassword(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) return { error }
    // Asegura que useSupabaseUser refleje la nueva sesión antes de leer el perfil
    const { data: claims } = await supabase.auth.getClaims()
    user.value = claims?.claims ?? null
    await fetchProfile(true)
    return { error: null, session: data.session }
  }

  async function signUp(input: { email: string, password: string, fullName: string, redirect?: string }) {
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        // handle_new_user() usa full_name y locale; el rol NUNCA viene de aquí.
        data: { full_name: input.fullName.trim(), locale: locale.value },
        emailRedirectTo: callbackUrl(input.redirect ? { redirect: input.redirect } : {}),
      },
    })
    if (error) return { error, needsConfirmation: false }
    // Sin sesión = el proyecto exige confirmar el email
    return { error: null, needsConfirmation: !data.session }
  }

  async function signInWithGoogle(redirect?: string) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl(redirect ? { redirect } : {}),
        queryParams: { prompt: 'select_account' },
      },
    })
    return { error }
  }

  async function sendPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: callbackUrl({ type: 'recovery' }),
    })
    return { error }
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    return { error }
  }

  /** Solo columnas permitidas por los GRANT de columna en profiles. */
  async function updateProfile(patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'preferred_locale'>>) {
    if (!userId.value) return { error: new Error('not_authenticated') }
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId.value)
      .select(PROFILE_COLUMNS)
      .single()
    if (!error) profile.value = data
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
    clearNuxtState(['auth:newsletter'])
    await navigateTo(localePath('/'))
  }

  return {
    user,
    userId,
    profile: currentProfile,
    isLoggedIn,
    isAdmin,
    displayName,
    fetchProfile,
    signInWithPassword,
    signUp,
    signInWithGoogle,
    sendPasswordReset,
    updatePassword,
    updateProfile,
    signOut,
  }
}
