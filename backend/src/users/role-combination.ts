import { ConflictException } from "@nestjs/common";

/** Which roles one person may hold together. Sent to the Create / Edit user screens. */
export interface RoleRules {
  /** Most roles one user may hold. */
  maxRoles: number;
  /** Roles that are always held alone. */
  singleRoles: readonly string[];
}

const SINGLE_ROLE_REASONS: Readonly<Record<string, string>> = {
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
 * The normal rule: up to 3 roles; full access (Platform Admin), the operations owner
 * (Ops Manager) and people outside the delivery team (client, vendor, support desk)
 * are always held alone.
 */
export const STANDARD_ROLE_RULES: RoleRules = {
  maxRoles: 3,
  singleRoles: [
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
    "CLIENT_ADMIN",
    "VENDOR",
    "SUPPORT_AGENT",
  ],
};

/**
 * TEMPORARY, for testing (ALLOW_ALL_INTERNAL_ROLES=true): one person may hold every
 * internal role. Only people outside Sapling (client, vendor) stay single. Switch the
 * setting off to return to STANDARD_ROLE_RULES; no code change is needed.
 */
export const ALL_INTERNAL_ROLE_RULES: RoleRules = {
  maxRoles: 12,
  singleRoles: ["CLIENT_ADMIN", "VENDOR"],
};

export function roleRules(allowAllInternalRoles: boolean): RoleRules {
  return allowAllInternalRoles ? ALL_INTERNAL_ROLE_RULES : STANDARD_ROLE_RULES;
}

/**
 * Internal working roles may be combined (for example RM + Data Entry); the person then
 * switches between workspaces. Every combination needs an explicit confirmation.
 */
export function assertSafeRoleCombination(
  roleCodes: readonly string[],
  additionalAccessConfirmed?: boolean,
  rules: RoleRules = STANDARD_ROLE_RULES,
): void {
  const unique = [...new Set(roleCodes)];
  if (unique.length <= 1) return;
  if (!additionalAccessConfirmed) {
    throw new ConflictException(
      "Additional role access must be explicitly confirmed",
    );
  }
  if (unique.length > rules.maxRoles) {
    throw new ConflictException(
      `A user can hold at most ${rules.maxRoles} roles`,
    );
  }
  for (const role of unique) {
    if (rules.singleRoles.includes(role))
      throw new ConflictException(
        SINGLE_ROLE_REASONS[role] ??
          `${role} is a single role and cannot be combined`,
      );
  }
}
