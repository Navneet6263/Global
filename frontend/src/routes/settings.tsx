import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  Building2,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Fingerprint,
  History,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  UsersRound,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PageHeader, Panel } from "@/components/dashboards/ui";
import { Sidebar } from "@/components/ops/Sidebar";
import { Topbar } from "@/components/ops/Topbar";
import { listAuditEvents, type AuditEvent } from "@/lib/api/audit";
import { getSession } from "@/lib/api/auth";
import { createClient, listClients, updateClient, type ClientOption } from "@/lib/api/cases";
import {
  createBranch,
  createServicePackage,
  getFieldPolicy,
  listBranches,
  listServicePackages,
  updateFieldPolicy,
  type FieldPolicy,
} from "@/lib/api/settings";
import {
  createUser,
  listRoles,
  listUsers,
  resetUserPassword,
  updateUser,
  type DirectoryRole,
  type DirectoryUser,
} from "@/lib/api/users";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Platform settings — Sapling Global" }] }),
  component: SettingsPage,
});

const checkTypes = [
  "IDENTITY",
  "ADDRESS",
  "EMPLOYMENT",
  "EDUCATION",
  "CRIMINAL",
  "COURT_RECORD",
  "REFERENCE",
  "GLOBAL_DATABASE",
  "DRUG_TEST",
];

const roleDescriptions: Record<string, string> = {
  PLATFORM_ADMIN: "Full platform configuration and access control",
  OPS_MANAGER: "Case allocation, SLA monitoring and exceptions",
  VERIFIER: "Assigned checks, findings and source verification",
  QA_REVIEWER: "Independent quality review and case approval",
  CLIENT_ADMIN: "Client-scoped case intake and portfolio access",
  FIELD_EXECUTIVE: "Field visits, GPS and evidence collection",
  SALES_MANAGER: "Opportunity pipeline and commercial activity",
  FINANCE_MANAGER: "Invoices, receivables and payment recording",
};

const branchScopedRoles = new Set(["OPS_MANAGER", "VERIFIER", "QA_REVIEWER", "FIELD_EXECUTIVE"]);

type SettingsSection = "ACCESS" | "ORGANISATION" | "SERVICES" | "FIELD" | "AUDIT";

