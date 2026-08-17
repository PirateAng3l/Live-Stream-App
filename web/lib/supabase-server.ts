import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * The anon key is meant to be public (it ships to every browser) — real
 * access control is RLS (backend/supabase/migrations) plus, for viewing a
 * match, the sign-in gate in lib/auth.ts. Nothing sensitive is ever
 * fetched through this client.
 */
export const isBackendConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

/**
 * Cookie-aware Supabase client for Server Components and Route Handlers.
 * Behaves as anonymous when there's no session cookie and as the signed-in
 * parent when there is — callers don't need to branch on that themselves.
 *
 * Must be created fresh per request (it closes over the current request's
 * cookies via next/headers), never cached at module scope.
 */
export function createSupabaseServerClient() {
  if (!isBackendConfigured) {
    throw new Error(
      "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see web/README.md)",
    );
  }
  const cookieStore = cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components can't write cookies (only Server Actions and
          // Route Handlers can) — harmless here as long as middleware.ts is
          // also refreshing the session on every request, which it is.
        }
      },
    },
  });
}
