import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/lib/api/auth";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { ErrorState } from "@/components/feedback/error-state";

import { ClientReportsLibrary } from "@/features/stakeholders/client/ClientReportsLibrary";
import { ClientWorkspaceHeader } from "@/features/stakeholders/client/ClientWorkspaceHeader";
const ClientCustomExport = lazy(() =>
  import("@/features/stakeholders/client/ClientCustomExport").then((m) => ({
    default: m.ClientCustomExport,
  })),
);
const ClientBilling = lazy(() =>
  import("@/features/stakeholders/client/ClientBilling").then((m) => ({
    default: m.ClientBilling,
  })),
);

export const Route = createFileRoute("/client-portal/reports")({
  validateSearch: (input: Record<string, unknown>): { view?: "custom" | "invoices" } => ({
    view: input["view"] === "custom" || input["view"] === "invoices" ? input["view"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Reports — Sapling Global" }] }),
  component: ClientReportsPage,
});

function ClientReportsPage() {
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const can = (permission: string) =>
    !!session.data?.permissions.some((p) => p === "*" || p === permission);
  return (
    <>
      <ClientWorkspaceHeader
        title="Reports"
        description="One place for signed reports, customised data exports, invoices and statements."
      />
      <div
        className="client-segments mb-4 w-fit max-w-full flex-wrap"
        role="group"
        aria-label="Report views"
      >
        {[
          { value: undefined, label: "Published reports", allowed: can("report:read") },
          { value: "custom" as const, label: "Customise export", allowed: can("case:read") },
          { value: "invoices" as const, label: "Invoices & statements", allowed: can("case:read") },
        ]
          .filter((tab) => tab.allowed)
          .map((tab) => (
            <button
              key={tab.label}
              aria-pressed={view === tab.value}
              onClick={() => void navigate({ search: { view: tab.value } })}
            >
              {tab.label}
            </button>
          ))}
      </div>
      {session.isPending ? (
        <ListSkeleton rows={3} />
      ) : !can(view ? "case:read" : "report:read") ? (
        <ErrorState
          title="Report access unavailable"
          description="Your account does not have access to this report view."
        />
      ) : (
        <Suspense fallback={<ListSkeleton rows={4} />}>
          {view === "custom" ? (
            <ClientCustomExport />
          ) : view === "invoices" ? (
            <ClientBilling reportMode />
          ) : (
            <ClientReportsLibrary />
          )}
        </Suspense>
      )}
    </>
  );
}
