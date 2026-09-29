/** A selectable branch or client in the user-access forms. */
export interface ScopeOption {
  id: string;
  label: string;
}

const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

export function toggleClient(selected: readonly string[], id: string): string[] {
  return selected.some((entry) => same(entry, id))
    ? selected.filter((entry) => !same(entry, id))
    : [...selected, id];
}

/** Adds every visible client to the selection, keeping the existing order. */
export function selectAllClients(
  selected: readonly string[],
  visible: readonly ScopeOption[],
): string[] {
  const missing = visible
    .map((option) => option.id)
    .filter((id) => !selected.some((entry) => same(entry, id)));
  return [...selected, ...missing];
}

export function filterClientOptions(options: readonly ScopeOption[], text: string): ScopeOption[] {
  const query = text.trim().toLowerCase();
  return query
    ? options.filter((option) => option.label.toLowerCase().includes(query))
    : [...options];
}

export function sameClientSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id) => right.some((other) => same(id, other)));
}

/** "Client A", "Client A, Client B" or "Client A, Client B +1" — never "All branches". */
export function summarizeClientScope(names: readonly string[], shown = 2): string {
  if (!names.length) return "No clients";
  const visible = names.slice(0, shown).join(", ");
  return names.length > shown ? `${visible} +${names.length - shown}` : visible;
}
