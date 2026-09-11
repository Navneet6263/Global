import { useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useUpdateUserRoles } from "../hooks/use-users";

const EXCLUSIVE: readonly Role[] = ["PLATFORM_ADMIN", "CLIENT_ADMIN"];

export function EditUserRolesDialog({
  user,
  onClose,
}: {
  user: PlatformUser;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"single" | "multiple">(
    user.roles.length > 1 ? "multiple" : "single",
  );
  const [selected, setSelected] = useState<Role[]>([...user.roles]);
  const [confirmed, setConfirmed] = useState(false);
  const update = useUpdateUserRoles();
  const busy = useRef(false);
  const added = selected.filter((role) => !user.roles.includes(role));
  const removed = user.roles.filter((role) => !selected.includes(role));
  const changed = Boolean(added.length || removed.length);
  const choose = (role: Role) => {
    setConfirmed(false);
    if (mode === "single" || EXCLUSIVE.includes(role)) setSelected([role]);
    else
      setSelected((current) =>
        current.includes(role)
          ? current.filter((item) => item !== role)
          : [...current.filter((item) => !EXCLUSIVE.includes(item)), role],
      );
  };
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
      },
      {
        onSuccess: () => {
          toast.success("User roles updated", {
            description: "The user must sign in again with their updated access.",
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
            Edit role access
          </DialogTitle>
          <DialogDescription>
            {user.fullName} · {user.email}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 text-sm">
            <p className="font-medium">Branch and client scope stay unchanged</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {user.branchScope.join(", ") || "All branches"}
              {user.clientWorkspaceScope.length
                ? ` · ${user.clientWorkspaceScope.join(", ")}`
                : " · No client restriction"}
            </p>
          </div>
          <fieldset disabled={update.isPending} className="space-y-4">
            <legend className="mb-2 text-sm font-semibold">Access mode</legend>
            <RadioGroup
              value={mode}
              onValueChange={(value) => {
                const next = value as typeof mode;
                setMode(next);
                setConfirmed(false);
                if (next === "single" && selected.length > 1) setSelected([]);
              }}
              className="grid gap-3 sm:grid-cols-2"
            >
              {(["single", "multiple"] as const).map((value) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border px-4 py-3 has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-primary/5"
                >
                  <RadioGroupItem value={value} />
                  <span className="text-sm font-medium">
                    {value === "single" ? "Single role" : "Multiple roles"}
                  </span>
                </label>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {mode === "single"
                ? "Choose the one role this account should keep. Other roles will be removed."
                : "Select up to 3 roles. Their permissions are combined; this is not a temporary dashboard switch."}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLES.map((role) => {
                const clientUnavailable =
                  role === "CLIENT_ADMIN" && !user.clientWorkspaceScope.length;
                const maxReached =
                  mode === "multiple" &&
                  selected.length >= 3 &&
                  !selected.includes(role) &&
                  !EXCLUSIVE.includes(role);
                return (
                  <label
                    key={role}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-muted/25 p-3 has-[[data-state=checked]]:border-emerald-300 has-[[data-state=checked]]:bg-emerald-50/60"
                  >
                    <Checkbox
                      aria-label={ROLE_DEFINITIONS[role].label}
                      checked={selected.includes(role)}
                      onCheckedChange={() => choose(role)}
                      disabled={clientUnavailable || maxReached}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {ROLE_DEFINITIONS[role].label}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {clientUnavailable
                          ? "Requires a linked client workspace; cannot be granted from this form."
                          : ROLE_DEFINITIONS[role].description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Platform Admin and Client Admin must each remain the only role on an account.
            </p>
            {selected.length > 1 ? (
              <label className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
                <Checkbox
                  checked={confirmed}
                  onCheckedChange={(value) => setConfirmed(value === true)}
                  className="mt-0.5"
                />
                I confirm this person needs the combined permissions of these roles.
              </label>
            ) : null}
          </fieldset>
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
            Saving changed roles signs this user out of existing sessions. Assigned work is not
            automatically transferred—arrange a handover first if removing a working role. The
            change is recorded in the audit trail.
          </p>
          {!user.version ? (
            <p role="alert" className="text-sm text-red-700">
              Refresh the user directory before editing this account.
            </p>
          ) : null}
          {update.isError ? (
            <p role="alert" className="text-sm text-red-700">
              {update.error.message} If the account changed, close this dialog, refresh the
              directory and reopen it.
            </p>
          ) : null}
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-6">
          <span className="text-xs text-muted-foreground">{selected.length} role(s) selected</span>
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
              Save roles
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
