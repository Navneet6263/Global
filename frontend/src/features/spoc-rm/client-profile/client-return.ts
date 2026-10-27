/**
 * "Back to <client>" after the RM leaves a client's profile to work elsewhere (cases,
 * pricing, MIS, payments). Kept for this browser tab only; never business data.
 */
const KEY = "sg-rm-return-client";

export interface ClientReturn {
  id: string;
  name: string;
}

export function rememberClientReturn(client: ClientReturn) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(client));
  } catch {
    // Storage blocked (private window): the bar simply does not show.
  }
}

export function readClientReturn(): ClientReturn | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as ClientReturn | null;
    return value && typeof value.id === "string" && typeof value.name === "string" ? value : null;
  } catch {
    return null;
  }
}

export function clearClientReturn() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
