/**
 * A one-time password for a new or reset user ID. Generated in the browser, shown
 * once, and meets the server password policy; the user must change it at sign-in.
 */
export function temporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const body = Array.from(
    bytes,
    (value) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"[value % 57],
  ).join("");
  return `${body}@7a`;
}
