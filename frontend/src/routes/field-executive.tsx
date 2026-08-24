import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CloudUpload,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Wifi,
  WifiOff,
} from "lucide-react";

import { FieldChecklist } from "@/features/field/FieldChecklist";
import { FieldDayPlan } from "@/features/field/FieldDayPlan";
import { FieldVisitCard } from "@/features/field/FieldVisitCard";
import { useFieldWorkflow } from "@/features/field/useFieldWorkflow";

export const Route = createFileRoute("/field-executive")({
  head: () => ({
    links: [{ rel: "manifest", href: "/manifest.webmanifest" }],
    meta: [
      { title: "Field Executive PWA — GPS Visit Capture | Sapling Global" },
      {
        name: "description",
        content:
          "Mobile field verification with precise GPS, geofence review, evidence capture and offline sync.",
      },
      { name: "theme-color", content: "#0b0b0f" },
    ],
  }),
  component: FieldExecutivePage,
});

function FieldExecutivePage() {
  const workflow = useFieldWorkflow();
  const completed = workflow.visits.filter((visit) => visit.status === "COMPLETED").length;

  return (
    <div className="canvas-mesh min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-12 pt-5 sm:px-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Field workspace
            </p>
            <h1 className="text-xl font-bold tracking-tight">My verification visits</h1>
          </div>
          <Link
            to="/"
            className="surface grid h-10 w-10 place-items-center rounded-full text-muted-foreground"
            aria-label="Back to operations"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </header>

        <div
          className={`flex items-center gap-2 rounded-3xl px-4 py-3 ${
            workflow.online
              ? "bg-accent/25 text-accent-foreground"
              : "bg-warning/25 text-warning-foreground"
          }`}
        >
          {workflow.online ? (
            <Wifi className="h-4 w-4 shrink-0" />
          ) : (
            <WifiOff className="h-4 w-4 shrink-0" />
          )}
          <p className="flex-1 text-xs leading-snug">
            {workflow.online
              ? `${workflow.pendingSync} visit draft${workflow.pendingSync === 1 ? "" : "s"} waiting to sync`
              : "Offline — GPS, checklist and photos stay queued on this device."}
          </p>
          {workflow.pendingSync > 0 && workflow.online && (
            <button
              type="button"
              onClick={() => void workflow.syncAll()}
              disabled={workflow.syncing}
              className="flex items-center gap-1 rounded-full bg-card px-3 py-1 text-[11px] font-medium disabled:opacity-60"
            >
              <CloudUpload className="h-3 w-3" /> {workflow.syncing ? "Syncing" : "Sync"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Assigned visits", value: workflow.visits.length },
            { label: "Completed", value: completed },
            { label: "Evidence photos", value: workflow.photoCount },
            { label: "Pending sync", value: workflow.pendingSync },
          ].map((item) => (
            <div key={item.label} className="surface rounded-3xl p-4">
              <p className="text-[11px] text-muted-foreground">{item.label}</p>
              <p className="num mt-1 text-2xl font-bold">{item.value}</p>
            </div>
          ))}
        </div>

        {workflow.visitsQuery.isLoading && (
          <div className="surface animate-pulse rounded-3xl p-6 text-sm text-muted-foreground">
            Loading assigned visits…
          </div>
        )}
        {workflow.visitsQuery.isError && (
          <div className="surface rounded-3xl p-4 text-sm text-destructive">
            <p className="flex items-center gap-2 font-medium">
              <ShieldAlert className="h-4 w-4" /> Visits could not be loaded
            </p>
            <button
              type="button"
              onClick={() => void workflow.visitsQuery.refetch()}
              className="mt-3 rounded-full bg-secondary px-4 py-2 text-xs text-foreground"
            >
              Try again
            </button>
          </div>
        )}

        {!workflow.visitsQuery.isLoading &&
        !workflow.visitsQuery.isError &&
        workflow.visits.length === 0 ? (
          <section className="surface rounded-3xl p-6 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-muted-foreground">
              <MapPin className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-base font-semibold">No visits assigned</h2>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
              New field assignments will appear here automatically. Refresh before starting your
              route if your coordinator has just assigned a visit.
            </p>
            <button
              type="button"
              onClick={() => void workflow.visitsQuery.refetch()}
              disabled={workflow.visitsQuery.isFetching}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${workflow.visitsQuery.isFetching ? "animate-spin" : ""}`}
              />
              Refresh assignments
            </button>
          </section>
        ) : null}

        {workflow.active && (
          <>
            <FieldVisitCard
              visit={workflow.active}
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
            />
            <FieldChecklist draft={workflow.draft} onChange={workflow.update} />
            <FieldDayPlan
              visits={workflow.visits}
              activeId={workflow.active.id}
              onSelect={workflow.setActiveId}
            />
          </>
        )}

        <p className="px-2 text-center text-[11px] leading-5 text-muted-foreground">
          Add to Home Screen for an app-like experience. Location is captured only when you tap
          check-in, refresh or complete visit—never in the background.
        </p>
      </div>
    </div>
  );
}