function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("ACCESS");
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const canReadUsers =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("user:read");
  const canWriteUsers =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("user:write");
  const canReadAudit =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("audit:read");
  const canManageClients =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("client:write");
  const policy = useQuery({ queryKey: ["settings", "field-policy"], queryFn: getFieldPolicy });
  const branches = useQuery({ queryKey: ["settings", "branches"], queryFn: listBranches });
  const packages = useQuery({ queryKey: ["settings", "packages"], queryFn: listServicePackages });
  const users = useQuery({
    queryKey: ["users", "management"],
    queryFn: () => listUsers(),
    enabled: Boolean(canReadUsers),
  });
  const roles = useQuery({
    queryKey: ["users", "roles"],
    queryFn: listRoles,
    enabled: Boolean(canReadUsers),
  });
  const clients = useQuery({
    queryKey: ["clients", "user-management"],
    queryFn: listClients,
    enabled: Boolean(canWriteUsers || canManageClients),
  });
  const audit = useQuery({
    queryKey: ["audit-events"],
    queryFn: () => listAuditEvents(),
    enabled: Boolean(canReadAudit),
  });
  return (
    <div className="canvas-mesh min-h-screen bg-background text-foreground lg:pl-64">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onRefresh={() => {
            void policy.refetch();
            void branches.refetch();
            void packages.refetch();
            if (canReadUsers) {
              void users.refetch();
              void roles.refetch();
            }
            if (canReadAudit) void audit.refetch();
          }}
          isRefreshing={policy.isFetching || branches.isFetching || packages.isFetching}
        />
        <main className="flex-1 space-y-4 px-4 pb-10 sm:px-6">
          <PageHeader
            title="Settings"
            subtitle="Access, organisation and workflow controls"
            chip={
              policy.data
                ? `Version ${policy.data.version} · ${formatDate(policy.data.updatedAt)}`
                : "Loading configuration"
            }
          />
          {policy.isError || branches.isError || packages.isError ? (
            <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
              {policy.error?.message ?? branches.error?.message ?? packages.error?.message}
            </div>
          ) : null}

          <SettingsSectionNav
            active={activeSection}
            onChange={setActiveSection}
            showAccess={Boolean(canReadUsers)}
            showAudit={Boolean(canReadAudit)}
          />

          {activeSection === "ACCESS" && canReadUsers ? (
            <section id="user-access">
              <UserPanel
                users={users.data?.items ?? []}
                roles={roles.data?.items ?? []}
                branches={branches.data?.items ?? []}
                clients={clients.data?.items ?? []}
                canWrite={Boolean(canWriteUsers)}
              />
            </section>
          ) : null}

          {activeSection === "ORGANISATION" ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <BranchPanel items={branches.data?.items ?? []} />
              {canManageClients ? <ClientPanel items={clients.data?.items ?? []} /> : null}
            </div>
          ) : null}

          {activeSection === "SERVICES" ? (
            <PackagePanel items={packages.data?.items ?? []} />
          ) : null}

          {activeSection === "FIELD" ? (
            <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
              <PolicyForm policy={policy.data} />
              <Panel title="Privacy guardrails" subtitle="Built-in enforcement">
                <ul className="space-y-2">
                  {[
                    { icon: ShieldCheck, text: "No continuous location tracking" },
                    { icon: Camera, text: "Integrity-hashed evidence" },
                    { icon: Timer, text: "Controlled retention window" },
                    { icon: MapPin, text: "Restricted location access" },
                  ].map((item) => (
                    <li
                      key={item.text}
                      className="flex items-center gap-3 rounded-2xl bg-secondary/55 p-3"
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">{item.text}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          ) : null}

          {activeSection === "AUDIT" && canReadAudit ? (
            <AuditPanel items={audit.data?.items ?? []} loading={audit.isLoading} />
          ) : null}
        </main>
      </div>
    </div>
  );
}

function SettingsSectionNav({
  active,
  onChange,
  showAccess,
  showAudit,
}: {
  active: SettingsSection;
  onChange: (section: SettingsSection) => void;
  showAccess: boolean;
  showAudit: boolean;
}) {
  const sections: Array<{
    key: SettingsSection;
    label: string;
    icon: typeof UsersRound;
    visible: boolean;
  }> = [
    { key: "ACCESS", label: "Access", icon: UsersRound, visible: showAccess },
    { key: "ORGANISATION", label: "Organisation", icon: Building2, visible: true },
    { key: "SERVICES", label: "Services", icon: Boxes, visible: true },
    { key: "FIELD", label: "Field policy", icon: SlidersHorizontal, visible: true },
    { key: "AUDIT", label: "Audit", icon: History, visible: showAudit },
  ];
  return (
    <nav
      aria-label="Settings sections"
      className="surface flex gap-1 overflow-x-auto rounded-2xl p-1.5"
    >
      {sections
        .filter((section) => section.visible)
        .map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => onChange(section.key)}
            aria-current={active === section.key ? "page" : undefined}
            className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-semibold transition-all ${
              active === section.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/80 hover:text-foreground"
            }`}
          >
            <section.icon className="h-4 w-4" />
            {section.label}
          </button>
        ))}
    </nav>
  );
}

function ClientPanel({ items }: { items: ClientOption[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    code: "",
    legalName: "",
    displayName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    slaHours: 72,
  });
  const create = useMutation({
    mutationFn: () =>
      createClient({
        code: draft.code.trim(),
        legalName: draft.legalName.trim(),
        displayName: draft.displayName.trim(),
        slaHours: draft.slaHours,
        ...(draft.contactName.trim() ? { contactName: draft.contactName.trim() } : {}),
        ...(draft.contactEmail.trim() ? { contactEmail: draft.contactEmail.trim() } : {}),
        ...(draft.contactPhone.trim() ? { contactPhone: draft.contactPhone.trim() } : {}),
      }),
    onSuccess: async () => {
      setOpen(false);
      setDraft({
        code: "",
        legalName: "",
        displayName: "",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        slaHours: 72,
      });
      toast.success("Client workspace created");
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const valid =
    draft.code.trim().length >= 2 &&
    draft.legalName.trim().length >= 2 &&
    draft.displayName.trim().length >= 2 &&
    draft.slaHours >= 4 &&
    draft.slaHours <= 720;
  return (
    <Panel title="Client administration" subtitle="Onboard workspaces, SLA and account status">
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> {open ? "Close" : "Add client"}
        </button>
      </div>
      {open ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) create.mutate();
          }}
          className="mb-5 grid gap-2 rounded-2xl bg-secondary/40 p-4 sm:grid-cols-2"
        >
          <input
            value={draft.code}
            onChange={(event) => setDraft((value) => ({ ...value, code: event.target.value }))}
            maxLength={32}
            placeholder="Client code"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
          <input
            value={draft.displayName}
            onChange={(event) =>
              setDraft((value) => ({ ...value, displayName: event.target.value }))
            }
            maxLength={120}
            placeholder="Display name"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
          <input
            value={draft.legalName}
            onChange={(event) => setDraft((value) => ({ ...value, legalName: event.target.value }))}
            maxLength={180}
            placeholder="Legal name"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
          <input
            value={draft.contactName}
            onChange={(event) =>
              setDraft((value) => ({ ...value, contactName: event.target.value }))
            }
            maxLength={120}
            placeholder="Primary contact (optional)"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
          <input
            type="email"
            value={draft.contactEmail}
            onChange={(event) =>
              setDraft((value) => ({ ...value, contactEmail: event.target.value }))
            }
            placeholder="Contact email (optional)"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
          <input
            value={draft.contactPhone}
            onChange={(event) =>
              setDraft((value) => ({ ...value, contactPhone: event.target.value }))
            }
            placeholder="Contact phone in E.164 format"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
          <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs text-muted-foreground">
            SLA
            <input
              type="number"
              min={4}
              max={720}
              value={draft.slaHours}
              onChange={(event) =>
                setDraft((value) => ({ ...value, slaHours: Number(event.target.value) }))
              }
              className="min-w-0 flex-1 bg-transparent text-right text-sm text-foreground outline-none"
            />
            hours
          </label>
          <button
            disabled={!valid || create.isPending}
            className="h-10 rounded-full bg-accent px-4 text-xs font-semibold text-accent-foreground disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Create client workspace"}
          </button>
        </form>
      ) : null}
      {items.length ? (
        <div className="divide-y divide-[var(--hairline)]">
          {items.map((client) => (
            <ClientRow key={client.publicId} client={client} />
          ))}
        </div>
      ) : (
        <Empty text="No clients configured" />
      )}
    </Panel>
  );
}

function ClientRow({ client }: { client: ClientOption }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(client.displayName);
  const [slaHours, setSlaHours] = useState(client.slaHours);
  const save = useMutation({
    mutationFn: () =>
      updateClient(client.publicId, {
        version: client.version,
        displayName: displayName.trim(),
        slaHours,
      }),
    onSuccess: async () => {
      setEditing(false);
      toast.success("Client settings updated");
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const status = useMutation({
    mutationFn: () =>
      updateClient(client.publicId, {
        version: client.version,
        status: client.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
      }),
    onSuccess: async () => {
      toast.success(client.status === "ACTIVE" ? "Client suspended" : "Client reactivated");
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-secondary">
        <Building2 className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
            />
            <label className="flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs">
              SLA
              <input
                type="number"
                min={4}
                max={720}
                value={slaHours}
                onChange={(event) => setSlaHours(Number(event.target.value))}
                className="min-w-0 flex-1 bg-transparent text-right outline-none"
              />
              h
            </label>
          </div>
        ) : (
          <>
            <p className="truncate text-sm font-semibold">{client.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {client.code} · {client.legalName} · {client.slaHours}h SLA
            </p>
          </>
        )}
      </div>
      <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold">
        {humanize(client.status)}
      </span>
      {editing ? (
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={
            save.isPending || displayName.trim().length < 2 || slaHours < 4 || slaHours > 720
          }
          className="rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-foreground disabled:opacity-50"
        >
          Save
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold"
        >
          Edit
        </button>
      )}
      <button
        type="button"
        onClick={() => status.mutate()}
        disabled={status.isPending}
        className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
      >
        {client.status === "ACTIVE" ? "Suspend" : "Reactivate"}
      </button>
    </div>
  );
}

function AuditPanel({ items, loading }: { items: AuditEvent[]; loading: boolean }) {
  const [search, setSearch] = useState("");
  const [resource, setResource] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const resourceTypes = [...new Set(items.map((item) => item.resourceType))].sort();
  const query = search.trim().toLowerCase();
  const filtered = items.filter((event) => {
    const matchesResource = resource === "ALL" || event.resourceType === resource;
    const matchesSearch =
      !query ||
      [
        event.action,
        event.resourceType,
        event.resourcePublicId,
        event.requestId,
        event.actor?.displayName,
        event.actor?.email,
      ].some((value) => value?.toLowerCase().includes(query));
    return matchesResource && matchesSearch;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [search, resource]);
  useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages]);

  return (
    <Panel
      title="Audit trail"
      subtitle={`${items.length} recent immutable security and workflow events`}
      action={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <label className="relative sm:w-80">
            <span className="sr-only">Search audit activity</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search event, actor or request ID"
              className="h-12 w-full rounded-full border-0 bg-secondary/75 pl-11 pr-4 text-sm outline-none ring-1 ring-transparent transition focus:bg-card focus:ring-border"
            />
          </label>
          <select
            value={resource}
            onChange={(event) => setResource(event.target.value)}
            aria-label="Filter audit events by resource"
            className="h-12 rounded-full border-0 bg-secondary/75 px-5 text-sm outline-none ring-1 ring-transparent focus:bg-card focus:ring-border sm:min-w-44"
          >
            <option value="ALL">All resources</option>
            {resourceTypes.map((type) => (
              <option key={type} value={type}>
                {humanize(type)}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <div className="space-y-4">
        {loading ? <div className="h-48 animate-pulse rounded-2xl bg-secondary" /> : null}
        {!loading && !visibleItems.length ? (
          <Empty
            text={
              items.length ? "No activity matches these filters" : "No audit events recorded yet"
            }
          />
        ) : null}
        {visibleItems.length ? (
          <div className="relative space-y-2 before:absolute before:bottom-5 before:left-[5px] before:top-5 before:w-px before:bg-border">
            {visibleItems.map((event) => {
              const category = auditCategory(event);
              return (
                <div key={event.id} className="relative pl-6">
                  <span className="absolute left-0 top-1/2 z-10 h-[11px] w-[11px] -translate-y-1/2 rounded-full border-2 border-card bg-border" />
                  <article className="flex flex-col gap-3 rounded-[1.4rem] bg-secondary/70 px-4 py-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Fingerprint className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <p className="truncate text-sm font-semibold sm:text-[15px]">
                        {formatAuditAction(event.action)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-8 text-xs text-muted-foreground sm:justify-end sm:pl-0">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-semibold ${category.className}`}
                      >
                        {category.label}
                      </span>
                      <span className="whitespace-nowrap">
                        {event.actor?.displayName ?? "System"}
                      </span>
                      <span className="whitespace-nowrap">
                        {humanize(event.resourceType)}
                        {event.resourcePublicId ? ` · ${event.resourcePublicId.slice(0, 8)}` : ""}
                      </span>
                      <time className="whitespace-nowrap" dateTime={event.createdAt}>
                        {formatDate(event.createdAt)}
                      </time>
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        ) : null}
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>
    </Panel>
  );
}

