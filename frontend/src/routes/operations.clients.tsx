import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AddCompanyButton } from "@/features/operations/clients/AddCompanyButton";
import { CompanyRmBoard } from "@/features/operations/clients/CompanyRmBoard";
import { parseCompanySearch } from "@/features/operations/clients/company-search";

export const Route = createFileRoute("/operations/clients")({
  validateSearch: parseCompanySearch,
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
        <AddCompanyButton
          onCreated={(client) =>
            void navigate({ to: "/operations/onboarding", search: { company: client.id } })
          }
        />
      </header>
      <CompanyRmBoard
        search={search}
        onSetUp={(company) => void navigate({ to: "/operations/onboarding", search: { company } })}
        onChange={(patch) =>
          void navigate({ search: (current) => ({ ...current, ...patch }), resetScroll: false })
        }
      />
    </>
  );
}
