import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckRequirementsPanel } from "@/features/cases/CheckRequirementsPanel";
import { getSession } from "@/lib/api/auth";
import { apiRequest, saveBlob } from "@/lib/backend-api/client";
import type { CaseServicePackage } from "@/lib/backend-api/cases";
import { intakeHeaders, parseClientCsv } from "./client-intake-csv";
import { useClientIntake } from "./use-client-intake";

/** Bulk upload for internal teams: they first choose whose employees these are. */
export function InternalBulkIntake() {
  return <ClientBulkIntake internal />;
}

export function ClientBulkIntake({ internal = false }: { internal?: boolean }) {
  const [open, setOpen] = useState(false);
  const [packageId, setPackageId] = useState("");
  const [clientId, setClientId] = useState("");
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
    enabled: internal,
  });
  const clients = useQuery({
    queryKey: ["bulk-intake", "clients"],
    queryFn: () =>
      apiRequest<{ items: Array<{ id: string; name: string }> }>("/bulk-intake/clients"),
    enabled: internal && open,
  });
  const { rows, setCandidates, running, start } = useClientIntake();
  const catalog = useQuery({
    queryKey: ["case-catalog", internal ? clientId : "own"],
    queryFn: () =>
      apiRequest<{ items: CaseServicePackage[] }>(
        internal ? `/bulk-intake/catalog?clientId=${clientId}` : "/cases/catalog",
      ),
    enabled: open && (!internal || Boolean(clientId)),
  });
  const chosen = catalog.data?.items.find((item) => item.id === packageId);
  // A view-only Platform Admin cannot create cases; the server refuses it too.
  if (internal && session.data?.viewOnly) return null;
  const created = rows.filter((row) => row.status === "created").length;
  const attempted = rows.some((row) => row.status !== "ready");
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!running) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        {internal ? (
          <Button variant="outline">
            <Upload className="size-4" aria-hidden /> Bulk upload
          </Button>
        ) : (
          <button className="inline-flex h-9 items-center gap-2 rounded-full border border-mint/30 bg-mint-soft/60 px-4 text-xs font-semibold text-mint-deep">
            <Upload className="size-3.5" /> Import CSV
          </button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
        onInteractOutside={(e) => {
          if (running) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (running) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Import candidate cases</DialogTitle>
          <DialogDescription>
            Upload up to 50 candidates{internal ? " for one company" : " for your organisation"}.
            Each row creates its own verification case and consent request.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-info/20 bg-info-soft/35 p-4">
            <p className="max-w-md text-xs text-muted-foreground">
              Use CSV exported from Excel. Candidate name and email or Indian mobile are required.
              {internal
                ? "Choose the company below; every row goes to that company."
                : "Your client workspace is applied automatically."}
            </p>
            <button
              onClick={() =>
                saveBlob(
                  new Blob([`${intakeHeaders}\r\n`], { type: "text/csv" }),
                  "sapling-candidate-import.csv",
                )
              }
              className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-2 text-xs font-semibold"
            >
              <Download className="size-3.5" /> Template
            </button>
          </div>
          {internal ? (
            <label className="block space-y-1 text-xs font-medium">
              Company
              <select
                value={clientId}
                disabled={running || attempted}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setPackageId("");
                }}
                className="h-10 w-full rounded-xl border border-border bg-card px-3"
              >
                <option value="">Choose a company</option>
                {clients.data?.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block space-y-1 text-xs font-medium">
            Verification package
            <select
              value={packageId}
              disabled={running || attempted || (internal && !clientId)}
              onChange={(e) => setPackageId(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-card px-3"
            >
              <option value="">Choose an authorised package</option>
              {catalog.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.checks.length} checks
                </option>
              ))}
            </select>
          </label>
          {chosen?.checkRequirements?.length ? (
            <CheckRequirementsPanel requirements={chosen.checkRequirements} />
          ) : null}
          {catalog.error ? (
            <p role="alert" className="text-xs text-critical">
              {catalog.error.message}
            </p>
          ) : null}
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Candidate CSV"
            disabled={running || attempted}
            className="w-full rounded-xl border border-dashed border-mint/40 bg-mint-soft/20 p-4 text-xs"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 200_000) throw new Error("CSV must be smaller than 200 KB");
                setCandidates(parseClientCsv(await file.text()));
              } catch (error) {
                setCandidates([]);
                toast.error(error instanceof Error ? error.message : "CSV could not be read");
              }
            }}
          />
          {rows.length ? (
            <>
              <div className="flex justify-between text-xs">
                <span>{rows.length} candidates ready for review</span>
                <span className="font-semibold text-mint-deep">{created} created</span>
              </div>
              <div className="max-h-64 overflow-auto rounded-2xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="p-3">Candidate</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row) => (
                      <tr key={row.key}>
                        <td className="p-3 font-medium">{row.input.fullName}</td>
                        <td className="p-3 text-muted-foreground">
                          {row.input.email ?? row.input.phone}
                        </td>
                        <td
                          className={`p-3 ${row.status === "failed" ? "text-critical" : "text-mint-deep"}`}
                        >
                          {row.caseNumber ?? row.error ?? row.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Keep this window open during import. Successful rows are skipped when retrying.
                Candidate upload links can be issued from each case workspace.
              </p>
              <div className="flex justify-end gap-2">
                {attempted && !running ? (
                  <button
                    onClick={() => {
                      setCandidates([]);
                      setPackageId("");
                    }}
                    className="rounded-full border border-border px-4 py-2 text-xs"
                  >
                    New import
                  </button>
                ) : null}
                <button
                  disabled={running || !packageId || created === rows.length}
                  onClick={() =>
                    void start(
                      packageId,
                      internal ? { endpoint: "/bulk-intake/rows", clientId } : undefined,
                    )
                  }
                  className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                >
                  {running
                    ? `Creating ${created} / ${rows.length}…`
                    : attempted
                      ? "Retry failed rows"
                      : `Create ${rows.length} cases`}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
