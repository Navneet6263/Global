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
import { Button, Field, Select, Td, Th } from "@/kit";
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
        <Button>
          <Upload aria-hidden /> {internal ? "Bulk upload" : "Import CSV"}
        </Button>
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-soft p-4">
            <p className="max-w-md text-xs text-ink">
              Use CSV exported from Excel. Candidate name and email or Indian mobile are required.
              {internal
                ? "Choose the company below; every row goes to that company."
                : "Your client workspace is applied automatically."}
            </p>
            <Button
              size="sm"
              onClick={() =>
                saveBlob(
                  new Blob([`${intakeHeaders}\r\n`], { type: "text/csv" }),
                  "sapling-candidate-import.csv",
                )
              }
            >
              <Download aria-hidden /> Template
            </Button>
          </div>
          {internal ? (
            <Field label="Company" htmlFor="bulk-company">
              <Select
                id="bulk-company"
                value={clientId}
                disabled={running || attempted}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setPackageId("");
                }}
              >
                <option value="">Choose a company</option>
                {clients.data?.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Verification package" htmlFor="bulk-package">
            <Select
              id="bulk-package"
              value={packageId}
              disabled={running || attempted || (internal && !clientId)}
              onChange={(e) => setPackageId(e.target.value)}
            >
              <option value="">Choose an authorised package</option>
              {catalog.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.checks.length} checks
                </option>
              ))}
            </Select>
          </Field>
          {chosen?.checkRequirements?.length ? (
            <CheckRequirementsPanel requirements={chosen.checkRequirements} />
          ) : null}
          {catalog.error ? (
            <p role="alert" className="text-xs text-bad">
              {catalog.error.message}
            </p>
          ) : null}
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Candidate CSV"
            disabled={running || attempted}
            className="w-full rounded-lg border border-dashed border-brand/40 bg-subtle/60 p-4 text-xs text-ink file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium"
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
              <div className="flex justify-between text-xs text-ink">
                <span>{rows.length} candidates ready for review</span>
                <span className="font-semibold text-good">{created} created</span>
              </div>
              <div className="max-h-64 overflow-auto rounded-lg border border-line">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0">
                    <tr>
                      <Th>Candidate</Th>
                      <Th>Contact</Th>
                      <Th>Result</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.key} className="last:[&>td]:border-b-0">
                        <Td className="font-medium">{row.input.fullName}</Td>
                        <Td className="text-dim">{row.input.email ?? row.input.phone}</Td>
                        <Td className={row.status === "failed" ? "text-bad" : "text-good"}>
                          {row.caseNumber ?? row.error ?? row.status}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-dim">
                Keep this window open during import. Successful rows are skipped when retrying.
                Candidate upload links can be issued from each case workspace.
              </p>
              <div className="flex justify-end gap-2">
                {attempted && !running ? (
                  <Button
                    onClick={() => {
                      setCandidates([]);
                      setPackageId("");
                    }}
                  >
                    New import
                  </Button>
                ) : null}
                <Button
                  variant="primary"
                  disabled={running || !packageId || created === rows.length}
                  onClick={() =>
                    void start(
                      packageId,
                      internal ? { endpoint: "/bulk-intake/rows", clientId } : undefined,
                    )
                  }
                >
                  {running
                    ? `Creating ${created} / ${rows.length}…`
                    : attempted
                      ? "Retry failed rows"
                      : `Create ${rows.length} cases`}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
