import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  FileCheck2,
  FileDown,
  FileText,
  LocateFixed,
  MapPin,
  MessageSquareText,
  Play,
  Plus,
  Send,
  ShieldCheck,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Sidebar } from "@/components/ops/Sidebar";
import { Topbar } from "@/components/ops/Topbar";
import { getSession } from "@/lib/api/auth";
import { issueCandidateAccess } from "@/lib/api/candidate-portal";
import { getCase, transitionCase, type CaseDetail } from "@/lib/api/cases";
import { requestConsent } from "@/lib/api/consents";
import {
  createClarification,
  listClarifications,
  resolveClarification,
} from "@/lib/api/clarifications";
import {
  createDocument,
  documentTypes,
  downloadDocument,
  uploadDocument,
  type DocumentType,
} from "@/lib/api/documents";
import { downloadReport, generateReport, listReports } from "@/lib/api/reports";
import { createFieldVisit, reviewFieldException } from "@/lib/api/field-visits";
import { createTask } from "@/lib/api/tasks";
import { listUsers } from "@/lib/api/users";

export const Route = createFileRoute("/cases/$caseId")({
  component: CaseWorkspace,
  head: () => ({ meta: [{ title: "Case 360 — Sapling Global" }] }),
});

function CaseWorkspace() {
  const { caseId } = Route.useParams();
  const query = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId),
  });

  return (
    <div className="canvas-mesh min-h-screen bg-background text-foreground lg:pl-64">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onRefresh={() => void query.refetch()} isRefreshing={query.isFetching} />
        <main className="flex-1 px-4 pb-12 pt-5 sm:px-6">
          {query.isLoading ? <CaseSkeleton /> : null}
          {query.isError ? <CaseError message={query.error.message} /> : null}
          {query.data ? <CaseDetailView item={query.data} /> : null}
        </main>
      </div>
    </div>
  );
}

