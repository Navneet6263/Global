import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { ROLES, ROLE_DEFINITIONS, type Role } from "@/config/roles";
import type { PlatformUser } from "@/lib/contracts/user";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { sameClientSet, type ScopeOption } from "../client-scope";
import { useUpdateUserRoles } from "../hooks/use-users";
import { ClientScopePicker } from "./client-scope-picker";
import { nextRoles } from "../role-guide";
import { RoleCards } from "./RoleCards";

/**
 * Edit role & access: the same role cards as Create. Tick another working role to give
 * it too (e.g. an RM who also does Data Entry); untick to take one away.
 */
export function EditUserRolesDialog({
  user,
  clients,
  roles = ROLES,
  onClose,
}: {
  user: PlatformUser;
  /** Roles the editor may give (Operations: the roles it may create). */
  roles?: readonly Role[];
  /** Client workspaces a SPOC-RM can be given (the server re-checks each one). */
  clients: readonly ScopeOption[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Role[]>([...user.roles]);
  const [confirmed, setConfirmed] = useState(user.roles.length > 1);
  const initialClients = user.clientWorkspaceIds ?? [];
  const [clientIds, setClientIds] = useState<string[]>([...initialClients]);
  const update = useUpdateUserRoles();
  const busy = useRef(false);
  const added = selected.filter((role) => !user.roles.includes(role));
  const removed = user.roles.filter((role) => !selected.includes(role));
  const spoc = selected.includes("SPOC_RM");
  const rolesChanged = Boolean(added.length || removed.length);
  const clientsChanged = spoc && !sameClientSet(clientIds, initialClients);
  const changed = rolesChanged || clientsChanged;
  const needsTeam = added.some((role) => role === "DATA_ENTRY" || role === "VERIFIER");
  const options = [
    ...clients,
    ...initialClients
      .map((id, index) => ({ id, label: user.clientWorkspaceScope[index] ?? id }))
      .filter((own) => !clients.some((option) => option.id.toLowerCase() === own.id.toLowerCase())),
  ];
  const save = () => {
    if (
      busy.current ||
      !user.version ||
      !changed ||
      !selected.length ||
      (selected.length > 1 && !confirmed)
    )
      return;
    busy.current = true;
    update.mutate(
      {
        id: user.id,
        version: user.version,
        roleCodes: selected,
        additionalAccessConfirmed: selected.length > 1 && confirmed,
        ...(spoc ? { spocClientIds: clientIds } : {}),
      },
      {
        onSuccess: () => {
          toast.success(rolesChanged ? "Roles updated" : "Company access updated", {
            description: rolesChanged
              ? selected.length > 1
                ? "They sign in again and switch roles from “Working as” at the top."
                : "They sign in again with the new access."
              : "The new company access applies from their next action.",
          });
          onClose();
        },
        onSettled: () => {
          busy.current = false;
        },
      },
    );
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy.current) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-3xl p-0"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b border-border px-5 py-5 pr-12 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Edit role &amp; access
          </DialogTitle>
          <DialogDescription>
            {user.fullName} · {user.email}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <p className="cu-note">
            <UsersRound aria-hidden /> Tick another role to give it too, e.g. an RM who also does
            Data Entry. They then switch from “Working as” at the top.
          </p>
          <fieldset disabled={update.isPending} className="grid gap-4">
            <RoleCards
              available={roles}
              selected={selected}
              onToggle={(role) => {
                setConfirmed(false);
                setSelected((current) => nextRoles(current, role));
              }}
              disabledReason={(role) =>
                ROLE_DEFINITIONS[role].scopeFields.includes("clientWorkspace") &&
                !user.clientWorkspaceScope.length
                  ? "Needs a company: create a new Client Admin ID instead."
                  : null
              }
            />
          </fieldset>
          {spoc ? (
            <ClientScopePicker
              options={options}
              value={clientIds}
              onChange={setClientIds}
              disabled={update.isPending}
            />
          ) : null}
          {selected.length > 1 ? (
            <label className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(value) => setConfirmed(value === true)}
                className="mt-0.5"
                aria-label="Confirm combined roles"
              />
              I confirm this person does all of these jobs:{" "}
              {selected.map((role) => ROLE_DEFINITIONS[role].label).join(" + ")}.
            </label>
          ) : null}
          {needsTeam ? (
            <p className="cu-note">
              <UsersRound aria-hidden /> Next, add them to their team in{" "}
              <Link to="/operations/departments" className="rmo-link">
                Departments &amp; teams
              </Link>{" "}
              so work reaches them.
            </p>
          ) : null}
          {changed ? (
            <div className="space-y-1 text-sm" aria-live="polite">
              {removed.length ? (
                <p className="text-red-700">
                  Remove: {removed.map((role) => ROLE_DEFINITIONS[role].label).join(", ")}
                </p>
              ) : null}
              {added.length ? (
                <p className="text-emerald-800">
                  Add: {added.map((role) => ROLE_DEFINITIONS[role].label).join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
          <p className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 text-xs text-amber-950">
            Saving signs this person out once. Work already assigned is not moved; hand it over
            first if you remove a working role. Recorded in the audit trail.
          </p>
          {!user.version ? (
            <p role="alert" className="text-sm text-red-700">
              Refresh the list before editing this account.
            </p>
          ) : null}
          {update.isError ? (
            <p role="alert" className="text-sm text-red-700">
              {update.error.message}
            </p>
          ) : null}
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-6">
          <span className="text-xs text-muted-foreground">
            {selected.map((role) => ROLE_DEFINITIONS[role].label).join(" + ") || "No role"}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={update.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              loading={update.isPending}
              disabled={
                !changed || !user.version || !selected.length || (selected.length > 1 && !confirmed)
              }
              onClick={save}
            >
              Save
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
