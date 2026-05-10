/**
 * Client-side permission check.
 * Mirrors the server-side hasPermission logic in lib/authz.ts
 */
export function clientHasPermission(
  role: string | undefined,
  permissions: string[] | undefined,
  permission: string
): boolean {
  if (role === 'admin') return true;
  return (permissions ?? []).includes(permission);
}
