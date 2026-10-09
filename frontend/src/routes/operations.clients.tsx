import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CompanyRmBoard, type CompanySearch } from "@/features/operations/clients/CompanyRmBoard";

export const Route = createFileRoute("/operations/clients")({
  validateSearch: (input: Record<string, unknown>): CompanySearch => {
    const page = Number(input["page"]);
    const q = typeof input["q"] === "string" ? input["q"].trim().slice(0, 120) : "";
    return {
      view:
        input["view"] === "without_rm" || input["view"] === "with_rm" ? input["view"] : undefined,
      q: q || undefined,
      page: Number.isSafeInteger(page) && page > 1 && page <= 100_000 ? page : undefined,
    };
  },
  head: () => ({ meta: [{ title: "Companies & RMs — Sapling Global Operations" }] }),
  component: CompaniesPage,
});

function CompaniesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <>
      <header className="client-heading">
        <div>
          <h1>Companies & RMs</h1>
          <p>Assign one RM to each company. Its cases reach that RM automatically.</p>
        </div>
      </header>
      <CompanyRmBoard
        search={search}
        onChange={(patch) =>
          void navigate({ search: (current) => ({ ...current, ...patch }), resetScroll: false })
        }
      />
    </>
  );
}
