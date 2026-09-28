import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ROLE_DEFINITIONS, ROLES } from "@/config/roles";
import { CreateUserDialog } from "@/features/users/components/create-user-dialog";
import {
  TemporaryPasswordDialog,
  type TemporaryPasswordReceipt,
} from "@/features/users/components/temporary-password-dialog";
import { useCreateUser } from "@/features/users/hooks/use-users";
import { listAllClients } from "@/lib/backend-api/cases";
import { useOpsUserCreationPolicy } from "./use-ops-user-creation";
import { opsCreationOptions } from "./user-creation-model";

/**
 * Create User entry for the Operations workspace. It reuses the admin Create User
 * dialog and POST /users, and renders nothing while the Platform Admin toggle is OFF.
 */
export function OpsCreateUserAction() {
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState<TemporaryPasswordReceipt | null>(null);
  const policy = useOpsUserCreationPolicy();
  const createUser = useCreateUser();
  const options = opsCreationOptions(policy.data, ROLES);
  const needsClients = Boolean(
    options?.roles.some((role) => ROLE_DEFINITIONS[role].scopeFields.includes("clientWorkspace")),
  );
  const clients = useQuery({
    queryKey: ["users", "scope-options", "clients"],
    queryFn: () => listAllClients(),
    enabled: open && needsClients,
    staleTime: 60_000,
  });

  if (!options) return null;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-3.5" aria-hidden />
        Create user ID
      </Button>
      <CreateUserDialog
        open={open}
        submitting={createUser.isPending}
        roles={options.roles}
        allowTenantWide={options.allowTenantWide}
        branches={options.branches}
        clients={(clients.data ?? []).map((client) => ({
          id: client.publicId,
          label: client.displayName,
        }))}
        onOpenChange={setOpen}
        onSubmit={(input) =>
          createUser.mutate(input, {
            onSuccess: (result) => {
              setOpen(false);
              setReceipt({
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
        receipt={receipt}
        onClose={() => {
          setReceipt(null);
          createUser.reset();
        }}
      />
    </>
  );
}
