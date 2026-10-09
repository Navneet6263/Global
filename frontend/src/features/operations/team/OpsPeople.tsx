import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ROLES, type Role } from "@/config/roles";
import type { PlatformUser } from "@/lib/contracts/user";
import { listAllClients } from "@/lib/backend-api/cases";
import type { DirectoryUser } from "@/lib/backend-api/users";
import { mapUser } from "@/lib/api/http/user-repository";
import { PeopleDirectory } from "@/features/users/PeopleDirectory";
import { EditUserRolesDialog } from "@/features/users/components/edit-user-roles-dialog";
import {
  TemporaryPasswordDialog,
  type TemporaryPasswordReceipt,
} from "@/features/users/components/temporary-password-dialog";
import { useResetUserPassword, useSetUserStatus } from "@/features/users/hooks/use-users";
import { useOpsUserCreationPolicy } from "@/features/operations/user-creation/use-ops-user-creation";

/**
 * People & IDs for Operations. When the admin switch "Ops Managers can create users" is
 * ON, Operations also edits role & access, resets passwords and suspends, but only for
 * the roles it may give (never an admin or another Ops Manager). The API re-checks it all.
 */
export function OpsPeople() {
  const policy = useOpsUserCreationPolicy();
  const canManage = policy.data?.enabled === true;
  const allowed = (policy.data?.roles ?? []).filter((role): role is Role =>
    (ROLES as readonly string[]).includes(role),
  );
  const manageable = (user: DirectoryUser) =>
    canManage && user.roles.every((role) => allowed.includes(role.code as Role));
  const [editing, setEditing] = useState<PlatformUser | null>(null);
  const [receipt, setReceipt] = useState<TemporaryPasswordReceipt | null>(null);
  const setStatus = useSetUserStatus();
  const resetPassword = useResetUserPassword();
  const clients = useQuery({
    queryKey: ["users", "ops-client-options"],
    queryFn: () => listAllClients(),
    enabled: canManage,
    staleTime: 60_000,
  });
  const refuse = () =>
    toast.error("Not available", {
      description: "Operations can change only the IDs it may create. Ask the Platform Admin.",
    });

  return (
    <>
      <PeopleDirectory
        title="People & IDs"
        description={
          canManage
            ? "Everyone in your scope. Use ⋯ to change role & access, reset a password or suspend."
            : "Everyone with a login in your scope, their role and team. Ask the Platform Admin to allow Operations to manage IDs."
        }
        storageKey="ops-people-columns"
        busyIds={[
          ...(setStatus.isPending && setStatus.variables ? [setStatus.variables.id] : []),
          ...(resetPassword.isPending && resetPassword.variables ? [resetPassword.variables] : []),
        ]}
        actions={
          canManage
            ? {
                onEditRoles: (user) => (manageable(user) ? setEditing(mapUser(user)) : refuse()),
                onResetPassword: (user) =>
                  manageable(user)
                    ? resetPassword.mutate(user.id, {
                        onSuccess: (result) =>
                          setReceipt({
                            kind: "reset",
                            fullName: user.displayName,
                            email: user.email,
                            password: result.temporaryPassword,
                          }),
                        onError: (error: Error) =>
                          toast.error("Password not reset", { description: error.message }),
                      })
                    : refuse(),
                onToggleStatus: (user) => {
                  if (!manageable(user)) {
                    refuse();
                    return;
                  }
                  const next = user.status === "SUSPENDED" ? "active" : "suspended";
                  setStatus.mutate(
                    { id: user.id, status: next },
                    {
                      onSuccess: () =>
                        toast.success(
                          `${user.displayName} ${next === "active" ? "reactivated" : "suspended"}`,
                        ),
                      onError: (error: Error) =>
                        toast.error("Not changed", { description: error.message }),
                    },
                  );
                },
              }
            : undefined
        }
      />
      {editing ? (
        <EditUserRolesDialog
          key={editing.id}
          user={editing}
          roles={allowed}
          clients={(clients.data ?? []).map((client) => ({
            id: client.publicId,
            label: client.displayName,
          }))}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <TemporaryPasswordDialog
        receipt={receipt}
        onClose={() => {
          setReceipt(null);
          resetPassword.reset();
        }}
      />
    </>
  );
}
