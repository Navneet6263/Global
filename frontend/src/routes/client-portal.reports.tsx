import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/lib/api/auth";
import { EmptyState, Loading, Tabs } from "@/kit";

import { ClientReportsLibrary } from "@/features/stakeholders/client/ClientReportsLibrary";
import { ClientWorkspaceHeader } from "@/features/stakeholders/client/ClientWorkspaceHeader";
const ClientCustomExport = lazy(() =>
  import("@/features/stakeholders/client/ClientCustomExport").then((m) => ({
    default: m.ClientCustomExport,
  })),
);
const ClientMisReports = lazy(() =>
  import("@/features/stakeholders/client/ClientMisReports").then((m) => ({
    default: m.ClientMisReports,
  })),
);
const ClientBilling = lazy(() =>
  import("@/features/stakeholders/client/ClientBilling").then((m) => ({
    default: m.ClientBilling,
  })),
);

export const Route = createFileRoute("/client-portal/reports")({
  validateSearch: (input: Record<string, unknown>): { view?: "custom" | "invoices" | "mis" } => ({
    view:
      input["view"] === "custom" || input["view"] === "invoices" || input["view"] === "mis"
        ? input["view"]
        : undefined,
  }),
  head: () => ({ meta: [{ title: "Reports — Sapling Global" }] }),
  component: ClientReportsPage,
});

const HEADINGS = {
  published: {
    title: "Final reports",
    description: "Released verification reports to download, share and verify.",
  },
  mis: {
    title: "MIS & Excel",
    description: "Ready-made MIS, bulk report downloads and scheduled emails.",
  },
  custom: {
    title: "Custom export",
    description: "Pick the filters and columns you need, preview, then download.",
  },
  invoices: {
    title: "Invoices & statements",
    description: "Invoice PDFs and monthly statements for your records.",
  },
} as const;

function ClientReportsPage() {
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const can = (permission: string) =>
    !!session.data?.permissions.some((p) => p === "*" || p === permission);
  const heading = HEADINGS[view ?? "published"];
  return (
    <>
      <ClientWorkspaceHeader title={heading.title} description={heading.description} />
      <Tabs
        label="Report views"
        value={view ?? "published"}
        onChange={(value) =>
          void navigate({
            search: { view: value === "published" ? undefined : (value as typeof view) },
          })
        }
        tabs={(
          [
            ["published", "Final reports", can("report:read")],
            ["mis", "MIS & Excel", can("case:read")],
            ["custom", "Custom export", can("case:read")],
            ["invoices", "Invoices & statements", can("case:read")],
          ] as const
        )
          .filter(([, , allowed]) => allowed)
          .map(([value, label]) => [value, label] as const)}
      />
      {session.isPending ? (
        <Loading />
      ) : !can(view ? "case:read" : "report:read") ? (
        <EmptyState title="Report access unavailable">
          Your account does not have access to this report view.
        </EmptyState>
      ) : (
        <Suspense fallback={<Loading>Loading this view…</Loading>}>
          {view === "mis" ? (
            <ClientMisReports />
          ) : view === "custom" ? (
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
