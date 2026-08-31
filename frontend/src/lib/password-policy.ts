export const PASSWORD_REQUIREMENTS =
  "7+ characters with uppercase, lowercase, number and special character";

export function isValidUserPassword(value: string) {
  return (
    value.length >= 7 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}
