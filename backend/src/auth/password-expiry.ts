/** Passwords older than this many days must be changed at the next sign-in (0 = never). */
export const DEFAULT_PASSWORD_MAX_AGE_DAYS = 90;

export function passwordExpired(
  passwordChangedAt: Date,
  maxAgeDays: number,
  now = new Date(),
) {
  return (
    maxAgeDays > 0 &&
    now.getTime() - passwordChangedAt.getTime() >= maxAgeDays * 86_400_000
  );
}
