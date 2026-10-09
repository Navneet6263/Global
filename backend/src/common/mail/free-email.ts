/** Personal mailbox providers: allowed for sign-up, but flagged for Operations review. */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.in",
  "yahoo.co.in",
  "ymail.com",
  "rediffmail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
  "yandex.com",
]);

export function emailDomain(email: string | null | undefined): string | null {
  const at = email?.lastIndexOf("@") ?? -1;
  return at > 0
    ? email!
        .slice(at + 1)
        .trim()
        .toLowerCase()
    : null;
}

export function isFreeEmail(email: string | null | undefined): boolean {
  const domain = emailDomain(email);
  return Boolean(domain && FREE_EMAIL_DOMAINS.has(domain));
}
