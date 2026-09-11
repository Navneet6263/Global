import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Loader2,
  LogOut,
  MapPin,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SaplingSymbol } from "@/components/brand/sapling-symbol";
import { FieldChecklist } from "@/features/field/FieldChecklist";
import { FieldDayPlan } from "@/features/field/FieldDayPlan";
import { FieldRouteSummary } from "@/features/field/FieldRouteSummary";
import { FieldVisitCard } from "@/features/field/FieldVisitCard";
import { useFieldWorkflow } from "@/features/field/useFieldWorkflow";
import { endAuthenticatedSession } from "@/lib/auth/end-session";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";
import { WorkspaceHelp } from "@/features/help/workspace-help";
import { HelpLauncher, LearningIntro } from "@/features/help/help-launcher";

export const Route = createFileRoute("/field-executive")({
  beforeLoad: () => requireRoleWorkspace(["FIELD_EXECUTIVE"]),
  head: () => ({
    links: [{ rel: "manifest", href: "/manifest.webmanifest" }],
    meta: [
      { title: "Field Visits — Sapling Global" },
      {
        name: "description",
        content: "Secure event-based GPS and evidence collection for assigned field visits.",
      },
      { name: "theme-color", content: "#f7fbf8" },
    ],
  }),
  component: FieldExecutivePage,
});

const tabs = ["ACTIVE", "REVIEW", "EXCEPTION", "COMPLETED", "ALL"] as const;
type VisitTab = (typeof tabs)[number];
type SummaryCounts = {
  queued: number;
  active: number;
  exceptions: number;
  review: number;
  completed: number;
};

function FieldExecutivePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workflow = useFieldWorkflow();
  const [tab, setTab] = useState<VisitTab>("ACTIVE");
  const [signingOut, setSigningOut] = useState(false);
  const counts = useMemo(() => {
    const completed = workflow.visits.filter((visit) => visit.status === "COMPLETED").length;
    const exceptions = workflow.visits.filter(
      (visit) => visit.status === "EXCEPTION_REVIEW",
    ).length;
    return {
      queued: workflow.visits.length,
      active: workflow.visits.filter((visit) => ["ASSIGNED", "IN_PROGRESS"].includes(visit.status))
        .length,
      review: workflow.visits.filter((visit) => visit.status === "REVIEW_PENDING").length,
      exceptions,
      completed,
    };
  }, [workflow.visits]);
  const visible = useMemo(
    () =>
      workflow.visits.filter(
        (visit) =>
          tab === "ALL" ||
          (tab === "ACTIVE" && ["ASSIGNED", "IN_PROGRESS"].includes(visit.status)) ||
          (tab === "EXCEPTION" && visit.status === "EXCEPTION_REVIEW") ||
          (tab === "REVIEW" && visit.status === "REVIEW_PENDING") ||
          (tab === "COMPLETED" && visit.status === "COMPLETED"),
      ),
    [tab, workflow.visits],
  );
  const { activeId, setActiveId } = workflow;

  useEffect(() => {
    if (visible.length && !visible.some((visit) => visit.id === activeId)) {
      setActiveId(visible[0]!.id);
    }
  }, [visible, activeId, setActiveId]);

  const active = visible.find((visit) => visit.id === activeId) ?? visible[0];
  const signOut = async () => {
    setSigningOut(true);
    try {
      await queryClient.cancelQueries();
      await endAuthenticatedSession();
      queryClient.clear();
      await navigate({ to: "/auth", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign out could not be completed");
      setSigningOut(false);
    }
  };

  return (
    <WorkspaceHelp workspace="field-executive">
      <main className="min-h-screen bg-transparent px-3 py-3 text-foreground sm:px-5 sm:py-5">
        <div className="mx-auto w-full max-w-[46rem] space-y-4 pb-10">
          <header className="surface flex items-center justify-between gap-3 rounded-[1.5rem] px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#fff9f3] ring-1 ring-primary/15">
                <SaplingSymbol className="size-9" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Sapling Global — Field Operations</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  GPS, evidence and offline-safe completion
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <HelpLauncher />
              <Link
                to="/change-password"
                className="grid size-10 place-items-center rounded-full border border-white/80 bg-white/75 text-muted-foreground shadow-[var(--shadow-card)] transition-colors hover:text-foreground"
                aria-label="Account security"
              >
                <ShieldCheck className="size-4" />
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                aria-busy={signingOut}
                className="grid size-10 place-items-center rounded-full border border-white/80 bg-white/75 text-muted-foreground shadow-[var(--shadow-card)] transition-colors hover:text-critical disabled:opacity-50"
                aria-label="Sign out"
              >
                {signingOut ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LogOut className="size-4" />
                )}
              </button>
            </div>
          </header>

          <LearningIntro />
          <FieldRouteSummary
            counts={counts}
            online={workflow.online}
            pendingSync={workflow.pendingSync}
            syncing={workflow.syncing && !workflow.locating}
            busy={workflow.syncing || workflow.locating}
            onSync={() => void workflow.syncAll()}
          />

          <section className="surface rounded-[1.5rem] p-2">
            <div className="grid grid-cols-4 gap-1" role="tablist" aria-label="Visit status">
              {tabs.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={`rounded-[1rem] px-2 py-2.5 text-[10px] font-semibold transition-colors ${tab === value ? "bg-mint-deep text-white shadow-[var(--shadow-card)]" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"}`}
                >
                  {tabLabel(value)}
                  <span className="num ml-1 opacity-65">{tabCount(value, counts)}</span>
                </button>
              ))}
            </div>
          </section>

          {workflow.visitsQuery.isLoading ? <FieldLoading /> : null}
          {workflow.visitsQuery.isError ? (
            <div className="surface rounded-[1.5rem] p-6 text-center">
              <ShieldAlert className="mx-auto size-6 text-critical" />
              <p className="mt-3 text-sm font-semibold">Visits could not be loaded</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Check your connection, then try the secure request again.
              </p>
              <button
                type="button"
                onClick={() => void workflow.visitsQuery.refetch()}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground"
              >
                <RefreshCw className="size-3.5" /> Retry
              </button>
            </div>
          ) : null}
          {!workflow.visitsQuery.isLoading && !active ? <FieldEmpty /> : null}
          {active ? (
            <>
              <FieldVisitCard
                visit={active}
                draft={workflow.draft}
                fix={workflow.fix}
                photoCount={workflow.photoCount}
                geoError={workflow.geoError}
                locating={workflow.locating}
                captureAction={workflow.captureAction}
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
              <FieldDayPlan visits={visible} activeId={active.id} onSelect={setActiveId} />
            </>
          ) : null}

          <p className="px-4 text-center text-[10px] leading-5 text-muted-foreground">
            <CheckCircle2 className="mr-1 inline size-3" /> Location is captured only at check-in,
            refresh and completion. Local drafts are cleared on logout.
          </p>
        </div>
      </main>
    </WorkspaceHelp>
  );
}

function tabLabel(value: VisitTab) {
  if (value === "REVIEW") return "Evidence review";
  return value === "EXCEPTION" ? "Exceptions" : value.charAt(0) + value.slice(1).toLowerCase();
}

function tabCount(value: VisitTab, counts: SummaryCounts) {
  if (value === "ACTIVE") return counts.active;
  if (value === "EXCEPTION") return counts.exceptions;
  if (value === "REVIEW") return counts.review;
  if (value === "COMPLETED") return counts.completed;
  return counts.queued;
}

function FieldLoading() {
  return (
    <div
      className="surface h-72 animate-pulse rounded-[1.75rem]"
      aria-label="Loading assigned visits"
    />
  );
}

function FieldEmpty() {
  return (
    <div className="surface rounded-[1.75rem] p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-mint-soft text-mint-deep">
        <MapPin className="size-5" />
      </span>
      <p className="mt-4 text-sm font-semibold">No visits in this view</p>
      <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
        New assignments and workflow updates appear here automatically.
      </p>
    </div>
  );
}
