import type { OnboardingSearch } from "./OpsOnboardingBoard";

const ID = /^[A-Za-z0-9-]{1,64}$/;

/** URL state for the sign-up board (deep links from notifications use ?company=). */
export function parseOnboardingSearch(input: Record<string, unknown>): OnboardingSearch {
  const page = Number(input["page"]);
  const q = typeof input["q"] === "string" ? input["q"].trim().slice(0, 80) : "";
  const view = input["view"];
  const status = input["status"];
  return {
    company:
      typeof input["company"] === "string" && ID.test(input["company"])
        ? input["company"]
        : undefined,
    view: view === "NEEDS_RM" || view === "SUBMITTED" || view === "IN_PROGRESS" ? view : undefined,
    status: status === "ACTIVE" || status === "SUSPENDED" ? status : undefined,
    q: q || undefined,
    page: Number.isSafeInteger(page) && page > 1 && page <= 10_000 ? page : undefined,
  };
}
