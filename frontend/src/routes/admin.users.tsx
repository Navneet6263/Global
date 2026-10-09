import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { PlatformUser } from "@/lib/contracts/user";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CreateUserDialog } from "@/features/users/components/create-user-dialog";
import {
  TemporaryPasswordDialog,
  type TemporaryPasswordReceipt,
} from "@/features/users/components/temporary-password-dialog";
import {
  useCreateUser,
  useResetUserPassword,
  useSetUserStatus,
} from "@/features/users/hooks/use-users";
import { PeopleDirectory } from "@/features/users/PeopleDirectory";
import { listBranches } from "@/lib/backend-api/settings";
import { listAllClients } from "@/lib/backend-api/cases";
import { mapUser } from "@/lib/api/http/user-repository";
import { UserActivityDrawer } from "@/features/users/components/user-activity-drawer";
import { EditUserRolesDialog } from "@/features/users/components/edit-user-roles-dialog";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "User IDs & Access — Sapling Global" },
      {
        name: "description",
        content:
          "Create user IDs, give roles, teams and access, reset credentials and suspend access.",
      },
      { property: "og:title", content: "User IDs & Access — Sapling Global" },
      {
        property: "og:description",
        content: "Create user IDs, give roles, teams and access, and control platform access.",
      },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const [creating, setCreating] = useState(false);
  const [passwordReceipt, setPasswordReceipt] = useState<TemporaryPasswordReceipt | null>(null);
  const [activityUser, setActivityUser] = useState<PlatformUser | null>(null);
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const createUser = useCreateUser();
  const setStatus = useSetUserStatus();
  const resetPassword = useResetUserPassword();
  const scopes = useQuery({
    queryKey: ["users", "scope-options"],
    queryFn: async () => {
      const [branches, clients] = await Promise.all([listBranches(), listAllClients()]);
      return { branches: branches.items, clients };
    },
    staleTime: 60_000,
  });
  const clients = (scopes.data?.clients ?? []).map((client) => ({
    id: client.publicId,
    label: client.displayName,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="User IDs & access"
        description="Everyone who can sign in: their role, team and access. Every change is written to the audit trail."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" aria-hidden />
            Create user ID
          </Button>
        }
      />

      <PeopleDirectory
        title="People"
        description="Click a summary box to filter. Use ⋯ on a row to edit role and access, reset the password or suspend."
        storageKey="admin-people-columns"
        busyIds={[
          ...(setStatus.isPending && setStatus.variables ? [setStatus.variables.id] : []),
          ...(resetPassword.isPending && resetPassword.variables ? [resetPassword.variables] : []),
        ]}
        actions={{
          onViewActivity: (user) => setActivityUser(mapUser(user)),
          onEditRoles: (user) => setEditingUser(mapUser(user)),
          onToggleStatus: (user) => {
            const next = user.status === "SUSPENDED" ? "active" : "suspended";
            setStatus.mutate(
              { id: user.id, status: next },
              {
                onSuccess: () =>
                  toast.success(
                    `${user.displayName} ${next === "active" ? "reactivated" : "suspended"}`,
                  ),
                onError: (error: Error) =>
                  toast.error("User access could not be updated", {
                    description: error.message,
                  }),
              },
            );
          },
          onResetPassword: (user) =>
            resetPassword.mutate(user.id, {
              onSuccess: (result) =>
                setPasswordReceipt({
                  kind: "reset",
                  fullName: user.displayName,
                  email: user.email,
                  password: result.temporaryPassword,
                }),
              onError: (error: Error) =>
                toast.error("Password reset failed", { description: error.message }),
            }),
        }}
      />

      <CreateUserDialog
        open={creating}
        submitting={createUser.isPending}
        branches={(scopes.data?.branches ?? []).map((branch) => ({
          id: branch.id,
          label: `${branch.name}${branch.city ? ` · ${branch.city}` : ""}`,
        }))}
        clients={clients}
        onOpenChange={setCreating}
        onSubmit={(input) =>
          createUser.mutate(input, {
            onSuccess: (result) => {
              setCreating(false);
              setPasswordReceipt({
                kind: "created",
                fullName: result.user.fullName,
                email: result.user.email,
                password: result.temporaryPassword,
              });
            },
            onError: (error: Error) =>
              toast.error("User ID could not be created", { description: error.message }),
          })
        }
      />
      <TemporaryPasswordDialog
        receipt={passwordReceipt}
        onClose={() => {
          setPasswordReceipt(null);
          createUser.reset();
          resetPassword.reset();
        }}
      />
      <UserActivityDrawer user={activityUser} onClose={() => setActivityUser(null)} />
      {editingUser ? (
        <EditUserRolesDialog
          key={editingUser.id}
          user={editingUser}
          clients={clients}
          onClose={() => setEditingUser(null)}
        />
      ) : null}
    </div>
  );
}
