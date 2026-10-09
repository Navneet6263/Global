import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, ShieldCheck, Trash2, UserCog } from "lucide-react";
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
import {
  createCustomRole,
  deleteCustomRole,
  listCustomRoleMembers,
  listCustomRoles,
  setCustomRoleMember,
  updateCustomRole,
  type CustomRole,
  type RoleBase,
} from "@/lib/backend-api/custom-roles";

const KEY = ["roles", "custom"];
const readable = (value: string) =>
  value
    .replaceAll(/[:_-]/g, " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());

/** Permissions grouped by area ("case:read" → Case). */
function groups(permissions: readonly string[]) {
  const map = new Map<string, string[]>();
  for (const permission of permissions) {
    const area = permission.split(":")[0] ?? permission;
    map.set(area, [...(map.get(area) ?? []), permission]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Custom roles: a named copy of a system role with fewer permissions. Users with it
 * work as the base role, limited to the ticked permissions. System roles never change.
 */
export function CustomRolesBoard() {
  const roles = useQuery({ queryKey: KEY, queryFn: listCustomRoles });
  const [editing, setEditing] = useState<CustomRole | "new" | null>(null);
  const [members, setMembers] = useState<CustomRole | null>(null);
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (role: CustomRole) => deleteCustomRole(role.id),
    onSuccess: async () => {
      toast.success("Role deleted");
      await queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (error: Error) => toast.error("Not deleted", { description: error.message }),
  });
  const bases = roles.data?.bases ?? [];
  const baseName = (code: string) => bases.find((base) => base.code === code)?.name ?? code;
  return (
    <div className="rmo">
      <section className="rmo-card rmo-queue">
        <header className="rmo-queue-head">
          <div>
            <h2>Custom roles</h2>
            <p>
              Start from a system role and untick what this team should not do. Every change is
              audited.
            </p>
          </div>
          <Button size="sm" onClick={() => setEditing("new")} disabled={!bases.length}>
            <Plus aria-hidden /> New role
          </Button>
        </header>
        {roles.isError ? (
          <div className="rmo-empty">
            <strong>Roles unavailable</strong>
            <span>{roles.error.message}</span>
          </div>
        ) : !roles.data ? (
          <div className="rmo-empty">Loading…</div>
        ) : !roles.data.items.length ? (
          <div className="rmo-empty">
            <strong>No custom roles yet</strong>
            <span>For example, a “Verifier — read only” role for trainees.</span>
          </div>
        ) : (
          <ul className="crl-list">
            {roles.data.items.map((role) => (
              <li key={role.id}>
                <span className="crl-icon">
                  <ShieldCheck aria-hidden />
                </span>
                <div className="crl-main">
                  <strong>{role.name}</strong>
                  <small>
                    Based on {baseName(role.baseRoleCode)} · {role.permissions.length} permissions ·{" "}
                    {role.users} {role.users === 1 ? "user" : "users"}
                  </small>
                  <div className="crl-perms">
                    {role.permissions.slice(0, 6).map((permission) => (
                      <span key={permission}>{readable(permission)}</span>
                    ))}
                    {role.permissions.length > 6 ? (
                      <span>+{role.permissions.length - 6} more</span>
                    ) : null}
                  </div>
                </div>
                <div className="crl-actions">
                  <Button size="sm" variant="outline" onClick={() => setMembers(role)}>
                    <UserCog aria-hidden /> Users
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(role)}
                    aria-label={`Edit ${role.name}`}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={role.users > 0}
                    title={role.users ? "Move its users to another role first" : undefined}
                    loading={remove.isPending && remove.variables?.id === role.id}
                    onClick={() => remove.mutate(role)}
                    aria-label={`Delete ${role.name}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {editing ? (
        <RoleEditor
          key={editing === "new" ? "new" : editing.id}
          role={editing === "new" ? null : editing}
          bases={bases}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {members ? <RoleMembers role={members} onClose={() => setMembers(null)} /> : null}
    </div>
  );
}

function RoleEditor({
  role,
  bases,
  onClose,
}: {
  role: CustomRole | null;
  bases: RoleBase[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(role?.name ?? "");
  const [baseCode, setBaseCode] = useState(role?.baseRoleCode ?? bases[0]?.code ?? "");
  const base = bases.find((item) => item.code === baseCode);
  const [picked, setPicked] = useState<string[]>(role?.permissions ?? base?.permissions ?? []);
  const save = useMutation({
    mutationFn: () =>
      role
        ? updateCustomRole(role.id, { name: name.trim(), permissions: picked })
        : createCustomRole({ name: name.trim(), baseRoleCode: baseCode, permissions: picked }),
    onSuccess: async () => {
      toast.success(role ? "Role updated" : "Role created", {
        description: role ? "Signed-in users get the change on their next action." : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: KEY });
      onClose();
    },
    onError: (error: Error) => toast.error("Not saved", { description: error.message }),
  });
  const toggle = (permission: string) =>
    setPicked((current) =>
      current.includes(permission)
        ? current.filter((value) => value !== permission)
        : [...current, permission],
    );
  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[88dvh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{role ? `Edit ${role.name}` : "New custom role"}</DialogTitle>
          <DialogDescription>
            A custom role can only remove permissions from its base role, never add new ones.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="ops-field">
            <span>Role name *</span>
            <input
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Verifier — read only"
              aria-label="Role name"
            />
          </label>
          <label className="ops-field">
            <span>Based on *</span>
            <select
              value={baseCode}
              disabled={Boolean(role)}
              onChange={(event) => {
                setBaseCode(event.target.value);
                setPicked(
                  bases.find((item) => item.code === event.target.value)?.permissions ?? [],
                );
              }}
              aria-label="Base role"
            >
              {bases.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="crl-groups" role="group" aria-label="Permissions">
          {groups(base?.permissions ?? []).map(([area, permissions]) => (
            <fieldset key={area}>
              <legend>{readable(area)}</legend>
              {permissions.map((permission) => (
                <label key={permission}>
                  <input
                    type="checkbox"
                    checked={picked.includes(permission)}
                    onChange={() => toggle(permission)}
                  />
                  {readable(permission)}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <DialogFooter>
          <span className="mr-auto self-center text-xs text-slate-500">
            {picked.length} of {base?.permissions.length ?? 0} permissions
          </span>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={name.trim().length < 3 || !picked.length}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            {role ? "Save role" : "Create role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleMembers({ role, onClose }: { role: CustomRole; onClose: () => void }) {
  const queryClient = useQueryClient();
  const members = useQuery({
    queryKey: [...KEY, role.id, "members"],
    queryFn: () => listCustomRoleMembers(role.id),
  });
  const toggle = useMutation({
    mutationFn: ({ userId, assigned }: { userId: string; assigned: boolean }) =>
      setCustomRoleMember(role.id, userId, assigned),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (error: Error) => toast.error("Not changed", { description: error.message }),
  });
  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Users · {role.name}</DialogTitle>
          <DialogDescription>
            Tick people to move them onto this role; untick to return them to the base role.
          </DialogDescription>
        </DialogHeader>
        {members.isPending ? (
          <p className="mis-empty">Loading…</p>
        ) : members.isError ? (
          <p className="mis-empty">{members.error.message}</p>
        ) : !members.data.items.length ? (
          <p className="mis-empty">No single-role users of this base role yet.</p>
        ) : (
          <ul className="crl-members">
            {members.data.items.map((person) => (
              <li key={person.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={person.assigned}
                    disabled={toggle.isPending}
                    onChange={(event) =>
                      toggle.mutate({ userId: person.id, assigned: event.target.checked })
                    }
                  />
                  <span>
                    <strong>{person.displayName}</strong>
                    <small>{person.email}</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
