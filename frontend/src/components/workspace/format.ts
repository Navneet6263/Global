const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Date-time in IST for tables and sheets; blank when missing or invalid. */
export function istText(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return IST.format(new Date(value));
}

export const humanizeCode = (value?: string | null) =>
  value
    ? value
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/^\w/, (c) => c.toUpperCase())
    : "";

/** Loads every page of a cursor list (bounded) for an export. */
export async function collectCursorPages<T>(
  load: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string | null }>,
  maxRows = 2000,
) {
  const rows: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await load(cursor);
    rows.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor && rows.length < maxRows);
  return rows.slice(0, maxRows);
}

/** Loads every numbered page of a list (bounded) for an export. */
export async function collectNumberedPages<T>(
  load: (page: number) => Promise<{ items: T[]; total: number; pageSize: number }>,
  maxRows = 2000,
) {
  const rows: T[] = [];
  for (let page = 1; rows.length < maxRows; page += 1) {
    const result = await load(page);
    rows.push(...result.items);
    if (!result.items.length || page * result.pageSize >= result.total) break;
  }
  return rows.slice(0, maxRows);
}
