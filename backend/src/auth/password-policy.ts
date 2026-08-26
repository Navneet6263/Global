export const MIN_USER_PASSWORD_LENGTH = 7;

export const USER_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export const USER_PASSWORD_REQUIREMENTS = `must contain at least ${MIN_USER_PASSWORD_LENGTH} characters, including uppercase, lowercase, number, and special character`;

export function isValidUserPassword(password: string): boolean {
  return (
    password.length >= MIN_USER_PASSWORD_LENGTH &&
    USER_PASSWORD_PATTERN.test(password)
  );
}
