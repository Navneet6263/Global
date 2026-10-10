import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Plus, Power, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { listAllUsers } from "@/lib/backend-api/users";
import {
  createDepartment,
  listDepartments,
  removeDepartmentMember,
  setDepartmentMember,
  updateDepartment,
  TEAM_TYPES,
  type TeamType,
  type Department,
} from "@/lib/backend-api/workflow";

const CHECK_TYPES = [
  "IDENTITY",
  "ADDRESS",
  "EMPLOYMENT",
  "EDUCATION",
  "CRIMINAL",
  "COURT_RECORD",
  "REFERENCE",
  "GLOBAL_DATABASE",
  "DRUG_TEST",
  "RESUME_CONSISTENCY",
  "CONFLICT_OF_INTEREST",
  "ANTI_BRIBERY",
  "MISCONDUCT",
  "ADVERSE_MEDIA",
  "DIRECTORSHIP",
  "BUSINESS_INTEREST",
  "SANCTIONS",
  "COMPANY_REGISTRATION",
  "GST_VALIDATION",
  "PAN_VALIDATION",
  "MCA_VALIDATION",
];
const readable = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (c) => c.toUpperCase());

const departmentsQuery = { queryKey: ["workflow", "departments"], queryFn: listDepartments };

export function DepartmentsBoard({ canManage }: { canManage: boolean }) {
  const departments = useQuery(departmentsQuery);
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState<Department>();
  const [editing, setEditing] = useState<Department>();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["workflow", "departments"] });
  const member = useMutation({
    mutationFn: async (input: {
      department: Department;
      userId: string;
      role?: "LEAD" | "MEMBER";
      remove?: boolean;
    }): Promise<unknown> =>
      input.remove
        ? removeDepartmentMember(input.department.id, input.userId)
        : setDepartmentMember(input.department.id, { userId: input.userId, role: input.role! }),
    onSuccess: async (_result, input) => {
      toast.success(
        input.remove
          ? "Member removed"
          : input.role === "LEAD"
            ? "Team Leader updated"
            : "Member updated",
      );
      await refresh();
    },
    onError: (error: Error) => toast.error("Team not changed", { description: error.message }),
  });

  if (departments.isPending) return <ListSkeleton rows={4} />;
  if (departments.isError)
    return (
      <ErrorState
        description={departments.error.message}
        onRetry={() => void departments.refetch()}
        retrying={departments.isFetching}
      />
    );
  const items = departments.data.items;
  return (
    <>
      <div className="ops-dept-toolbar">
        <p className="ops-subtle">
          Packages decide the checks. The RM routes each check to a department, and its Team Leader
          assigns a member.
        </p>
        {canManage ? (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            New department
          </Button>
        ) : null}
      </div>
      <div className="ops-dept-grid">
        {items.map((department) => {
          const leads = department.members.filter((m) => m.role === "LEAD");
          return (
            <section
              key={department.id}
              className={`client-panel ops-dept ${department.status === "INACTIVE" ? "is-inactive" : ""}`}
              aria-label={`${department.name} department`}
            >
              <header className="ops-dept-head">
                <div>
                  <h2>{department.name}</h2>
                  <p>
                    <span
                      className={`ops-stage-chip ${department.kind === "DATA_ENTRY" ? "is-warning" : "is-info"}`}
                    >
                      <i aria-hidden />
                      {department.kind === "DATA_ENTRY" ? "Intake review" : "Verification"}
                    </span>
                    {department.kind === "VERIFICATION" ? (
                      <span
                        className={`ops-stage-chip ${department.teamType ? "is-info" : "is-warning"}`}
                      >
                        <i aria-hidden />
                        {department.teamType
                          ? `${TEAM_TYPES.find((type) => type.value === department.teamType)?.label ?? department.teamType} team`
                          : "No team type yet"}
                      </span>
                    ) : null}
                    {department.status === "INACTIVE" ? (
                      <span className="ops-stage-chip is-neutral">
                        <i aria-hidden />
                        Inactive
                      </span>
                    ) : null}
                  </p>
                </div>
                {canManage ? (
                  <Button variant="outline" size="sm" onClick={() => setEditing(department)}>
                    Edit
                  </Button>
                ) : null}
              </header>
              <dl className="ops-dept-stats">
                <div>
                  <dt>Team Leader</dt>
                  <dd className={leads.length ? undefined : "ops-text-bad"}>
                    {leads.length ? leads.map((lead) => lead.displayName).join(", ") : "Not set"}
                  </dd>
                </div>
                <div>
                  <dt>Members</dt>
                  <dd>{department.members.length}</dd>
                </div>
                {department.kind === "VERIFICATION" ? (
                  <div>
                    <dt>Waiting for a member</dt>
                    <dd className={department.waitingForAssignment ? "ops-text-warn" : undefined}>
                      {department.waitingForAssignment}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {department.kind === "VERIFICATION" ? (
                <p className="ops-dept-types">
                  <strong>Suggested for:</strong>{" "}
                  {department.checkTypes.length
                    ? department.checkTypes.map(readable).join(", ")
                    : "No default checks — the RM chooses per case"}
                </p>
              ) : null}
              <ul className="ops-dept-members" aria-label={`${department.name} members`}>
                {department.members.map((person) => (
                  <li key={person.id}>
                    <span className="ops-avatar" aria-hidden>
                      {person.displayName
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase())
                        .join("")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong>
                        {person.displayName}
                        {person.role === "LEAD" ? (
                          <span className="ops-lead-badge">
                            <Crown aria-hidden /> TL
                          </span>
                        ) : null}
                      </strong>
                      <small>
                        {person.openWork} open · {person.email}
                      </small>
                    </span>
                    {canManage ? (
                      <span className="ops-dept-member-actions">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={member.isPending}
                          onClick={() =>
                            member.mutate({
                              department,
                              userId: person.id,
                              role: person.role === "LEAD" ? "MEMBER" : "LEAD",
                            })
                          }
                          aria-label={
                            person.role === "LEAD"
                              ? `Make ${person.displayName} a member`
                              : `Make ${person.displayName} Team Leader`
                          }
                        >
                          {person.role === "LEAD" ? "Make member" : "Make TL"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={member.isPending}
                          onClick={() =>
                            member.mutate({ department, userId: person.id, remove: true })
                          }
                          aria-label={`Remove ${person.displayName} from ${department.name}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </span>
                    ) : null}
                  </li>
                ))}
                {!department.members.length ? (
                  <li className="ops-empty-row">
                    <Users aria-hidden /> No members yet
                  </li>
                ) : null}
              </ul>
              {canManage && department.status === "ACTIVE" ? (
                <Button
                  variant="outline"
                  className="ops-dept-add"
                  onClick={() => setAdding(department)}
                >
                  <UserPlus aria-hidden />
                  Add member
                </Button>
              ) : null}
            </section>
          );
        })}
      </div>
      {creating ? (
        <CreateDepartmentDialog onClose={() => setCreating(false)} onDone={refresh} />
      ) : null}
      {adding ? (
        <AddMemberDialog
          department={adding}
          onClose={() => setAdding(undefined)}
          onDone={refresh}
        />
      ) : null}
      {editing ? (
        <EditDepartmentDialog
          department={editing}
          onClose={() => setEditing(undefined)}
          onDone={refresh}
        />
      ) : null}
    </>
  );
}

function AddMemberDialog({
  department,
  onClose,
  onDone,
}: {
  department: Department;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) {
  const role = department.kind === "DATA_ENTRY" ? "DATA_ENTRY" : "VERIFIER";
  const users = useQuery({ queryKey: ["users", role, "all"], queryFn: () => listAllUsers(role) });
  const [userId, setUserId] = useState("");
  const [lead, setLead] = useState(false);
  const existing = new Set(department.members.map((member) => member.id));
  const options = (users.data?.items ?? []).filter(
    (user) => user.status === "ACTIVE" && !existing.has(user.id) && !user.client,
  );
  const mutation = useMutation({
    mutationFn: () =>
      setDepartmentMember(department.id, { userId, role: lead ? "LEAD" : "MEMBER" }),
    onSuccess: async () => {
      toast.success(`Added to ${department.name}`);
      await onDone();
      onClose();
    },
    onError: (error: Error) => toast.error("Member not added", { description: error.message }),
  });
  return (
    <Dialog open onOpenChange={(open) => (!open && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="ops-dialog sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add to {department.name}</DialogTitle>
          <DialogDescription>
            Only active internal users with the {role === "DATA_ENTRY" ? "Data Entry" : "Verifier"}{" "}
            role can join.
          </DialogDescription>
        </DialogHeader>
        <label className="ops-field">
          <span>Person</span>
          <select
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            disabled={users.isPending}
          >
            <option value="">{users.isPending ? "Loading people…" : "Choose a person"}</option>
            {options.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} · {user.email}
              </option>
            ))}
          </select>
          {users.isError ? <small className="is-error">{users.error.message}</small> : null}
          {!users.isPending && !users.isError && !options.length ? (
            <small>
              Nobody else is available. Create a user with the{" "}
              {role === "DATA_ENTRY" ? "Data Entry" : "Verifier"} role first.
            </small>
          ) : null}
        </label>
        <label className="ops-check">
          <input
            type="checkbox"
            checked={lead}
            onChange={(event) => setLead(event.target.checked)}
          />
          Make this person the Team Leader
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!userId} loading={mutation.isPending}>
            Add member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckTypePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset className="ops-type-picker">
      <legend>Suggested check types</legend>
      {CHECK_TYPES.map((type) => (
        <label key={type}>
          <input
            type="checkbox"
            checked={value.includes(type)}
            onChange={(event) =>
              onChange(
                event.target.checked ? [...value, type] : value.filter((item) => item !== type),
              )
            }
          />
          {readable(type)}
        </label>
      ))}
    </fieldset>
  );
}

function CreateDepartmentDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<Department["kind"]>("VERIFICATION");
  const [teamType, setTeamType] = useState<TeamType | "">("");
  const [types, setTypes] = useState<string[]>([]);
  const validCode = /^[A-Z][A-Z0-9_]{1,31}$/.test(code);
  const mutation = useMutation({
    mutationFn: () =>
      createDepartment({
        code,
        name: name.trim(),
        kind,
        ...(kind === "VERIFICATION" && teamType ? { teamType } : {}),
        checkTypes: kind === "VERIFICATION" ? types : [],
      }),
    onSuccess: async () => {
      toast.success("Department created");
      await onDone();
      onClose();
    },
    onError: (error: Error) =>
      toast.error("Department not created", { description: error.message }),
  });
  return (
    <Dialog open onOpenChange={(open) => (!open && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="ops-dialog sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>New department</DialogTitle>
          <DialogDescription>Add a team the RM can route checks to.</DialogDescription>
        </DialogHeader>
        <label className="ops-field">
          <span>Name</span>
          <input
            value={name}
            maxLength={80}
            onChange={(event) => {
              setName(event.target.value);
              if (!code || code === autoCode(name)) setCode(autoCode(event.target.value));
            }}
            placeholder="e.g. Criminal & Court"
          />
        </label>
        <label className="ops-field">
          <span>Code</span>
          <input
            value={code}
            maxLength={32}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            aria-invalid={Boolean(code) && !validCode}
          />
          {code && !validCode ? (
            <small className="is-error">Use capital letters, digits or underscores.</small>
          ) : null}
        </label>
        <label className="ops-field">
          <span>Type</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as Department["kind"])}
          >
            <option value="VERIFICATION">Verification team</option>
            <option value="DATA_ENTRY">Intake review (Data Entry)</option>
          </select>
        </label>
        {kind === "VERIFICATION" ? (
          <>
            <TeamTypePicker value={teamType} onChange={setTeamType} />
            <CheckTypePicker value={types} onChange={setTypes} />
          </>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={
              name.trim().length < 2 || !validCode || (kind === "VERIFICATION" && !teamType)
            }
            loading={mutation.isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function autoCode(name: string) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "D$1")
    .slice(0, 32);
}

function EditDepartmentDialog({
  department,
  onClose,
  onDone,
}: {
  department: Department;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) {
  const [name, setName] = useState(department.name);
  const [types, setTypes] = useState(department.checkTypes);
  const [teamType, setTeamType] = useState<TeamType | "">(department.teamType ?? "");
  const mutation = useMutation({
    mutationFn: (status?: Department["status"]) =>
      updateDepartment(department.id, {
        version: department.version,
        ...(status
          ? { status }
          : { name: name.trim(), checkTypes: types, ...(teamType ? { teamType } : {}) }),
      }),
    onSuccess: async () => {
      toast.success("Department updated");
      await onDone();
      onClose();
    },
    onError: (error: Error) =>
      toast.error("Department not updated", { description: error.message }),
  });
  const active = department.status === "ACTIVE";
  return (
    <Dialog open onOpenChange={(open) => (!open && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="ops-dialog sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Edit {department.name}</DialogTitle>
          <DialogDescription>Changes are recorded in the audit trail.</DialogDescription>
        </DialogHeader>
        <label className="ops-field">
          <span>Name</span>
          <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </label>
        {department.kind === "VERIFICATION" ? (
          <>
            <TeamTypePicker value={teamType} onChange={setTeamType} />
            <CheckTypePicker value={types} onChange={setTypes} />
          </>
        ) : null}
        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            onClick={() => mutation.mutate(active ? "INACTIVE" : "ACTIVE")}
            disabled={mutation.isPending}
          >
            <Power aria-hidden />
            {active ? "Deactivate" : "Reactivate"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate(undefined)}
              disabled={name.trim().length < 2}
              loading={mutation.isPending}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Employment, Education, Digital or Vendor: decides the process the team's verifiers see. */
function TeamTypePicker({
  value,
  onChange,
}: {
  value: TeamType | "";
  onChange: (value: TeamType) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-[12.5px] font-semibold text-slate-700">Team type</legend>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Team type">
        {TEAM_TYPES.map((type) => (
          <label
            key={type.value}
            className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-[12.5px] ${
              value === type.value
                ? "border-blue-400 bg-blue-50 ring-2 ring-blue-500/20"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="team-type"
              className="mt-0.5 accent-blue-600"
              checked={value === type.value}
              onChange={() => onChange(type.value)}
            />
            <span>
              <strong className="block text-[13px] text-slate-900">{type.label}</strong>
              <span className="text-slate-500">{type.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