function PolicyForm({ policy }: { policy: FieldPolicy | undefined }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Omit<FieldPolicy, "publicId" | "updatedAt"> | null>(null);
  useEffect(() => {
    if (policy) {
      setDraft({
        defaultRadiusMeters: policy.defaultRadiusMeters,
        maxAccuracyMeters: policy.maxAccuracyMeters,
        minimumPhotos: policy.minimumPhotos,
        retentionDays: policy.retentionDays,
        requireCheckout: policy.requireCheckout,
        outsideGeofencePolicy: policy.outsideGeofencePolicy,
        version: policy.version,
      });
    }
  }, [policy]);
  const mutation = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error("Policy is still loading");
      return updateFieldPolicy(draft);
    },
    onSuccess: async () => {
      toast.success("Field policy saved");
      await queryClient.invalidateQueries({ queryKey: ["settings", "field-policy"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (!draft)
    return (
      <Panel title="Field verification policy" subtitle="Loading persisted configuration">
        <div className="h-72 animate-pulse rounded-2xl bg-secondary" />
      </Panel>
    );
  const numberField = (
    key: "defaultRadiusMeters" | "maxAccuracyMeters" | "minimumPhotos" | "retentionDays",
    value: number,
  ) => setDraft((current) => (current ? { ...current, [key]: value } : current));
  return (
    <Panel
      title="Field verification policy"
      subtitle="Defaults applied to all newly assigned visits"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label="Default geofence radius"
          hint="Valid visit distance from target"
          value={draft.defaultRadiusMeters}
          suffix="metres"
          setValue={(value) => numberField("defaultRadiusMeters", value)}
        />
        <NumberField
          label="Maximum GPS inaccuracy"
          hint="Reject fixes coarser than this"
          value={draft.maxAccuracyMeters}
          suffix="metres"
          setValue={(value) => numberField("maxAccuracyMeters", value)}
        />
        <NumberField
          label="Minimum evidence photos"
          hint="Required before visit completion"
          value={draft.minimumPhotos}
          suffix="photos"
          setValue={(value) => numberField("minimumPhotos", value)}
        />
        <NumberField
          label="Evidence retention"
          hint="Configured retention window"
          value={draft.retentionDays}
          suffix="days"
          setValue={(value) => numberField("retentionDays", value)}
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between rounded-2xl bg-secondary/55 p-4 text-sm">
          <span>
            <span className="font-semibold">Check-out required</span>
            <span className="block text-xs text-muted-foreground">
              Second GPS fix closes a visit
            </span>
          </span>
          <input
            type="checkbox"
            checked={draft.requireCheckout}
            onChange={(event) => setDraft({ ...draft, requireCheckout: event.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
        </label>
        <label className="rounded-2xl bg-secondary/55 p-3 text-xs font-semibold">
          Outside geofence
          <select
            value={draft.outsideGeofencePolicy}
            onChange={(event) =>
              setDraft({
                ...draft,
                outsideGeofencePolicy: event.target.value as FieldPolicy["outsideGeofencePolicy"],
              })
            }
            className="mt-2 h-9 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal"
          >
            {["BLOCK", "SUPERVISOR_APPROVAL", "ALLOW_AND_FLAG"].map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {mutation.isPending ? "Saving…" : "Save policy"}
      </button>
    </Panel>
  );
}

function BranchPanel({ items }: { items: Awaited<ReturnType<typeof listBranches>>["items"] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      createBranch({
        code: code.trim(),
        name: name.trim(),
        ...(city.trim() ? { city: city.trim() } : {}),
      }),
    onSuccess: async () => {
      toast.success("Branch created");
      setOpen(false);
      setCode("");
      setName("");
      setCity("");
      await queryClient.invalidateQueries({ queryKey: ["settings", "branches"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Panel
      title="Operating branches"
      subtitle="Tenant locations available for user and case assignment"
      action={
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5" /> Add branch
        </button>
      }
    >
      {open ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim().length >= 2 && name.trim().length >= 2) mutation.mutate();
          }}
          className="mb-4 grid gap-2 rounded-2xl bg-secondary/40 p-3 sm:grid-cols-3"
        >
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Code"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Branch name"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="City (optional)"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
          <button
            disabled={mutation.isPending}
            className="h-9 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground sm:col-span-3"
          >
            {mutation.isPending ? "Creating…" : "Create branch"}
          </button>
        </form>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-secondary/45 p-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-background">
              <Building2 className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{item.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.code}
                {item.city ? ` · ${item.city}` : ""}
              </p>
            </div>
            <span className={`h-2 w-2 rounded-full ${item.isActive ? "bg-accent" : "bg-muted"}`} />
          </div>
        ))}
        {!items.length ? <Empty text="No branches configured" /> : null}
      </div>
    </Panel>
  );
}

function PackagePanel({
  items,
}: {
  items: Awaited<ReturnType<typeof listServicePackages>>["items"];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [tatHours, setTatHours] = useState(72);
  const [checks, setChecks] = useState<string[]>(["IDENTITY"]);
  const mutation = useMutation({
    mutationFn: () =>
      createServicePackage({
        code: code.trim(),
        name: name.trim(),
        checks,
        ...(price ? { price: Number(price) } : {}),
        tatHours,
      }),
    onSuccess: async () => {
      toast.success("Service package created");
      setOpen(false);
      setCode("");
      setName("");
      setPrice("");
      setChecks(["IDENTITY"]);
      await queryClient.invalidateQueries({ queryKey: ["settings", "packages"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Panel
      title="Service catalogue"
      subtitle="Reusable check bundles and commercial defaults"
      action={
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5" /> Add package
        </button>
      }
    >
      {open ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim().length >= 2 && name.trim().length >= 2 && checks.length)
              mutation.mutate();
          }}
          className="mb-4 space-y-3 rounded-2xl bg-secondary/40 p-3"
        >
          <div className="grid gap-2 sm:grid-cols-4">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Code"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            />
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Package name"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            />
            <input
              type="number"
              min="0"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="Price INR"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            />
            <input
              type="number"
              min="1"
              value={tatHours}
              onChange={(event) => setTatHours(Number(event.target.value))}
              placeholder="TAT hours"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {checkTypes.map((check) => (
              <button
                key={check}
                type="button"
                onClick={() =>
                  setChecks((current) =>
                    current.includes(check)
                      ? current.filter((item) => item !== check)
                      : [...current, check],
                  )
                }
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${checks.includes(check) ? "bg-accent text-accent-foreground" : "bg-background text-muted-foreground"}`}
              >
                {humanize(check)}
              </button>
            ))}
          </div>
          <button
            disabled={mutation.isPending || !checks.length}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            {mutation.isPending ? "Creating…" : "Create package"}
          </button>
        </form>
      ) : null}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-secondary/45 p-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-background">
              <Boxes className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{item.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.checks.length} checks · {item.tatHours}h TAT
              </p>
            </div>
            <p className="text-xs font-semibold">
              {item.price == null ? "Custom" : money(Number(item.price))}
            </p>
          </div>
        ))}
        {!items.length ? <Empty text="No service packages configured" /> : null}
      </div>
    </Panel>
  );
}

function UserPanel({
  users,
  roles,
  branches,
  clients,
  canWrite,
}: {
  users: DirectoryUser[];
  roles: DirectoryRole[];
  branches: Awaited<ReturnType<typeof listBranches>>["items"];
  clients: Awaited<ReturnType<typeof listClients>>["items"];
  canWrite: boolean;
}) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [roleCodes, setRoleCodes] = useState<string[]>([]);
  const [branchId, setBranchId] = useState("");
  const [clientId, setClientId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [createdCredential, setCreatedCredential] = useState<{
    email: string;
    temporaryPassword: string;
    roles: string[];
  } | null>(null);
  const requiresClient = roleCodes.includes("CLIENT_ADMIN");
  const supportsBranch = roleCodes.some((role) => branchScopedRoles.has(role));
  const query = userSearch.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !query ||
      user.displayName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.client?.displayName.toLowerCase().includes(query) ||
      user.branch?.name.toLowerCase().includes(query);
    const matchesRole = roleFilter === "ALL" || user.roles.some((role) => role.code === roleFilter);
    const matchesStatus = statusFilter === "ALL" || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });
  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const visibleUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [userSearch, roleFilter, statusFilter]);
  useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages]);
  useEffect(() => {
    if (!requiresClient) setClientId("");
    if (!supportsBranch) setBranchId("");
  }, [requiresClient, supportsBranch]);

  const mutation = useMutation({
    mutationFn: (generatedPassword: string) =>
      createUser({
        email: email.trim(),
        displayName: displayName.trim(),
        roleCodes,
        temporaryPassword: generatedPassword,
        ...(branchId ? { branchId } : {}),
        ...(clientId ? { clientId } : {}),
      }),
    onSuccess: async (_result, generatedPassword) => {
      setCreatedCredential({
        email: email.trim(),
        temporaryPassword: generatedPassword,
        roles: [...roleCodes],
      });
      toast.success("User account created", {
        description: "The new sign-in details are ready to copy below.",
      });
      setDisplayName("");
      setEmail("");
      setRoleCodes([]);
      setBranchId("");
      setClientId("");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <Panel title="User IDs & access" subtitle="Create an account and assign its access scope">
        {createdCredential ? (
          <div className="mb-5 rounded-3xl border border-accent/45 bg-gradient-to-br from-accent/20 via-card to-card p-5 shadow-[0_22px_50px_-30px_var(--accent),inset_0_1px_0_color-mix(in_oklab,white_72%,transparent)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold">User ID created successfully</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Share these details securely. The temporary password must be changed at first
                  sign-in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreatedCredential(null)}
                className="self-start rounded-full bg-background px-3 py-1.5 text-xs font-semibold"
              >
                Dismiss
              </button>
            </div>
            <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <CredentialItem label="Workspace code" value="SAPLING" />
              <CredentialItem label="Email / User ID" value={createdCredential.email} />
              <CredentialItem
                label="Temporary password"
                value={createdCredential.temporaryPassword}
                secret
              />
              <CredentialItem
                label="Assigned roles"
                value={createdCredential.roles.map(humanize).join(", ")}
              />
            </dl>
            <button
              type="button"
              onClick={() =>
                copyText(
                  `Workspace: SAPLING\nEmail: ${createdCredential.email}\nTemporary password: ${createdCredential.temporaryPassword}\nRoles: ${createdCredential.roles.map(humanize).join(", ")}`,
                  "Sign-in details copied",
                )
              }
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
            >
              <Copy className="h-3.5 w-3.5" /> Copy sign-in details
            </button>
          </div>
        ) : null}
        {canWrite ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (
                displayName.trim().length >= 2 &&
                email.includes("@") &&
                roleCodes.length &&
                (!requiresClient || clientId)
              )
                mutation.mutate(generateTemporaryPassword());
            }}
            className="grid gap-7 lg:grid-cols-[24rem_minmax(0,1fr)]"
          >
            <div className="space-y-5">
              <FieldLabel label="Full name" hint="Shown across assignments and audit history">
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="e.g. Sapling Operations Manager"
                  autoComplete="off"
                  className="mt-2 h-12 w-full rounded-full border-0 bg-secondary/75 px-5 text-sm outline-none ring-1 ring-transparent focus:bg-card focus:ring-border"
                />
              </FieldLabel>
              <FieldLabel label="Work email" hint="This becomes the user ID for sign-in">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  autoComplete="off"
                  className="mt-2 h-12 w-full rounded-full border-0 bg-secondary/75 px-5 text-sm outline-none ring-1 ring-transparent focus:bg-card focus:ring-border"
                />
              </FieldLabel>

              {supportsBranch ? (
                <FieldLabel label="Operating branch" hint="Optional branch scope">
                  <select
                    value={branchId}
                    onChange={(event) => setBranchId(event.target.value)}
                    className="mt-2 h-12 w-full rounded-full border-0 bg-secondary/75 px-5 text-sm outline-none"
                  >
                    <option value="">Tenant-wide / no branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
              ) : null}

              {requiresClient ? (
                <FieldLabel label="Client workspace" hint="Required for a Client Admin">
                  <select
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    className="mt-2 h-12 w-full rounded-full border-0 bg-secondary/75 px-5 text-sm outline-none"
                  >
                    <option value="">Select a client</option>
                    {clients.map((client) => (
                      <option key={client.publicId} value={client.publicId}>
                        {client.displayName}
                      </option>
                    ))}
                  </select>
                  {!clientId ? (
                    <span className="mt-2 block text-[10px] text-destructive">
                      Select a client workspace to continue.
                    </span>
                  ) : null}
                </FieldLabel>
              ) : null}
            </div>

            <div className="-mt-0.5 self-start">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Choose role</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Scope fields appear only when a role requires them
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold">
                  {roleCodes.length} selected
                </span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {roles.map((role) => (
                  <button
                    key={role.code}
                    type="button"
                    aria-pressed={roleCodes.includes(role.code)}
                    onClick={() =>
                      setRoleCodes((current) =>
                        current.includes(role.code)
                          ? current.filter((code) => code !== role.code)
                          : [...current, role.code],
                      )
                    }
                    className={`flex min-h-16 items-start gap-3 rounded-full px-4 py-3 text-left transition-all ${
                      roleCodes.includes(role.code)
                        ? "bg-accent/20 ring-1 ring-accent/60"
                        : "bg-secondary/70 hover:bg-secondary"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${roleCodes.includes(role.code) ? "border-accent bg-accent text-accent-foreground" : "border-muted-foreground/35 bg-card"}`}
                    >
                      {roleCodes.includes(role.code) ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">{humanize(role.code)}</span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
                        {roleDescriptions[role.code] ?? "Role-based platform access"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  disabled={
                    mutation.isPending ||
                    displayName.trim().length < 2 ||
                    !email.includes("@") ||
                    !roleCodes.length ||
                    (requiresClient && !clientId)
                  }
                  className="h-12 shrink-0 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-float)] disabled:bg-muted-foreground/55 disabled:shadow-none"
                >
                  {mutation.isPending ? "Creating…" : "Create user ID"}
                </button>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" /> A temporary password is generated once, after
                  the account is created.
                </p>
              </div>
            </div>
          </form>
        ) : null}
      </Panel>

      <Panel
        title="User directory"
        subtitle={`${users.length} accounts · search, filter and access controls`}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <label className="relative">
              <span className="sr-only">Search users</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search name, email or scope"
                className="h-11 w-full rounded-full border-0 bg-secondary/75 pl-11 pr-4 text-sm outline-none ring-1 ring-transparent focus:bg-card focus:ring-border sm:w-72"
              />
            </label>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              aria-label="Filter users by role"
              className="h-11 rounded-full border-0 bg-secondary/75 px-5 text-sm outline-none sm:min-w-40"
            >
              <option value="ALL">All roles</option>
              {roles.map((role) => (
                <option key={role.code} value={role.code}>
                  {humanize(role.code)}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter users by status"
              className="h-11 rounded-full border-0 bg-secondary/75 px-5 text-sm outline-none sm:min-w-36"
            >
              <option value="ALL">All access</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        }
      >
        <div className="space-y-4">
          {visibleUsers.length ? (
            <div className="space-y-2">
              {visibleUsers.map((user) => (
                <UserRow key={user.id} user={user} canWrite={canWrite} />
              ))}
            </div>
          ) : (
            <Empty text={users.length ? "No users match these filters" : "No users available"} />
          )}
          <PaginationControls
            page={page}
            totalPages={totalPages}
            totalItems={filteredUsers.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      </Panel>
    </div>
  );
}

function UserRow({ user, canWrite }: { user: DirectoryUser; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [revealedPassword, setRevealedPassword] = useState("");
  const status = useMutation({
    mutationFn: () =>
      updateUser(user.id, {
        version: user.version,
        status: user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
      }),
    onSuccess: async () => {
      toast.success(user.status === "ACTIVE" ? "User suspended" : "User reactivated");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const reset = useMutation({
    mutationFn: (password: string) => resetUserPassword(user.id, password),
    onSuccess: () =>
      toast.success("Temporary password set", {
        description: "All existing sessions were revoked.",
      }),
    onError: (error: Error) => toast.error(error.message),
  });
  const roleLabel = user.roles.map((role) => humanize(role.code)).join(", ");
  const scopeLabel = user.client?.displayName ?? user.branch?.name ?? "Tenant-wide";
  return (
    <article className="rounded-[1.5rem] bg-secondary/70 px-4 py-3 transition-colors hover:bg-secondary">
      <div className="grid gap-4 lg:grid-cols-[minmax(15rem,1.35fr)_minmax(15rem,1fr)_minmax(9rem,.7fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-xs font-bold ${avatarTone(user.roles[0]?.code)}`}
          >
            {initialsFor(user.displayName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.displayName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Detail label="Role · Scope" value={`${roleLabel} · ${scopeLabel}`} />
        <Detail
          label="Last login"
          value={user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
        />
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${user.status === "ACTIVE" ? "bg-success text-success-foreground" : "bg-destructive/10 text-destructive"}`}
          >
            {humanize(user.status)}
          </span>
          {canWrite ? (
            <>
              <button
                type="button"
                onClick={() => status.mutate()}
                disabled={status.isPending}
                className="h-9 rounded-full bg-card px-4 text-[10px] font-semibold shadow-sm"
              >
                {user.status === "ACTIVE" ? "Suspend" : "Reactivate"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const password = generateTemporaryPassword();
                  setRevealedPassword(password);
                  reset.mutate(password);
                }}
                disabled={reset.isPending}
                aria-label={`Reset password for ${user.displayName}`}
                title="Reset password"
                className="grid h-9 w-9 place-items-center rounded-full bg-card shadow-sm"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
        </div>
      </div>
      {revealedPassword ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-warning-foreground">
              New temporary password
            </p>
            <code className="mt-1 block break-all text-xs font-semibold">{revealedPassword}</code>
          </div>
          <button
            type="button"
            onClick={() => copyText(revealedPassword, "Temporary password copied")}
            className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-2 text-[10px] font-semibold shadow-sm"
          >
            <Copy className="h-3 w-3" /> Copy
          </button>
        </div>
      ) : null}
    </article>
  );
}

function NumberField({
  label,
  hint,
  value,
  suffix,
  setValue,
}: {
  label: string;
  hint: string;
  value: number;
  suffix: string;
  setValue: (value: number) => void;
}) {
  return (
    <label className="rounded-2xl bg-secondary/55 p-3">
      <span className="text-xs font-semibold">{label}</span>
      <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>
      <span className="mt-2 flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          className="h-9 w-28 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <span className="text-xs text-muted-foreground">{suffix}</span>
      </span>
    </label>
  );
}

function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold">{label}</span>
      {hint ? (
        <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">{hint}</span>
      ) : null}
      {children}
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-xs font-medium" title={value}>
        {value}
      </p>
    </div>
  );
}

function PaginationControls({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const start = totalItems ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, totalItems);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
      <p className="text-[11px] text-muted-foreground">
        Showing{" "}
        <span className="font-semibold text-foreground">
          {start}–{end}
        </span>{" "}
        of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card shadow-sm disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-20 text-center text-xs font-semibold">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card shadow-sm disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}
function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAuditAction(value: string) {
  return value
    .split(".")
    .map((segment) =>
      segment
        .replaceAll("_", "-")
        .split("-")
        .map((word) =>
          word ? `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}` : "",
        )
        .join("-"),
    )
    .join(".");
}

function auditCategory(event: AuditEvent) {
  const key = `${event.action} ${event.resourceType}`.toLowerCase();
  if (["auth", "login", "session", "token"].some((value) => key.includes(value))) {
    return { label: "AUTH", className: "bg-rose-100 text-rose-600" };
  }
  if (["invoice", "payment", "finance"].some((value) => key.includes(value))) {
    return { label: "FINANCE", className: "bg-sky-100 text-sky-700" };
  }
  if (["user", "role"].some((value) => key.includes(value))) {
    return { label: "USER", className: "bg-lime-300 text-lime-950" };
  }
  if (
    ["case", "check", "consent", "document", "report", "field", "clarification", "qa"].some(
      (value) => key.includes(value),
    )
  ) {
    return { label: "CASE", className: "bg-amber-100 text-amber-800" };
  }
  if (["client", "setting", "policy", "branch", "service"].some((value) => key.includes(value))) {
    return { label: "CONFIG", className: "bg-purple-100 text-purple-600" };
  }
  return { label: "SYSTEM", className: "bg-zinc-200 text-zinc-700" };
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*+-_";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const password = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
  return `Aa1!${password.slice(4)}`;
}

function CredentialItem({
  label,
  value,
  secret = false,
}: {
  label: string;
  value: string;
  secret?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const visibleValue = secret && !revealed ? "••••••••••••••••" : value;
  return (
    <div className="rounded-xl border border-border/70 bg-background/85 p-3 shadow-sm">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 flex min-w-0 items-center gap-2">
        <span className={`min-w-0 flex-1 break-all font-semibold ${secret ? "font-mono" : ""}`}>
          {visibleValue}
        </span>
        {secret ? (
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            aria-label={revealed ? "Hide temporary password" : "Show temporary password"}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground"
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </dd>
    </div>
  );
}

function initialsFor(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function avatarTone(role?: string) {
  const tones: Record<string, string> = {
    PLATFORM_ADMIN: "bg-zinc-900 text-white",
    OPS_MANAGER: "bg-amber-100 text-amber-700",
    VERIFIER: "bg-sky-100 text-sky-700",
    QA_REVIEWER: "bg-teal-100 text-teal-700",
    CLIENT_ADMIN: "bg-lime-300 text-lime-950",
    FIELD_EXECUTIVE: "bg-purple-100 text-purple-600",
    SALES_MANAGER: "bg-rose-100 text-rose-600",
    FINANCE_MANAGER: "bg-emerald-100 text-emerald-700",
  };
  return (role && tones[role]) || "bg-zinc-200 text-zinc-700";
}

function copyText(value: string, success: string) {
  void navigator.clipboard
    .writeText(value)
    .then(() => toast.success(success))
    .catch(() => toast.error("Copy failed; select the value manually"));
}