function CaseDetailView({ item }: { item: CaseDetail }) {
  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to operations
      </Link>

      <header className="ink-panel relative overflow-hidden rounded-[2rem] p-6 shadow-[var(--shadow-float)] sm:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary-foreground/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]">
                {item.caseNumber}
              </span>
              <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-accent-foreground">
                {humanize(item.status)}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">{item.subject.fullName}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm opacity-70">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                {item.client.displayName}
              </span>
              <span className="flex items-center gap-1.5">
                <ClipboardCheck className="h-4 w-4" />
                {item.checks.length} checks
              </span>
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-4 w-4" />
                Due {item.dueAt ? formatDate(item.dueAt) : "not set"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="Priority" value={humanize(item.priority)} />
            <Metric
              label="Risk"
              value={item.riskLevel ? humanize(item.riskLevel) : "Unclassified"}
            />
          </div>
        </div>
      </header>

      <WorkflowStrip item={item} />
      <CaseActions item={item} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.75fr)]">
        <div className="space-y-5">
          <Panel title="Verification checks" subtitle="Current result and progress for each check">
            <div className="grid gap-3 sm:grid-cols-2">
              {item.checks.map((check) => (
                <CheckCard
                  key={check.publicId}
                  caseId={item.id}
                  caseStatus={item.status}
                  check={check}
                />
              ))}
            </div>
          </Panel>

          <DocumentPanel item={item} />

          <ClarificationPanel item={item} />

          <FieldVisitPanel item={item} />
        </div>

        <aside className="space-y-5">
          <CandidatePanel item={item} />

          <ConsentPanel item={item} />

          <ReportsPanel item={item} />

          <Panel title="Status history" subtitle="Immutable workflow transitions">
            <div className="space-y-4">
              {item.statusHistory.map((entry, index) => (
                <div key={`${entry.createdAt}-${index}`} className="relative pl-6">
                  <span className="absolute left-0 top-1 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent/15" />
                  <p className="text-sm font-medium">{humanize(entry.toStatus)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </p>
                  {entry.reason ? (
                    <p className="mt-1 text-xs text-muted-foreground">{entry.reason}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function CaseActions({ item }: { item: CaseDetail }) {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const canTransition =
    session.data?.permissions.includes("*") ||
    session.data?.permissions.includes("case:transition");
  const mutation = useMutation({
    mutationFn: () =>
      transitionCase(item.id, {
        status: "IN_PROGRESS",
        version: item.version,
        reason: "Verification work authorised and started",
      }),
    onSuccess: async () => {
      toast.success("Verification started");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["case", item.id] }),
        queryClient.invalidateQueries({ queryKey: ["cases"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (item.status !== "DOCUMENT_PENDING" || !canTransition) return null;

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-accent/30 bg-accent/10 px-5 py-4">
      <div>
        <p className="text-sm font-semibold">Consent received</p>
        <p className="text-xs text-muted-foreground">
          Start verification to unlock check assignment and execution.
        </p>
      </div>
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
      >
        <Play className="h-4 w-4" />
        {mutation.isPending ? "Starting…" : "Start verification"}
      </button>
    </section>
  );
}

function CandidatePanel({ item }: { item: CaseDetail }) {
  const [shareUrl, setShareUrl] = useState("");
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const canIssue =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("consent:manage");
  const mutation = useMutation({
    mutationFn: () => issueCandidateAccess(item.id),
    onSuccess: (result) => {
      const url = `${window.location.origin}/candidate/${result.id}#token=${encodeURIComponent(result.token)}`;
      setShareUrl(url);
      toast.success("Secure candidate link issued", {
        description: `Expires ${formatDateTime(result.expiresAt)}`,
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Panel title="Candidate" subtitle="Case subject and secure self-service access">
      <InfoRow icon={UserRound} label="Name" value={item.subject.fullName} />
      <InfoRow
        icon={FileCheck2}
        label="Employee code"
        value={item.subject.employeeCode || "Not provided"}
      />
      <InfoRow icon={Building2} label="Client" value={item.client.displayName} />
      {canIssue ? (
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4" />
          {mutation.isPending
            ? "Issuing…"
            : shareUrl
              ? "Rotate secure link"
              : "Issue candidate portal link"}
        </button>
      ) : null}
      {shareUrl ? (
        <div className="mt-3 flex gap-2">
          <input
            readOnly
            value={shareUrl}
            className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                .writeText(shareUrl)
                .then(() => toast.success("Candidate link copied"))
                .catch(() => toast.error("Copy failed"));
            }}
            aria-label="Copy candidate portal link"
            className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </Panel>
  );
}

function CheckCard({
  caseId,
  caseStatus,
  check,
}: {
  caseId: string;
  caseStatus: string;
  check: CaseDetail["checks"][number];
}) {
  const queryClient = useQueryClient();
  const [assigneeId, setAssigneeId] = useState("");
  const [instructions, setInstructions] = useState("");
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const canAssign =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("task:write");
  const task = check.tasks?.[0];
  const directory = useQuery({
    queryKey: ["users", "VERIFIER"],
    queryFn: () => listUsers("VERIFIER"),
    enabled: Boolean(canAssign && caseStatus === "IN_PROGRESS" && !task),
    staleTime: 60_000,
  });
  const mutation = useMutation({
    mutationFn: () =>
      createTask(check.publicId, {
        assigneeId,
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
      }),
    onSuccess: async () => {
      toast.success(`${humanize(check.type)} assigned`);
      setInstructions("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["case", caseId] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <article className="rounded-2xl border border-[var(--hairline)] bg-secondary/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{humanize(check.type)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {check.result ? `Result: ${humanize(check.result)}` : "Result pending"}
          </p>
        </div>
        <Status status={check.status} />
      </div>

      {task ? (
        <div className="mt-4 rounded-xl bg-background/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Assigned verifier
          </p>
          <p className="mt-1 text-sm font-medium">
            {task.assignee?.displayName ?? "Awaiting assignment"}
          </p>
          {task.instructions ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{task.instructions}</p>
          ) : null}
        </div>
      ) : null}

      {check.sourceSummary ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{check.sourceSummary}</p>
      ) : null}

      {!task && canAssign && caseStatus === "IN_PROGRESS" ? (
        <div className="mt-4 space-y-2.5 border-t border-[var(--hairline)] pt-4">
          <select
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
            aria-label={`Assign verifier for ${humanize(check.type)}`}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30"
          >
            <option value="">
              {directory.isLoading ? "Loading verifiers…" : "Select verifier"}
            </option>
            {directory.data?.items.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} · {user.email}
              </option>
            ))}
          </select>
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Verification instructions (optional)"
            rows={2}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
          />
          {directory.isError ? (
            <p className="text-xs text-destructive">{directory.error.message}</p>
          ) : directory.data && directory.data.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No active verifier is configured. Add one in user management first.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!assigneeId || mutation.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            {mutation.isPending ? "Assigning…" : "Assign check"}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function FieldVisitPanel({ item }: { item: CaseDetail }) {
  const queryClient = useQueryClient();
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [geofenceMeters, setGeofenceMeters] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [locating, setLocating] = useState(false);
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const canAssign =
    session.data?.permissions.includes("*") ||
    session.data?.permissions.includes("field-visit:write");
  const directory = useQuery({
    queryKey: ["users", "FIELD_EXECUTIVE"],
    queryFn: () => listUsers("FIELD_EXECUTIVE"),
    enabled: Boolean(canAssign && item.status === "IN_PROGRESS"),
    staleTime: 60_000,
  });
  const lat = Number(latitude);
  const lng = Number(longitude);
  const radius = geofenceMeters ? Number(geofenceMeters) : undefined;
  const valid =
    address.trim().length >= 5 &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    Boolean(assigneeId) &&
    (radius === undefined || (Number.isInteger(radius) && radius >= 50 && radius <= 1000));
  const mutation = useMutation({
    mutationFn: () =>
      createFieldVisit(item.id, {
        address: address.trim(),
        latitude: lat,
        longitude: lng,
        assigneeId,
        ...(radius === undefined ? {} : { geofenceMeters: radius }),
      }),
    onSuccess: async () => {
      setAddress("");
      setLatitude("");
      setLongitude("");
      setGeofenceMeters("");
      setAssigneeId("");
      toast.success("Field visit assigned");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["case", item.id] }),
        queryClient.invalidateQueries({ queryKey: ["field-visits"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const review = useMutation({
    mutationFn: ({
      visitId,
      version,
      decision,
    }: {
      visitId: string;
      version: number;
      decision: "APPROVE" | "RETRY";
    }) => reviewFieldException(visitId, { decision, version }),
    onSuccess: async (result) => {
      toast.success(
        result.status === "COMPLETED" ? "Field exception approved" : "Fresh visit requested",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["case", item.id] }),
        queryClient.invalidateQueries({ queryKey: ["field-visits"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "exceptions"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location services are unavailable in this browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setLocating(false);
        toast.success("Target coordinates captured");
      },
      (error) => {
        setLocating(false);
        toast.error(error.message || "Could not capture location");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  return (
    <Panel title="Field verification" subtitle="Assign visits and monitor geofence outcomes">
      {canAssign && item.status === "IN_PROGRESS" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) mutation.mutate();
          }}
          className="mb-4 grid gap-2 rounded-2xl bg-secondary/30 p-3"
        >
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            maxLength={500}
            placeholder="Complete visit address"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              inputMode="decimal"
              aria-label="Target latitude"
              placeholder="Latitude"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
            <input
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              inputMode="decimal"
              aria-label="Target longitude"
              placeholder="Longitude"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              aria-label="Field executive assignee"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Select field executive</option>
              {directory.data?.items.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} · {user.email}
                </option>
              ))}
            </select>
            <input
              value={geofenceMeters}
              onChange={(event) => setGeofenceMeters(event.target.value)}
              inputMode="numeric"
              aria-label="Geofence radius in metres"
              placeholder="Default geofence radius"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          {directory.isError ? (
            <p className="text-xs text-destructive">{directory.error.message}</p>
          ) : directory.data?.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Add an active field executive in user management before assigning a visit.
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              <LocateFixed className="h-3.5 w-3.5" />
              {locating ? "Locating…" : "Use current location"}
            </button>
            <button
              disabled={!valid || mutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <MapPin className="h-3.5 w-3.5" />
              {mutation.isPending ? "Assigning…" : "Assign field visit"}
            </button>
          </div>
        </form>
      ) : null}

      {item.fieldVisits.length ? (
        <div className="divide-y divide-[var(--hairline)]">
          {item.fieldVisits.map((visit) => (
            <div key={visit.publicId} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{visit.address}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {visit.assignee?.displayName ?? "Unassigned"} ·{" "}
                    {visit.distanceMeters == null
                      ? `${visit.geofenceMeters} m geofence`
                      : `${Math.round(visit.distanceMeters)} m from target`}
                  </p>
                </div>
                <Status status={visit.status} />
              </div>
              {canAssign && visit.status === "EXCEPTION_REVIEW" ? (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      review.mutate({
                        visitId: visit.publicId,
                        version: visit.version,
                        decision: "RETRY",
                      })
                    }
                    disabled={review.isPending}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                  >
                    Request fresh visit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      review.mutate({
                        visitId: visit.publicId,
                        version: visit.version,
                        decision: "APPROVE",
                      })
                    }
                    disabled={review.isPending}
                    className="rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-foreground disabled:opacity-50"
                  >
                    Approve exception
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <Empty text="No field visit assigned" />
      )}
    </Panel>
  );
}

function DocumentPanel({ item }: { item: CaseDetail }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<DocumentType>("AADHAAR");
  const [file, setFile] = useState<File | null>(null);
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const canWrite =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("document:write");
  const canRead =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("document:read");
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a file to upload");
      const document = await createDocument(item.id, type);
      return uploadDocument(document.id, file);
    },
    onSuccess: async () => {
      toast.success("Document uploaded and integrity hash recorded");
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: ["case", item.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const download = useMutation({
    mutationFn: (document: CaseDetail["documents"][number]) => {
      const filename = document.versions.at(-1)?.originalName ?? `${humanize(document.type)}.pdf`;
      return downloadDocument(document.publicId, filename);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Panel title="Documents" subtitle="Versioned evidence with integrity and safety checks">
      {canWrite ? (
        <div className="mb-4 grid gap-2 rounded-2xl border border-dashed border-border bg-secondary/25 p-3 sm:grid-cols-[minmax(10rem,0.65fr)_minmax(12rem,1fr)_auto]">
          <select
            value={type}
            onChange={(event) => setType(event.target.value as DocumentType)}
            aria-label="Document type"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          >
            {documentTypes.map((documentType) => (
              <option key={documentType} value={documentType}>
                {humanize(documentType)}
              </option>
            ))}
          </select>
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm">
            <UploadCloud className="h-4 w-4 text-muted-foreground" />
            <span className="min-w-0 truncate">{file?.name ?? "Choose PDF or image"}</span>
            <input
              key={file?.name ?? "empty"}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
          <button
            type="button"
            onClick={() => upload.mutate()}
            disabled={!file || upload.isPending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {upload.isPending ? "Securing…" : "Add document"}
          </button>
        </div>
      ) : null}

      {item.documents.length ? (
        <div className="divide-y divide-[var(--hairline)]">
          {item.documents.map((document) => {
            const latest = document.versions[0];
            return (
              <div
                key={document.publicId}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{humanize(document.type)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {latest
                      ? `v${latest.version} · ${formatBytes(latest.sizeBytes)} · ${humanize(latest.malwareState)}`
                      : "Awaiting first version"}
                  </p>
                </div>
                <Status status={document.status} />
                {canRead && document.status === "AVAILABLE" ? (
                  <button
                    type="button"
                    onClick={() => download.mutate(document)}
                    disabled={download.isPending}
                    aria-label={`Download ${humanize(document.type)}`}
                    className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background transition-colors hover:bg-secondary disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty text="No documents requested or uploaded" />
      )}
    </Panel>
  );
}

function ClarificationPanel({ item }: { item: CaseDetail }) {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [checkId, setCheckId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const canRead =
    session.data?.permissions.includes("*") ||
    session.data?.permissions.includes("clarification:read");
  const canWrite =
    session.data?.permissions.includes("*") ||
    session.data?.permissions.includes("clarification:write");
  const clarifications = useQuery({
    queryKey: ["clarifications", item.id],
    queryFn: () => listClarifications(item.id),
    enabled: Boolean(canRead),
  });
  const create = useMutation({
    mutationFn: () =>
      createClarification(item.id, {
        subject: subject.trim(),
        message: message.trim(),
        ...(checkId ? { checkId } : {}),
      }),
    onSuccess: async (result) => {
      const url = `${window.location.origin}/clarification/${result.id}#token=${encodeURIComponent(result.portalToken)}`;
      setShareUrl(url);
      setSubject("");
      setMessage("");
      setCheckId("");
      toast.success("Clarification raised", {
        description: "Secure candidate response link is ready to share.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["case", item.id] }),
        queryClient.invalidateQueries({ queryKey: ["clarifications", item.id] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const resolve = useMutation({
    mutationFn: (clarificationId: string) => resolveClarification(item.id, clarificationId),
    onSuccess: async (result) => {
      toast.success("Clarification resolved", {
        description:
          result.caseStatus === "IN_PROGRESS"
            ? "All responses are reviewed; verification has resumed."
            : "The reviewed response has been closed.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["case", item.id] }),
        queryClient.invalidateQueries({ queryKey: ["clarifications", item.id] }),
        queryClient.invalidateQueries({ queryKey: ["cases"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const rows = clarifications.data?.items ?? [];

  return (
    <Panel title="Clarifications" subtitle="Secure questions and candidate responses">
      {canWrite && ["IN_PROGRESS", "CLARIFICATION_PENDING"].includes(item.status) ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (subject.trim().length >= 3 && message.trim().length >= 3) create.mutate();
          }}
          className="mb-4 grid gap-2 rounded-2xl bg-secondary/30 p-3"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={180}
              placeholder="Clarification subject"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
            <select
              value={checkId}
              onChange={(event) => setCheckId(event.target.value)}
              aria-label="Related verification check"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="">General case clarification</option>
              {item.checks.map((check) => (
                <option key={check.publicId} value={check.publicId}>
                  {humanize(check.type)}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={5000}
            rows={3}
            placeholder="Explain exactly what information or evidence is required"
            className="resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          />
          <div className="flex justify-end">
            <button
              disabled={subject.trim().length < 3 || message.trim().length < 3 || create.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <MessageSquareText className="h-3.5 w-3.5" />
              {create.isPending ? "Creating…" : "Raise clarification"}
            </button>
          </div>
        </form>
      ) : null}

      {shareUrl ? (
        <div className="mb-4 rounded-2xl border border-accent/30 bg-accent/10 p-3">
          <p className="text-xs font-semibold">Secure response link</p>
          <div className="mt-2 flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-xs"
            />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(shareUrl)
                  .then(() => toast.success("Secure link copied"))
                  .catch(() => toast.error("Copy failed; select the link manually"));
              }}
              className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"
              aria-label="Copy secure response link"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {clarifications.isLoading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-secondary" />
      ) : rows.length ? (
        <div className="divide-y divide-[var(--hairline)]">
          {rows.map((clarification) => (
            <div key={clarification.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{clarification.subject}</p>
                <Status status={clarification.status} />
              </div>
              {clarification.messages.at(-1) ? (
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {clarification.messages.at(-1)?.body}
                </p>
              ) : null}
              {canWrite && clarification.status === "RESPONDED" ? (
                <button
                  type="button"
                  onClick={() => resolve.mutate(clarification.id)}
                  disabled={resolve.isPending}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-foreground disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {resolve.isPending ? "Resolving…" : "Mark reviewed & resolve"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <Empty text="No clarifications raised" />
      )}
    </Panel>
  );
}

function ReportsPanel({ item }: { item: CaseDetail }) {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const canRead =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("report:read");
  const canGenerate =
    session.data?.permissions.includes("*") ||
    session.data?.permissions.includes("report:generate");
  const reports = useQuery({
    queryKey: ["reports", item.id],
    queryFn: () => listReports(item.id),
    enabled: Boolean(canRead),
  });
  const generate = useMutation({
    mutationFn: () => generateReport(item.id),
    onSuccess: async () => {
      toast.success("Signed report version published");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reports", item.id] }),
        queryClient.invalidateQueries({ queryKey: ["case", item.id] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const download = useMutation({
    mutationFn: (reportId: string) => downloadReport(reportId, item.caseNumber),
    onError: (error: Error) => toast.error(error.message),
  });
  const latest = reports.data?.items[0];
  const latestVersion = latest?.versions[0];

  return (
    <Panel title="QA & reports" subtitle="Independent review and versioned output">
      <div className="grid grid-cols-2 gap-3">
        <Metric label="QA reviews" value={String(item.qaReviews.length)} light />
        <Metric
          label="Reports"
          value={String(reports.data?.items.length ?? item.reports.length)}
          light
        />
      </div>
      {item.qaReviews[0] ? (
        <div className="mt-3">
          <Status status={item.qaReviews[0].decision} />
        </div>
      ) : null}

      {latest ? (
        <div className="mt-4 rounded-2xl border border-[var(--hairline)] bg-secondary/35 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Published report v{latest.currentVersion}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {latest.publishedAt ? formatDateTime(latest.publishedAt) : "Publishing"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => download.mutate(latest.id)}
              disabled={download.isPending}
              className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              aria-label="Download published report"
            >
              <FileDown className="h-4 w-4" />
            </button>
          </div>
          {latestVersion ? (
            <a
              href={`/reports/verify/${encodeURIComponent(latestVersion.authenticityCode)}`}
              className="mt-3 block truncate text-xs font-semibold text-accent-foreground underline-offset-4 hover:underline"
            >
              Verify {latestVersion.authenticityCode}
            </a>
          ) : null}
        </div>
      ) : canGenerate && ["COMPLETED", "CLOSED"].includes(item.status) ? (
        <button
          type="button"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <FileDown className="h-4 w-4" />
          {generate.isPending ? "Generating…" : "Generate signed report"}
        </button>
      ) : null}
    </Panel>
  );
}

function ConsentPanel({ item }: { item: CaseDetail }) {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const consent = item.consents[0];
  const canManage =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("consent:manage");
  const mutation = useMutation({
    mutationFn: () => requestConsent(item.id),
    onSuccess: async (result) => {
      toast.success("Consent OTP queued", {
        description: `Request expires ${formatDateTime(result.expiresAt)}`,
      });
      await queryClient.invalidateQueries({ queryKey: ["case", item.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Panel title="Consent" subtitle="Latest consent state">
      {consent ? (
        <div className="rounded-2xl bg-secondary/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <ShieldCheck className="h-5 w-5 text-accent-foreground" />
            <Status status={consent.status} />
          </div>
          <p className="mt-3 text-sm font-semibold">Notice {consent.noticeVersion}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{consent.purpose}</p>
          {canManage && consent.status !== "ACCEPTED" ? (
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {mutation.isPending ? "Queuing…" : "Send consent OTP"}
            </button>
          ) : null}
        </div>
      ) : (
        <Empty text="Consent has not been requested" />
      )}
    </Panel>
  );
}

function WorkflowStrip({ item }: { item: CaseDetail }) {
  const steps = [
    { label: "Case created", complete: true },
    { label: "Consent", complete: item.consents.some((c) => c.status === "ACCEPTED") },
    {
      label: "Checks",
      complete: item.checks.length > 0 && item.checks.every((c) => c.status === "COMPLETED"),
    },
    { label: "QA review", complete: item.qaReviews.some((q) => q.decision === "APPROVED") },
    { label: "Report", complete: item.reports.some((r) => r.status === "PUBLISHED") },
  ];
  return (
    <section className="surface overflow-x-auto rounded-3xl p-5">
      <div className="flex min-w-[650px] items-center">
        {steps.map((step, index) => (
          <div key={step.label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full ${step.complete ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"}`}
              >
                {step.complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </span>
              <span className="text-xs font-semibold">{step.label}</span>
            </div>
            {index < steps.length - 1 ? (
              <div className={`mx-3 h-px flex-1 ${step.complete ? "bg-accent" : "bg-border"}`} />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="surface rounded-3xl p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function EntityList({
  items,
  empty,
}: {
  items: Array<{
    id: string;
    icon: typeof FileText;
    title: string;
    detail: string;
    status: string;
  }>;
  empty: string;
}) {
  return items.length ? (
    <div className="divide-y divide-[var(--hairline)]">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary">
            <item.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
          </div>
          <Status status={item.status} />
        </div>
      ))}
    </div>
  ) : (
    <Empty text={empty} />
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-[var(--hairline)] py-3 first:pt-0 last:border-0 last:pb-0">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  light = false,
}: {
  label: string;
  value: string;
  light?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 ${light ? "bg-secondary/55" : "bg-primary-foreground/10"}`}
    >
      <p className="text-[10px] uppercase tracking-[0.1em] opacity-55">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function Status({ status }: { status: string }) {
  const success = [
    "COMPLETED",
    "APPROVED",
    "ACCEPTED",
    "AVAILABLE",
    "PUBLISHED",
    "CLOSED",
  ].includes(status);
  const danger = ["REJECTED", "FAILED", "CANCELLED", "EXPIRED"].includes(status);
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${success ? "bg-accent/25 text-accent-foreground" : danger ? "bg-destructive/10 text-destructive" : "bg-warning/20 text-warning-foreground"}`}
    >
      {humanize(status)}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
      <AlertCircle className="mx-auto h-5 w-5 text-muted-foreground" />
      <p className="mt-2 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
function CaseSkeleton() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="h-6 w-40 animate-pulse rounded bg-secondary" />
      <div className="h-56 animate-pulse rounded-[2rem] bg-primary/80" />
      <div className="h-24 animate-pulse rounded-3xl bg-card" />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="h-96 animate-pulse rounded-3xl bg-card xl:col-span-2" />
        <div className="h-96 animate-pulse rounded-3xl bg-card" />
      </div>
    </div>
  );
}
function CaseError({ message }: { message: string }) {
  return (
    <div className="surface mx-auto max-w-xl rounded-3xl p-8 text-center">
      <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
      <h1 className="mt-3 font-semibold">Case could not be loaded</h1>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <Link
        to="/"
        className="mt-5 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Return to operations
      </Link>
    </div>
  );
}
function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
function formatBytes(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
