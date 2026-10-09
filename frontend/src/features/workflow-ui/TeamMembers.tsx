import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  ListChecks,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  EmptyState,
  LoadingState,
  Panel,
  Pill,
  SearchField,
  SegmentTabs,
  StatCard,
  StatGrid,
} from "@/components/workspace/kit";
import { ExportSheetButton, type SheetColumn } from "@/components/workspace/export-sheet";
import { humanizeCode, istText } from "@/components/workspace/format";
import {
  TemporaryPasswordDialog,
  type TemporaryPasswordReceipt,
} from "@/features/users/components/temporary-password-dialog";
import { permissionLabel } from "@/features/users/role-guide";
import { temporaryPassword } from "@/lib/auth/temporary-password";
import {
  createTeamMember,
  getTeamMembers,
  resetTeamMemberPassword,
  setTeamMemberStatus,
  type TeamMember,
  type TeamMembersOverview,
} from "@/lib/backend-api/team-members";
import { cn } from "@/lib/utils";

type StatusView = "all" | "ACTIVE" | "SUSPENDED";

const EXPORT_COLUMNS: readonly SheetColumn<TeamMember>[] = [
  { key: "name", label: "Name", value: (m) => m.name },
  { key: "email", label: "Email", value: (m) => m.email },
  { key: "phone", label: "Phone", value: (m) => m.phone },
  { key: "team", label: "Team", value: (m) => m.team.name },
  {
    key: "teamRole",
    label: "Team role",
    value: (m) => (m.teamRole === "LEAD" ? "Team Leader" : "Member"),
  },
  { key: "status", label: "Status", value: (m) => humanizeCode(m.status) },
  { key: "access", label: "Access", value: (m) => (m.customAccess ? "Custom" : "Full") },
  { key: "openWork", label: "Open work", value: (m) => m.openWork },
  { key: "doneThisWeek", label: "Done (7 days)", value: (m) => m.doneThisWeek },
  { key: "lastLoginAt", label: "Last sign-in", value: (m) => istText(m.lastLoginAt) },
  { key: "createdAt", label: "Added", value: (m) => istText(m.createdAt) },
];
const EXPORT_DEFAULTS = ["name", "email", "team", "status", "openWork", "doneThisWeek"];

