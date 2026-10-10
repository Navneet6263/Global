import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { useState } from "react";
import { PresetReports } from "@/features/stakeholders/client/ClientMisReports";
import { getRmClients } from "@/lib/backend-api/client-reports";

export const Route = createFileRoute("/spoc-rm/mis")({
  head: () => ({ meta: [{ title: "Company MIS — Sapling Global" }] }),
  component: RmMisPage,
});

/** RM: generate and download a company's MIS (Case status, TAT, UTV, Discrepancy). */
function RmMisPage() {
  const clients = useQuery({ queryKey: ["rm", "clients"], queryFn: getRmClients });
  const [chosen, setChosen] = useState<string>();
  const items = clients.data?.items ?? [];
  const company = items.find((item) => item.id === chosen) ?? items[0];
  return (
    <>
      <header className="client-heading">
        <div>
          <h1>Company MIS</h1>
          <p>Build a company&apos;s MIS for any date range and download it with colour codes.</p>
        </div>
      </header>
      <div className="grid min-w-0 gap-5">
        <section
          aria-label="Choose company"
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <Building2 className="size-5" aria-hidden />
          </span>
          <label className="grid min-w-0 flex-1 gap-1 text-[12.5px] font-medium text-slate-600">
            Company
            <select
              value={company?.id ?? ""}
              onChange={(event) => setChosen(event.target.value)}
              disabled={!items.length}
              aria-label="Company"
              className="h-10 w-full max-w-md rounded-xl border border-slate-200 bg-white px-3 text-[13.5px] font-semibold text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[12px] text-slate-500">
            {clients.isPending
              ? "Loading your companies…"
              : clients.isError
                ? clients.error.message
                : `${items.length} compan${items.length === 1 ? "y" : "ies"} assigned to you`}
          </p>
        </section>
        {company ? (
          <PresetReports key={company.id} company={company} />
        ) : !clients.isPending && !clients.isError ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-[13px] text-slate-500">
            No companies are assigned to you yet.
          </p>
        ) : null}
      </div>
    </>
  );
}
