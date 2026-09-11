import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { ROLES, ROLE_DEFINITIONS, type Role } from "@/config/roles";
import type { PlatformUser, UserQuery, UserStatus } from "@/lib/contracts/user";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { TableSkeleton } from "@/components/feedback/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserTable } from "@/features/users/components/user-table";
import { CreateUserDialog } from "@/features/users/components/create-user-dialog";
import {
  TemporaryPasswordDialog,
  type TemporaryPasswordReceipt,
} from "@/features/users/components/temporary-password-dialog";
import {
  useCreateUser,
  useResetUserPassword,
  useSetUserStatus,
  useUsers,
} from "@/features/users/hooks/use-users";
import { listBranches } from "@/lib/backend-api/settings";
import { listAllClients } from "@/lib/backend-api/cases";
import { UserActivityDrawer } from "@/features/users/components/user-activity-drawer";
import { EditUserRolesDialog } from "@/features/users/components/edit-user-roles-dialog";

const STATUS_OPTIONS: { value: UserStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
  { value: "suspended", label: "Suspended" },
];

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "User IDs & Access — Sapling Global" },
      {
        name: "description",
        content:
          "Issue platform user IDs, assign roles and branch scope, reset credentials and suspend access.",
      },
      { property: "og:title", content: "User IDs & Access — Sapling Global" },
      {
        property: "og:description",
        content: "Issue user IDs, assign roles and branch scope, and control platform access.",
      },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const [query, setQuery] = useState<UserQuery>({
    search: "",
    role: "all",
    status: "all",
    page: 1,
    pageSize: 10,
  });
  const [creating, setCreating] = useState(false);
  const [passwordReceipt, setPasswordReceipt] = useState<TemporaryPasswordReceipt | null>(null);
  const [activityUser, setActivityUser] = useState<PlatformUser | null>(null);
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);

  const { data, isPending, isError, isFetching, refetch } = useUsers(query);
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
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User IDs & access"
        description="Role-scoped platform identities. Roles drive workspace access, and every change is written to the audit trail."
        meta={data ? `${data.total} platform users` : undefined}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" aria-hidden />
            Create user ID
          </Button>
        }
      />

      <div className="surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
          <Input
            value={query.search ?? ""}
            onChange={(event) => setQuery((c) => ({ ...c, search: event.target.value, page: 1 }))}
            placeholder="Search name or email"
            aria-label="Search users"
            className="w-full sm:max-w-xs"
          />
          <Select
            value={query.role ?? "all"}
            onValueChange={(value) =>
              setQuery((c) => ({ ...c, role: value as Role | "all", page: 1 }))
            }
          >
            <SelectTrigger className="w-[200px]" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_DEFINITIONS[role].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={query.status ?? "all"}
            onValueChange={(value) =>
              setQuery((c) => ({ ...c, status: value as UserStatus | "all", page: 1 }))
            }
          >
            <SelectTrigger className="w-[170px]" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isError ? (
          <div className="p-5">
            <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
          </div>
        ) : null}

        {isPending ? (
          <div className="p-5">
            <TableSkeleton rows={8} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Users}
              title="No users match these filters"
              description="Try another role or status, or search by employee ID."
            />
          </div>
        ) : (
          <>
            <UserTable
              rows={rows}
              busyUserIds={[
                ...(setStatus.isPending && setStatus.variables ? [setStatus.variables.id] : []),
                ...(resetPassword.isPending && resetPassword.variables
                  ? [resetPassword.variables]
                  : []),
              ]}
              onViewActivity={setActivityUser}
              onEditRoles={setEditingUser}
              onToggleStatus={(user) => {
                const next = user.status === "suspended" ? "active" : "suspended";
                setStatus.mutate(
                  { id: user.id, status: next },
                  {
                    onSuccess: () =>
                      toast.success(
                        `${user.fullName} ${next === "active" ? "reactivated" : "suspended"}`,
                      ),
                    onError: (error: Error) =>
                      toast.error("User access could not be updated", {
                        description: error.message,
                      }),
                  },
                );
              }}
              onResetPassword={(user) =>
                resetPassword.mutate(user.id, {
                  onSuccess: (result) =>
                    setPasswordReceipt({
                      kind: "reset",
                      fullName: user.fullName,
                      email: user.email,
                      password: result.temporaryPassword,
                    }),
                  onError: (error: Error) =>
                    toast.error("Password reset failed", { description: error.message }),
                })
              }
            />
            <PaginationBar
              page={query.page ?? 1}
              pageSize={query.pageSize ?? 10}
              total={data?.total ?? 0}
              onPageChange={(page) => setQuery((c) => ({ ...c, page }))}
              label="users"
            />
          </>
        )}
      </div>

      <CreateUserDialog
        open={creating}
        submitting={createUser.isPending}
        branches={(scopes.data?.branches ?? []).map((branch) => ({
          id: branch.id,
          label: `${branch.name}${branch.city ? ` · ${branch.city}` : ""}`,
        }))}
        clients={(scopes.data?.clients ?? []).map((client) => ({
          id: client.publicId,
          label: client.displayName,
        }))}
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
          onClose={() => setEditingUser(null)}
        />
      ) : null}
    </div>
  );
}