/** Team Leader: the people in its teams; add a login, suspend, reset a password. */
export function TeamMembers() {
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ["workflow", "team-members"],
    queryFn: ({ signal }) => getTeamMembers(signal),
  });
  const [status, setStatus] = useState<StatusView>("all");
  const [teamId, setTeamId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [receipt, setReceipt] = useState<TemporaryPasswordReceipt | null>(null);
  const data = overview.data;
  const members = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.members ?? []).filter(
      (member) =>
        (status === "all" || member.status === status) &&
        (teamId === "all" || member.team.id === teamId) &&
        (!term ||
          `${member.name} ${member.email} ${member.phone ?? ""}`.toLowerCase().includes(term)),
    );
  }, [data, status, teamId, search]);
  const all = data?.members ?? [];
  const active = all.filter((m) => m.status === "ACTIVE").length;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["workflow"] });
  return (
    <div className="grid gap-4">
      <StatGrid label="Team at a glance">
        <StatCard
          icon={UsersRound}
          tone="info"
          label="People"
          value={data ? all.length : "—"}
          hint={`${data?.teams.length ?? 0} team${data?.teams.length === 1 ? "" : "s"} you lead`}
        />
        <StatCard
          icon={ShieldCheck}
          tone="good"
          label="Active"
          value={data ? active : "—"}
          hint="Can sign in"
        />
        <StatCard
          icon={PauseCircle}
          tone={all.length - active ? "warn" : "neutral"}
          label="Suspended"
          value={data ? all.length - active : "—"}
          hint="Sign-in blocked"
        />
        <StatCard
          icon={ListChecks}
          tone="violet"
          label="Open work"
          value={data ? all.reduce((sum, m) => sum + m.openWork, 0) : "—"}
          hint={
            data ? `${all.reduce((sum, m) => sum + m.doneThisWeek, 0)} done in 7 days` : undefined
          }
        />
      </StatGrid>
      <Panel
        label="Team members"
        title="People in your team"
        count={members.length}
        description="Add a login for a new member, reset a password or suspend access. Everything is recorded."
        actions={
          <>
            <ExportSheetButton
              source="team-members"
              title="Export team members"
              filename="Sapling-Global-team-members"
              columns={EXPORT_COLUMNS}
              defaults={EXPORT_DEFAULTS}
              scopeNote="the people shown"
              disabled={!members.length}
              loadRows={() => Promise.resolve(members)}
            />
            <Button type="button" onClick={() => setAdding(true)} disabled={!data?.teams.length}>
              <UserPlus aria-hidden /> Add member
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3 px-5 pb-3">
          <SegmentTabs
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { id: "all", label: "All", count: all.length },
              { id: "ACTIVE", label: "Active", count: active },
              { id: "SUSPENDED", label: "Suspended", count: all.length - active },
            ]}
          />
          {data && data.teams.length > 1 ? (
            <select
              aria-label="Team"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700"
            >
              <option value="all">All teams</option>
              {data.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          ) : null}
          <SearchField
            className="min-w-56 flex-1"
            value={search}
            onChange={setSearch}
            placeholder="Search name, email or phone"
            label="Search team members"
          />
        </div>
        {overview.isError ? (
          <EmptyState tone="bad" title="Team unavailable" detail={overview.error.message} />
        ) : !data ? (
          <LoadingState label="Loading your team" />
        ) : !members.length ? (
          <EmptyState
            icon={UsersRound}
            tone="neutral"
            title={all.length ? "Nobody matches" : "No members yet"}
            detail={all.length ? "Try another filter." : "Add the first member of your team."}
            action={
              all.length ? undefined : (
                <Button onClick={() => setAdding(true)}>
                  <UserPlus aria-hidden /> Add member
                </Button>
              )
            }
          />
        ) : (
          <ul aria-label="Members" className="divide-y divide-slate-100 border-t border-slate-100">
            {members.map((member) => (
              <MemberRow
                key={`${member.team.id}:${member.id}`}
                member={member}
                onReceipt={setReceipt}
                onChanged={refresh}
              />
            ))}
          </ul>
        )}
      </Panel>
      {adding && data ? (
        <AddMemberDialog
          data={data}
          onClose={() => setAdding(false)}
          onCreated={(next) => {
            setAdding(false);
            setReceipt(next);
            void refresh();
          }}
        />
      ) : null}
      <TemporaryPasswordDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function MemberRow({
  member,
  onReceipt,
  onChanged,
}: {
  member: TeamMember;
  onReceipt: (receipt: TemporaryPasswordReceipt) => void;
  onChanged: () => Promise<unknown>;
}) {
  const suspended = member.status === "SUSPENDED";
  const toggle = useMutation({
    mutationFn: () =>
      setTeamMemberStatus(member.id, {
        status: suspended ? "ACTIVE" : "SUSPENDED",
        version: member.version,
      }),
    onSuccess: async (result) => {
      toast.success(
        suspended ? `${member.name} can sign in again` : `${member.name} is suspended`,
        {
          description:
            !suspended && result.openWork
              ? `${result.openWork} open check${result.openWork === 1 ? "" : "s"} still with them: reassign from the Team queue.`
              : undefined,
        },
      );
      await onChanged();
    },
    onError: (error: Error) => toast.error("Not changed", { description: error.message }),
  });
  const reset = useMutation({
    mutationFn: async () => {
      const password = temporaryPassword();
      await resetTeamMemberPassword(member.id, password);
      return password;
    },
    onSuccess: (password) =>
      onReceipt({ kind: "reset", fullName: member.name, email: member.email, password }),
    onError: (error: Error) => toast.error("Password not reset", { description: error.message }),
  });
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition hover:bg-slate-50 lg:grid-cols-[minmax(220px,1.4fr)_minmax(150px,1fr)_110px_120px_150px_40px]">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={member.name} tone={suspended ? "neutral" : "info"} />
        <div className="min-w-0">
          <strong
            className={cn(
              "block truncate text-[13.5px] font-semibold",
              suspended ? "text-slate-400" : "text-slate-900",
            )}
          >
            {member.name}
            {member.isYou ? " (you)" : ""}
          </strong>
          <small className="block truncate text-[11.5px] text-slate-500">
            {member.email}
            {member.phone ? ` · ${member.phone}` : ""}
          </small>
        </div>
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-1 lg:col-span-1">
        <Pill tone="info" dot={false}>
          {member.team.name}
        </Pill>
        {member.teamRole === "LEAD" ? (
          <Pill tone="violet" dot={false}>
            Team Leader
          </Pill>
        ) : null}
        {member.customAccess ? (
          <Pill tone="warn" dot={false}>
            Custom access
          </Pill>
        ) : null}
      </div>
      <Pill
        tone={suspended ? "warn" : "good"}
        className="col-start-2 row-start-1 justify-self-end lg:col-start-auto lg:row-start-auto lg:justify-self-start"
      >
        {humanizeCode(member.status)}
      </Pill>
      <div className="hidden text-[12.5px] text-slate-600 lg:block">
        <strong className="tabular-nums text-slate-900">{member.openWork}</strong> open
        <small className="block text-[11.5px] text-slate-400">
          {member.doneThisWeek} done · 7 days
        </small>
      </div>
      <div className="hidden text-[12px] text-slate-500 lg:block">
        {member.lastLoginAt ? `Signed in ${istText(member.lastLoginAt)}` : "Never signed in"}
      </div>
      <div className="col-start-2 row-start-2 justify-self-end lg:col-start-auto lg:row-start-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${member.name}`}
              disabled={!member.canManage}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>{member.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={reset.isPending} onSelect={() => reset.mutate()}>
              <KeyRound aria-hidden /> Reset password
            </DropdownMenuItem>
            <DropdownMenuItem disabled={toggle.isPending} onSelect={() => toggle.mutate()}>
              {suspended ? <PlayCircle aria-hidden /> : <PauseCircle aria-hidden />}
              {suspended ? "Reactivate" : "Suspend"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

const STEPS = ["Details", "Team & access", "Review"] as const;

function AddMemberDialog({
  data,
  onClose,
  onCreated,
}: {
  data: TeamMembersOverview;
  onClose: () => void;
  onCreated: (receipt: TemporaryPasswordReceipt) => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [teamId, setTeamId] = useState(data.teams[0]?.id ?? "");
  const [fullAccess, setFullAccess] = useState(true);
  const [ticked, setTicked] = useState<string[]>([]);
  const [password, setPassword] = useState(() => temporaryPassword());
  const team = data.teams.find((t) => t.id === teamId);
  const role = data.roles.find((r) => r.code === team?.memberRole);
  const allPermissions = role?.permissions ?? [];
  const chosen = fullAccess ? allPermissions : ticked;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneOk = !phone.trim() || /^(\+?91[-\s]?)?[6-9]\d{9}$/.test(phone.replace(/\s/g, ""));
  const detailsOk = name.trim().length >= 2 && emailOk && phoneOk;
  const accessOk = Boolean(team) && (fullAccess || ticked.length > 0);
  const create = useMutation({
    mutationFn: () =>
      createTeamMember({
        displayName: name.trim(),
        email: email.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        temporaryPassword: password,
        departmentId: teamId,
        ...(fullAccess ? {} : { permissions: ticked }),
      }),
    onSuccess: (created) => {
      toast.success(`${created.displayName} added to ${team?.name}`);
      onCreated({ kind: "created", fullName: created.displayName, email: created.email, password });
    },
    onError: (error: Error) => toast.error("Not created", { description: error.message }),
  });
  const canNext = step === 0 ? detailsOk : step === 1 ? accessOk : true;
  return (
    <Dialog open onOpenChange={(open) => (!open && !create.isPending ? onClose() : undefined)}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl p-0"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b border-slate-100 px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-blue-600" aria-hidden /> Add team member
          </DialogTitle>
          <DialogDescription>
            They get a {role?.name ?? "team"} login in your team and change the password at first
            sign-in.
          </DialogDescription>
          <ol className="mt-3 flex items-center gap-2" aria-label="Steps">
            {STEPS.map((label, index) => (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-[11px] font-bold",
                    index < step
                      ? "bg-emerald-500 text-white"
                      : index === step
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-500",
                  )}
                >
                  {index < step ? <Check className="size-3.5" aria-hidden /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-[12.5px] font-semibold",
                    index === step ? "text-slate-900" : "text-slate-500",
                  )}
                >
                  {label}
                </span>
                {index < STEPS.length - 1 ? (
                  <span className="h-px w-6 bg-slate-200" aria-hidden />
                ) : null}
              </li>
            ))}
          </ol>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          {step === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" className="sm:col-span-2">
                <input
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Asha Verma"
                />
              </Field>
              <Field
                label="Work email"
                error={email && !emailOk ? "Enter a valid email." : undefined}
              >
                <input
                  type="email"
                  value={email}
                  maxLength={200}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="asha@company.com"
                />
              </Field>
              <Field
                label="Mobile (optional)"
                error={!phoneOk ? "Enter a 10-digit Indian mobile." : undefined}
              >
                <input
                  value={phone}
                  maxLength={16}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98765 43210"
                />
              </Field>
            </div>
          ) : null}
          {step === 1 ? (
            <div className="grid gap-5">
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-[13px] font-semibold text-slate-800">Team</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.teams.map((option) => (
                    <label
                      key={option.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-3",
                        teamId === option.id
                          ? "border-blue-400 bg-blue-50 ring-2 ring-blue-500/20"
                          : "border-slate-200 hover:bg-slate-50",
                      )}
                    >
                      <input
                        type="radio"
                        name="team"
                        className="sr-only"
                        checked={teamId === option.id}
                        onChange={() => {
                          setTeamId(option.id);
                          setTicked([]);
                        }}
                      />
                      <UsersRound className="size-4 text-blue-600" aria-hidden />
                      <span>
                        <strong className="block text-[13.5px] text-slate-900">
                          {option.name}
                        </strong>
                        <small className="text-[12px] text-slate-500">
                          Login as {option.memberRole === "VERIFIER" ? "Verifier" : "Data Entry"}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-[13px] font-semibold text-slate-800">Access</legend>
                <SegmentTabs
                  label="Access level"
                  value={fullAccess ? "full" : "custom"}
                  onChange={(value) => {
                    setFullAccess(value === "full");
                    if (value === "custom" && !ticked.length) setTicked(allPermissions);
                  }}
                  options={[
                    { id: "full", label: "Full access" },
                    { id: "custom", label: "Customise" },
                  ]}
                />
                {fullAccess ? (
                  <p className="text-[12.5px] text-slate-500">
                    Everything a {role?.name ?? "team member"} can do ({allPermissions.length}{" "}
                    permissions). Right for most people.
                  </p>
                ) : (
                  <div
                    className="grid gap-1.5 sm:grid-cols-2"
                    role="group"
                    aria-label="Permissions"
                  >
                    {allPermissions.map((permission) => {
                      const on = ticked.includes(permission);
                      return (
                        <label
                          key={permission}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px]",
                            on
                              ? "border-blue-200 bg-blue-50 text-slate-800"
                              : "border-slate-200 text-slate-500",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-blue-600"
                            checked={on}
                            aria-label={permissionLabel(permission)}
                            onChange={() =>
                              setTicked((current) =>
                                on
                                  ? current.filter((value) => value !== permission)
                                  : [...current, permission],
                              )
                            }
                          />
                          {permissionLabel(permission)}
                        </label>
                      );
                    })}
                    {!ticked.length ? (
                      <p className="text-[12px] text-red-600 sm:col-span-2">
                        Keep at least one permission.
                      </p>
                    ) : null}
                  </div>
                )}
              </fieldset>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="grid gap-4">
              <dl className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] sm:grid-cols-2">
                <Summary label="Name" value={name.trim()} />
                <Summary label="Email" value={email.trim()} />
                <Summary label="Mobile" value={phone.trim() || "—"} />
                <Summary label="Team" value={team?.name ?? "—"} />
                <Summary label="Login" value={role?.name ?? "—"} />
                <Summary
                  label="Access"
                  value={
                    fullAccess
                      ? "Full access"
                      : `Custom · ${chosen.length} of ${allPermissions.length} permissions`
                  }
                />
              </dl>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                <KeyRound className="size-4 text-amber-600" aria-hidden />
                <div className="min-w-0 flex-1 text-[12.5px] text-amber-900">
                  A temporary password is ready. You will see it once after creating, to share
                  privately.
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPassword(temporaryPassword())}
                >
                  <RefreshCw aria-hidden /> New password
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <footer className="flex items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            disabled={create.isPending}
            onClick={() => (step ? setStep(step - 1) : onClose())}
          >
            {step ? (
              <>
                <ChevronLeft aria-hidden /> Back
              </>
            ) : (
              "Cancel"
            )}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Next <ChevronRight aria-hidden />
            </Button>
          ) : (
            <Button type="button" loading={create.isPending} onClick={() => create.mutate()}>
              <UserPlus aria-hidden /> Create login
            </Button>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactElement;
}) {
  return (
    <label
      className={cn(
        "grid gap-1.5 text-[13px] [&_input]:h-10 [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-200 [&_input]:px-3 [&_input]:outline-none [&_input:focus]:border-blue-300 [&_input:focus]:ring-4 [&_input:focus]:ring-blue-100",
        className,
      )}
    >
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {error ? <small className="text-red-600">{error}</small> : null}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="truncate font-medium text-slate-900">{value}</dd>
    </div>
  );
}
