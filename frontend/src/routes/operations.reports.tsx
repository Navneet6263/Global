import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { getSession } from "@/lib/api/auth";
import { listAllClients } from "@/lib/api/cases";
import { listAllUsers } from "@/lib/backend-api/users";
import { OpsReportBuilder } from "@/features/operations/reports/OpsReportBuilder";
import { OpsMisCard } from "@/features/operations/reports/OpsMisCard";

export const Route = createFileRoute("/operations/reports")({
  head: () => ({ meta: [{ title: "Reports & MIS — Sapling Global Operations" }] }),
  component: OperationsReports,
});

function OperationsReports() {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const can = (permission: string) =>
    Boolean(session.data?.permissions.some((p) => p === "*" || p === permission));
  const clients = useQuery({
    queryKey: ["clients", "all"],
    queryFn: () => listAllClients(),
    enabled: can("client:read"),
    staleTime: 5 * 60_000,
  });
  const rms = useQuery({
    queryKey: ["users", "SPOC_RM", "all"],
    queryFn: () => listAllUsers("SPOC_RM"),
    enabled: can("user:read"),
    staleTime: 60_000,
  });
  const clientOptions = (clients.data ?? []).map((client) => ({
    value: client.publicId,
    label: client.displayName,
  }));
  const rmOptions = (rms.data?.items ?? []).map((user) => ({
    value: user.id,
    label: user.displayName,
  }));
  return (
    <>
      <header className="client-heading">
        <div>
          <h1>Reports & MIS</h1>
          <p>Case status, TAT, discrepancy, UTV and RM reports with your own columns.</p>
        </div>
      </header>
      <div className="ops-reports-grid">
        <OpsReportBuilder clients={clientOptions} rms={rmOptions} />
        {can("dashboard:read") ? <OpsMisCard clients={clientOptions} /> : null}
      </div>
      <p className="client-report-note">
        Reports include only cases your role and branch can access. Times are in IST. Final
        candidate reports are released by their owning teams, not from this page.
      </p>
    </>
  );
}
