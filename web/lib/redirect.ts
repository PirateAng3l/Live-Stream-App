/**
 * The post-sign-in redirect target comes from a query param a visitor
 * controls (?redirect=...), so it has to be validated before use — an
 * unchecked value here is a classic open-redirect hole (?redirect=https://evil.example
 * would otherwise happily send someone off this site right after they
 * authenticate). Only a same-site relative path is accepted; anything else
 * falls back to the homepage.
 */
export function safeRedirectTarget(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}
