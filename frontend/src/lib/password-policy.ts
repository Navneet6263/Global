export const MIN_USER_PASSWORD_LENGTH = 7;

const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const NUMBERS = "23456789";
const SYMBOLS = "!@#$%*+-_";
const PASSWORD_ALPHABET = `${UPPERCASE}${LOWERCASE}${NUMBERS}${SYMBOLS}`;

export function getPasswordRequirements(password: string) {
  return [
    {
      text: `At least ${MIN_USER_PASSWORD_LENGTH} characters`,
      ok: password.length >= MIN_USER_PASSWORD_LENGTH,
    },
    {
      text: "Upper and lowercase letters",
      ok: /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    { text: "At least one number", ok: /\d/.test(password) },
    { text: "At least one special character", ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function generateTemporaryPassword(): string {
  const characters = [
    randomCharacter(UPPERCASE),
    randomCharacter(LOWERCASE),
    randomCharacter(NUMBERS),
    randomCharacter(SYMBOLS),
    ...Array.from({ length: MIN_USER_PASSWORD_LENGTH - 4 }, () =>
      randomCharacter(PASSWORD_ALPHABET),
    ),
  ];

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex]!, characters[index]!];
  }

  return characters.join("");
}

function randomCharacter(alphabet: string): string {
  return alphabet[secureRandomIndex(alphabet.length)]!;
}

function secureRandomIndex(limit: number): number {
  const maximum = Math.floor(0x1_0000_0000 / limit) * limit;
  const random = new Uint32Array(1);

  do {
    crypto.getRandomValues(random);
  } while (random[0]! >= maximum);

  return random[0]! % limit;
}
