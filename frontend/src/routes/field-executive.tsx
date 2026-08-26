import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FieldChecklist } from "@/features/field/FieldChecklist";
import { FieldDayPlan } from "@/features/field/FieldDayPlan";
import { FieldVisitCard } from "@/features/field/FieldVisitCard";
import { useFieldWorkflow } from "@/features/field/useFieldWorkflow";

export const Route = createFileRoute("/field-executive")({
  head: () => ({
    links: [{ rel: "manifest", href: "/manifest.webmanifest" }],
    meta: [
      { title: "Field Visits — Sapling Global" },
      {
        name: "description",
        content:
          "Secure event-based GPS and evidence collection for assigned field verification visits.",
      },
      { name: "theme-color", content: "#ffffff" },
    ],
  }),
  component: FieldExecutivePage,
});

const tabs = ["ACTIVE", "EXCEPTION", "COMPLETED", "ALL"] as const;

function FieldExecutivePage() {
  const workflow = useFieldWorkflow();
  const [tab, setTab] = useState<(typeof tabs)[number]>("ACTIVE");
  const visible = useMemo(
    () =>
      workflow.visits.filter(
        (visit) =>
          tab === "ALL" ||
          (tab === "ACTIVE" && ["ASSIGNED", "IN_PROGRESS"].includes(visit.status)) ||
          (tab === "EXCEPTION" && visit.status === "EXCEPTION_REVIEW") ||
          (tab === "COMPLETED" && visit.status === "COMPLETED"),
      ),
    [tab, workflow.visits],
  );
  useEffect(() => {
    if (visible.length && !visible.some((visit) => visit.id === workflow.activeId))
      workflow.setActiveId(visible[0]!.id);
  }, [visible, workflow]);
  const active = visible.find((visit) => visit.id === workflow.activeId) ?? visible[0];
  const completed = workflow.visits.filter((visit) => visit.status === "COMPLETED").length;
  const exceptions = workflow.visits.filter((visit) => visit.status === "EXCEPTION_REVIEW").length;
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-12 pt-5 sm:px-5">
        <header className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-700">
              Delivery / Field
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">My field route</h1>
            <p className="mt-1 text-xs text-slate-500">
              Event-based GPS, evidence and offline-safe completion.
            </p>
          </div>
          <Link
            to="/"
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white"
            aria-label="Back to operations"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </header>
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 ${workflow.online ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-amber-100 bg-amber-50 text-amber-700"}`}
        >
          {workflow.online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          <p className="flex-1 text-xs font-medium">
            {workflow.online
              ? `${workflow.pendingSync} visit draft${workflow.pendingSync === 1 ? "" : "s"} waiting to sync`
              : "Offline capture is active on this device."}
          </p>
          {workflow.pendingSync > 0 && workflow.online ? (
            <button
              onClick={() => void workflow.syncAll()}
              disabled={workflow.syncing}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-[10px] font-semibold shadow-sm"
            >
              <CloudUpload className="h-3 w-3" /> {workflow.syncing ? "Syncing" : "Sync now"}
            </button>
          ) : null}
        </div>
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Assigned", value: workflow.visits.length, tone: "bg-blue-50 text-blue-700" },
            {
              label: "Active",
              value: workflow.visits.length - completed - exceptions,
              tone: "bg-violet-50 text-violet-700",
            },
            { label: "Exceptions", value: exceptions, tone: "bg-amber-50 text-amber-700" },
            { label: "Completed", value: completed, tone: "bg-emerald-50 text-emerald-700" },
          ].map((item) => (
            <article
              key={item.label}
              className={`rounded-xl border border-current/10 p-3 ${item.tone}`}
            >
              <p className="text-[9px] font-semibold">{item.label}</p>
              <p className="mt-1 text-2xl font-bold">{item.value}</p>
            </article>
          ))}
        </section>
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-3">
          {tabs.map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`shrink-0 rounded-xl px-3 py-2 text-[10px] font-bold ${tab === value ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {value === "EXCEPTION"
                ? "Exceptions"
                : value.charAt(0) + value.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {workflow.visitsQuery.isLoading ? (
          <div className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-700">
            Loading assigned visits…
          </div>
        ) : null}
        {workflow.visitsQuery.isError ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-center text-sm text-red-700">
            <ShieldAlert className="mx-auto h-5 w-5" />
            <p className="mt-2 font-semibold">Visits could not be loaded</p>
            <button
              onClick={() => void workflow.visitsQuery.refetch()}
              className="mt-3 inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : null}
        {!workflow.visitsQuery.isLoading && !active ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <MapPin className="mx-auto h-6 w-6 text-slate-400" />
            <p className="mt-3 text-sm font-semibold">No visits in this view</p>
            <p className="mt-1 text-xs text-slate-500">
              New assignments and workflow updates appear automatically.
            </p>
          </div>
        ) : null}
        {active ? (
          <>
            <FieldVisitCard
              visit={active}
              draft={workflow.draft}
              fix={workflow.fix}
              photoCount={workflow.photoCount}
              geoError={workflow.geoError}
              locating={workflow.locating}
              syncing={workflow.syncing}
              policy={workflow.policy}
              onCapture={(kind) => void workflow.capture(kind)}
              onCheckout={() => void workflow.checkout()}
              onPhotos={workflow.addPhotos}
              onRemovePhoto={workflow.removePhoto}
            />
            <FieldChecklist
              draft={workflow.draft}
              onChange={workflow.update}
              disabled={!["ASSIGNED", "IN_PROGRESS"].includes(active.status)}
            />
            <FieldDayPlan visits={visible} activeId={active.id} onSelect={workflow.setActiveId} />
          </>
        ) : null}
        <p className="px-2 text-center text-[10px] leading-5 text-slate-600">
          <CheckCircle2 className="mr-1 inline h-3 w-3" />
          Location is captured only on check-in, refresh and completion. Local drafts are cleared on
          logout.
        </p>
      </div>
    </div>
  );
}
