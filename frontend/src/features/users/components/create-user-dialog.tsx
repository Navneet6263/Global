"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Check,
  ClipboardList,
  KeyRound,
  ShieldCheck,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { ROLES, ROLE_DEFINITIONS, type Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CreateUserInput } from "@/lib/contracts/user";
import { cachedIdentity } from "@/lib/auth/platform-session";
import { getUserSetupOptions } from "@/lib/backend-api/users";
import type { ScopeOption } from "../client-scope";
import { CUSTOMISABLE_ROLES, nextRoles, permissionLabel } from "../role-guide";
import { ClientScopePicker } from "./client-scope-picker";
import { RoleCards } from "./RoleCards";

const schema = z.object({
  fullName: z.string().min(3, "Enter the full name"),
  email: z.string().email("Enter a valid work email"),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number")
    .optional()
    .or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;
export type { ScopeOption };

type StepId = "role" | "details" | "work" | "access" | "review";
const STEP_META: Record<StepId, { label: string; icon: LucideIcon }> = {
  role: { label: "Role", icon: ShieldCheck },
  details: { label: "Details", icon: UserRound },
  work: { label: "Where they work", icon: Building2 },
  access: { label: "Access", icon: KeyRound },
  review: { label: "Review", icon: ClipboardList },
};

interface CreateUserDialogProps {
  open: boolean;
  submitting: boolean;
  branches: readonly ScopeOption[];
  clients: readonly ScopeOption[];
  /** Roles this caller may assign; omitted means every role (Platform Admin). */
  roles?: readonly Role[];
  /** False when the caller may only assign the listed branches, never all branches. */
  allowTenantWide?: boolean;
  /** Roles selected when the dialog opens (e.g. VENDOR for a vendor's team). */
  defaultRoles?: readonly Role[];
  /** Internal users: offer teams and access ticks (needs /users/setup-options). */
  withSetup?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateUserInput) => void;
}

/**
 * Create user ID, step by step: role (with plain "does / cannot" text and combinable
 * working roles), details, where they work (team + Team Leader, companies, branch only
 * when branches are on), optional access ticks, then a review. The API enforces every rule.
 */
export function CreateUserDialog(props: CreateUserDialogProps) {
  const available = props.roles ?? ROLES;
  const withSetup = props.withSetup !== false;
  const branchScoping = cachedIdentity()?.branchScoping === true;
  const [step, setStep] = useState<StepId>("role");
  const [roles, setRoles] = useState<Role[]>([...(props.defaultRoles ?? [])]);
  const [branchId, setBranchId] = useState("all");
  const [clientId, setClientId] = useState("");
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<Record<string, { lead: boolean }>>({});
  const [customised, setCustomised] = useState<Record<string, string[] | undefined>>({});
  const [error, setError] = useState("");
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", mobile: "" },
  });
  const setup = useQuery({
    queryKey: ["users", "setup-options"],
    queryFn: getUserSetupOptions,
    enabled: props.open && withSetup,
    staleTime: 60_000,
  });

  const clientRole = roles.includes("CLIENT_ADMIN");
  const rmRole = roles.includes("SPOC_RM");
  const teamKinds = [
    ...(roles.includes("DATA_ENTRY") ? ["DATA_ENTRY"] : []),
    ...(roles.includes("VERIFIER") ? ["VERIFICATION"] : []),
  ];
  const teamOptions = (setup.data?.departments ?? []).filter((team) =>
    teamKinds.includes(team.kind),
  );
  const needsBranch =
    branchScoping && roles.some((role) => ROLE_DEFINITIONS[role].scopeFields.includes("branch"));
  const accessRoles = withSetup ? roles.filter((role) => CUSTOMISABLE_ROLES.includes(role)) : [];
  const steps = useMemo<StepId[]>(() => {
    const list: StepId[] = ["role", "details"];
    if (clientRole || rmRole || teamOptions.length || needsBranch) list.push("work");
    if (accessRoles.length) list.push("access");
    list.push("review");
    return list;
  }, [clientRole, rmRole, teamOptions.length, needsBranch, accessRoles.length]);
  const index = Math.max(0, steps.indexOf(step));

  useEffect(() => {
    if (props.open) return;
    form.reset({ fullName: "", email: "", mobile: "" });
    setRoles([...(props.defaultRoles ?? [])]);
    setStep("role");
    setBranchId("all");
    setClientId("");
    setClientIds([]);
    setTeams({});
    setCustomised({});
    setError("");
  }, [form, props.open, props.defaultRoles]);

  const toggleRole = (role: Role) => {
    setError("");
    setRoles((current) => nextRoles(current, role));
  };

  const next = async () => {
    setError("");
    if (step === "role" && !roles.length) return setError("Choose at least one role.");
    if (step === "details" && !(await form.trigger())) return;
    if (step === "work" && clientRole && !clientId)
      return setError("Choose the company this Client Admin belongs to.");
    setStep(steps[index + 1]!);
  };

  const submit = () => {
    const values = form.getValues();
    const branch = needsBranch ? props.branches.find((item) => item.id === branchId) : undefined;
    const client = clientRole ? props.clients.find((item) => item.id === clientId) : undefined;
    const scoped = rmRole ? props.clients.filter((item) => clientIds.includes(item.id)) : [];
    props.onSubmit({
      fullName: values.fullName,
      email: values.email,
      mobile: values.mobile || undefined,
      roles,
      branchId: branch?.id,
      branchLabel: branch?.label,
      clientId: client?.id,
      clientLabel: client?.label,
      ...(rmRole
        ? {
            clientIds: scoped.map((item) => item.id),
            clientLabels: scoped.map((item) => item.label),
          }
        : {}),
      additionalAccessConfirmed: roles.length > 1,
      departments: Object.entries(teams)
        .filter(([id]) => teamOptions.some((team) => team.id === id))
        .map(([id, value]) => ({ id, lead: value.lead })),
      access: accessRoles.flatMap((role) =>
        customised[role] ? [{ role, permissions: customised[role]! }] : [],
      ),
    });
  };

  const values = form.watch();
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto p-0 sm:max-w-4xl">
        <div className="cu-shell">
          <aside className="cu-steps" aria-label="Steps">
            <DialogHeader className="cu-head">
              <DialogTitle>Create user ID</DialogTitle>
              <DialogDescription>
                They get a temporary password and set their own at first sign-in.
              </DialogDescription>
            </DialogHeader>
            <ol>
              {steps.map((id, position) => {
                const meta = STEP_META[id];
                const state = position < index ? "done" : position === index ? "current" : "";
                return (
                  <li key={id} data-state={state}>
                    <span className="cu-dot">
                      {state === "done" ? <Check aria-hidden /> : <meta.icon aria-hidden />}
                    </span>
                    {meta.label}
                  </li>
                );
              })}
            </ol>
          </aside>

          <section className="cu-body">
            {step === "role" ? (
              <>
                <StepTitle
                  title="What will this person do?"
                  hint="Working roles can be combined, e.g. RM + Data Entry. They then get a “Switch role” menu at the top."
                />
                <RoleCards available={available} selected={roles} onToggle={toggleRole} />
                {roles.length > 1 ? (
                  <p className="cu-note">
                    <UsersRound aria-hidden /> {roles.length} roles:{" "}
                    {roles.map((role) => ROLE_DEFINITIONS[role].label).join(" + ")}. They will
                    switch between them from the top bar.
                  </p>
                ) : null}
              </>
            ) : null}

            {step === "details" ? (
              <>
                <StepTitle
                  title="Who is it?"
                  hint="Use their work email; the sign-in ID is the email."
                />
                <div className="cu-grid">
                  <Field label="Full name" error={form.formState.errors.fullName?.message}>
                    <Input
                      placeholder="Rohan Iyer"
                      {...form.register("fullName")}
                      aria-label="Full name"
                    />
                  </Field>
                  <Field label="Work email" error={form.formState.errors.email?.message}>
                    <Input
                      type="email"
                      placeholder="rohan@saplingglobal.in"
                      {...form.register("email")}
                      aria-label="Work email"
                    />
                  </Field>
                  <Field label="Mobile (optional)" error={form.formState.errors.mobile?.message}>
                    <Input
                      inputMode="numeric"
                      placeholder="9876543210"
                      {...form.register("mobile")}
                      aria-label="Mobile"
                    />
                  </Field>
                </div>
              </>
            ) : null}

            {step === "work" ? (
              <>
                <StepTitle
                  title="Where do they work?"
                  hint="Put them in their team now so work reaches them straight away."
                />
                {teamKinds.length ? (
                  <div className="cu-block">
                    <h4>Team</h4>
                    {setup.isPending ? (
                      <p className="cu-muted">Loading teams…</p>
                    ) : !teamOptions.length ? (
                      <p className="cu-muted">
                        No matching team yet. Create one in Departments &amp; teams, then add them.
                      </p>
                    ) : (
                      <div className="cu-teams">
                        {teamOptions.map((team) => {
                          const chosen = teams[team.id];
                          return (
                            <div key={team.id} className="cu-team" data-on={Boolean(chosen)}>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={Boolean(chosen)}
                                  onChange={(event) =>
                                    setTeams((current) => {
                                      const copy = { ...current };
                                      if (event.target.checked) copy[team.id] = { lead: false };
                                      else delete copy[team.id];
                                      return copy;
                                    })
                                  }
                                  aria-label={`Team ${team.name}`}
                                />
                                <span>
                                  <strong>{team.name}</strong>
                                  <small>
                                    {team.kind === "DATA_ENTRY"
                                      ? "Data Entry team"
                                      : "Verification team"}
                                  </small>
                                </span>
                              </label>
                              {chosen ? (
                                <label className="cu-lead">
                                  <input
                                    type="checkbox"
                                    checked={chosen.lead}
                                    onChange={(event) =>
                                      setTeams((current) => ({
                                        ...current,
                                        [team.id]: { lead: event.target.checked },
                                      }))
                                    }
                                    aria-label={`Team Leader of ${team.name}`}
                                  />
                                  Team Leader
                                </label>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
                {clientRole ? (
                  <div className="cu-block">
                    <h4>Company</h4>
                    <select
                      className="cu-select"
                      value={clientId}
                      onChange={(event) => setClientId(event.target.value)}
                      aria-label="Client company"
                    >
                      <option value="">Choose a company…</option>
                      {props.clients.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {rmRole ? (
                  <div className="cu-block">
                    <h4>Companies they look after</h4>
                    <p className="cu-muted">
                      Optional now: companies can also be given later in Companies &amp; RMs.
                    </p>
                    <ClientScopePicker
                      options={props.clients}
                      value={clientIds}
                      onChange={setClientIds}
                    />
                  </div>
                ) : null}
                {needsBranch ? (
                  <div className="cu-block">
                    <h4>Office</h4>
                    <select
                      className="cu-select"
                      value={branchId}
                      onChange={(event) => setBranchId(event.target.value)}
                      aria-label="Office"
                    >
                      {props.allowTenantWide === false ? null : (
                        <option value="all">All offices</option>
                      )}
                      {props.branches.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </>
            ) : null}

            {step === "access" ? (
              <>
                <StepTitle
                  title="What can they do?"
                  hint="Full access is right for most people. Untick only what this person must not do; they get a personal role you can edit later in Roles & permissions."
                />
                {accessRoles.map((role) => {
                  const all =
                    setup.data?.access.find((entry) => entry.role === role)?.permissions ?? [];
                  const ticked = customised[role];
                  return (
                    <div key={role} className="cu-block">
                      <div className="cu-access-head">
                        <h4>{ROLE_DEFINITIONS[role].label}</h4>
                        <div
                          className="cu-segment"
                          role="group"
                          aria-label={`${ROLE_DEFINITIONS[role].label} access`}
                        >
                          <button
                            type="button"
                            aria-pressed={!ticked}
                            onClick={() =>
                              setCustomised((current) => ({ ...current, [role]: undefined }))
                            }
                          >
                            Full access
                          </button>
                          <button
                            type="button"
                            aria-pressed={Boolean(ticked)}
                            onClick={() =>
                              setCustomised((current) => ({ ...current, [role]: [...all] }))
                            }
                          >
                            Customise
                          </button>
                        </div>
                      </div>
                      {ticked ? (
                        <div className="cu-perms">
                          {all.map((permission) => (
                            <label key={permission}>
                              <input
                                type="checkbox"
                                checked={ticked.includes(permission)}
                                onChange={(event) =>
                                  setCustomised((current) => ({
                                    ...current,
                                    [role]: event.target.checked
                                      ? [...(current[role] ?? []), permission]
                                      : (current[role] ?? []).filter(
                                          (value) => value !== permission,
                                        ),
                                  }))
                                }
                                aria-label={permissionLabel(permission)}
                              />
                              {permissionLabel(permission)}
                            </label>
                          ))}
                          <small>
                            {ticked.length} of {all.length} allowed
                          </small>
                        </div>
                      ) : (
                        <p className="cu-muted">
                          Everything a {ROLE_DEFINITIONS[role].label} normally does.
                        </p>
                      )}
                    </div>
                  );
                })}
              </>
            ) : null}

            {step === "review" ? (
              <>
                <StepTitle
                  title="Check and create"
                  hint="Nothing is saved until you press Create."
                />
                <dl className="cu-review">
                  <Row label="Name" value={values.fullName} />
                  <Row label="Email" value={values.email} />
                  {values.mobile ? <Row label="Mobile" value={values.mobile} /> : null}
                  <Row
                    label="Role"
                    value={roles.map((role) => ROLE_DEFINITIONS[role].label).join(" + ")}
                  />
                  {Object.keys(teams).length ? (
                    <Row
                      label="Team"
                      value={teamOptions
                        .filter((team) => teams[team.id])
                        .map(
                          (team) => `${team.name}${teams[team.id]!.lead ? " (Team Leader)" : ""}`,
                        )
                        .join(", ")}
                    />
                  ) : null}
                  {clientRole ? (
                    <Row
                      label="Company"
                      value={props.clients.find((item) => item.id === clientId)?.label ?? "—"}
                    />
                  ) : null}
                  {rmRole ? (
                    <Row
                      label="Companies"
                      value={
                        props.clients
                          .filter((item) => clientIds.includes(item.id))
                          .map((item) => item.label)
                          .join(", ") || "None yet"
                      }
                    />
                  ) : null}
                  {accessRoles.map((role) => (
                    <Row
                      key={role}
                      label={`${ROLE_DEFINITIONS[role].label} access`}
                      value={
                        customised[role]
                          ? `Customised: ${customised[role]!.length} permissions`
                          : "Full access"
                      }
                    />
                  ))}
                </dl>
              </>
            ) : null}

            {error ? <p className="cu-error">{error}</p> : null}

            <footer className="cu-footer">
              <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>
                Cancel
              </Button>
              <span className="flex gap-2">
                {index > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(steps[index - 1]!)}
                  >
                    Back
                  </Button>
                ) : null}
                {step === "review" ? (
                  <Button
                    type="button"
                    disabled={props.submitting}
                    loading={props.submitting}
                    onClick={submit}
                  >
                    Create user ID
                  </Button>
                ) : (
                  <Button type="button" onClick={() => void next()}>
                    Next
                  </Button>
                )}
              </span>
            </footer>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <header className="cu-title">
      <h3>{title}</h3>
      <p>{hint}</p>
    </header>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="cu-field">
      <span>{label}</span>
      {children}
      {error ? <small className="cu-error">{error}</small> : null}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
