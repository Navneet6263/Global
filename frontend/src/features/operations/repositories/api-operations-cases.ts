import { listCases, type CaseListItem } from "@/lib/backend-api/cases";

export async function listAllOperationCases(
  input: { search?: string; status?: string; clientId?: string } = {},
): Promise<CaseListItem[]> {
  const items: CaseListItem[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await listCases({ ...input, limit: 100, cursor });
    items.push(...page.items);
    if (!page.nextCursor) break;
    if (seen.has(page.nextCursor)) throw new Error("Case pagination returned a repeated cursor");
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}
