/**
 * Conexión a Supabase desde el servidor (Nitro).
 * Las funciones de server/utils se auto-importan en server/api, server/routes y server/middleware.
 *
 * Tres niveles de acceso:
 *  - useServerSupabase(event)  → cliente con la sesión del usuario (cookies). RLS APLICA.
 *                                Úsalo por defecto, también para acciones de admin.
 *  - requireUser / requireAdmin → guardas de autorización para endpoints.
 *  - useSupabaseAdmin(event)   → cliente con SECRET KEY. SALTA RLS. Solo para:
 *                                webhook de Stripe, lectura de store_secrets, checkout_drafts,
 *                                envío de campañas y tareas internas. Nunca devolver al
 *                                cliente datos leídos con él sin filtrarlos.
 */
import type { H3Event } from 'h3'
import type { JwtPayload, SupabaseClient } from '@supabase/supabase-js'
import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
// Import explícito (no vía alias #supabase/database) para que el typecheck del
// proyecto y el de Nitro resuelvan el mismo tipo.
import type { Database } from '../../types/database.types'

/** Cliente tipado con el esquema generado (npm run db:types). */
export type TypedSupabaseClient = SupabaseClient<Database>

/** Cliente con la sesión del usuario actual (o anónimo). Respeta RLS. */
export async function useServerSupabase(event: H3Event): Promise<TypedSupabaseClient> {
  return (await serverSupabaseClient<Database>(event)) as unknown as TypedSupabaseClient
}

/** Cliente privilegiado (secret / service_role key). Ignora RLS: usar con cuidado. */
export function useSupabaseAdmin(event: H3Event): TypedSupabaseClient {
  return serverSupabaseServiceRole<Database>(event) as unknown as TypedSupabaseClient
}

/**
 * Exige un usuario autenticado. Devuelve los claims verificados del JWT
 * (`sub` = id del usuario). Lanza 401 si no hay sesión válida.
 */
export async function requireUser(event: H3Event): Promise<JwtPayload & { sub: string }> {
  let claims: JwtPayload | null = null
  try {
    claims = await serverSupabaseUser(event)
  }
  catch {
    claims = null
  }
  if (!claims?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return claims as JwtPayload & { sub: string }
}

/**
 * Exige rol admin. La comprobación se hace contra la BD (RPC is_admin → profiles.role),
 * no contra el claim app_metadata.role del JWT, que podría estar desactualizado.
 * Lanza 401 sin sesión y 403 si no es admin.
 */
export async function requireAdmin(event: H3Event): Promise<JwtPayload & { sub: string }> {
  const claims = await requireUser(event)
  const client = await useServerSupabase(event)
  // Cast: la firma de .rpc() depende de los tipos generados (types/database.types.ts).
  const { data, error } = await (client as SupabaseClient).rpc('is_admin')
  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Authorization check failed' })
  }
  if (data !== true) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return claims
}
