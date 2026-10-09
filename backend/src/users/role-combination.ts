import { ConflictException } from "@nestjs/common";

/**
 * Roles that are always held alone: full access (Platform Admin), the operations owner
 * (Ops Manager), and people outside the delivery team (client, vendor, support desk).
 */
export const SINGLE_ROLES: Readonly<Record<string, string>> = {
  PLATFORM_ADMIN:
    "Platform Admin is full access and cannot be combined with another role",
  OPS_MANAGER: "Operations Manager is a single role and cannot be combined",
  CLIENT_ADMIN:
    "Client Admin is client-scoped and cannot be combined with an internal role",
  VENDOR:
    "Vendor is an external role and cannot be combined with an internal role",
  SUPPORT_AGENT:
    "Support Agent is a read-only support role and cannot be combined with a workflow role",
};

/**
 * Internal working roles may be combined (for example RM + Data Entry); the person then
 * switches between workspaces. Every combination needs an explicit confirmation.
 */
export function assertSafeRoleCombination(
  roleCodes: readonly string[],
  additionalAccessConfirmed?: boolean,
): void {
  const unique = [...new Set(roleCodes)];
  if (unique.length <= 1) return;
  if (!additionalAccessConfirmed) {
    throw new ConflictException(
      "Additional role access must be explicitly confirmed",
    );
  }
  for (const role of unique) {
    const reason = SINGLE_ROLES[role];
    if (reason) throw new ConflictException(reason);
  }
}
