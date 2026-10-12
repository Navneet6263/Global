import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { AddCompanyButton } from "@/features/operations/clients/AddCompanyButton";
import { CompanyRmBoard } from "@/features/operations/clients/CompanyRmBoard";
import { parseCompanySearch } from "@/features/operations/clients/company-search";

export const Route = createFileRoute("/admin/company-rms")({
  validateSearch: parseCompanySearch,
  head: () => ({ meta: [{ title: "Companies & RMs — Sapling Global" }] }),
  component: AdminCompanyRmsPage,
});

/** Platform Admin company set-up: add a company and assign its RM (both audited). */
function AdminCompanyRmsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies & RMs"
        description="Add a company and give it one RM. Its new cases reach that RM automatically."
        actions={
          <AddCompanyButton
            onCreated={(client) =>
              void navigate({ search: { q: client.code }, resetScroll: false })
            }
          />
        }
      />
      <CompanyRmBoard
        search={search}
        intakeRules={false}
        onChange={(patch) =>
          void navigate({ search: (current) => ({ ...current, ...patch }), resetScroll: false })
        }
      />
    </div>
  );
}
