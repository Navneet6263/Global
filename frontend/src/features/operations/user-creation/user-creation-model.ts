import type { Role } from "@/config/roles";
import type { UserCreationPolicy } from "@/lib/backend-api/users";

export interface OpsCreationOptions {
  roles: Role[];
  branches: Array<{ id: string; label: string }>;
  allowTenantWide: boolean;
}

/**
 * Turns the server's creation policy into Create User dialog options. Returns null
 * while the Platform Admin toggle is OFF, so the Ops workspace shows no entry at all.
 * The API re-checks every rule on submit; this only shapes the reused dialog.
 */
export function opsCreationOptions(
  policy: UserCreationPolicy | undefined,
  knownRoles: readonly Role[],
): OpsCreationOptions | null {
  if (!policy?.enabled) return null;
  const roles = knownRoles.filter((role) => policy.roles.includes(role));
  if (!roles.length) return null;
  return {
    roles,
    branches: policy.branches.map((branch) => ({
      id: branch.id,
      label: branch.city ? `${branch.name} · ${branch.city}` : branch.name,
    })),
    allowTenantWide: policy.tenantWideAllowed,
  };
}
