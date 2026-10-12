export interface CompanySearch {
  view?: "without_rm" | "with_rm";
  q?: string;
  page?: number;
}

/** URL search for the Companies & RMs pages (Operations and Platform Admin). */
export function parseCompanySearch(input: Record<string, unknown>): CompanySearch {
  const page = Number(input["page"]);
  const q = typeof input["q"] === "string" ? input["q"].trim().slice(0, 120) : "";
  return {
    view: input["view"] === "without_rm" || input["view"] === "with_rm" ? input["view"] : undefined,
    q: q || undefined,
    page: Number.isSafeInteger(page) && page > 1 && page <= 100_000 ? page : undefined,
  };
}
