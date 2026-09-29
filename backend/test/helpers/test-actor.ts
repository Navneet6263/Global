import type { Actor } from "../../src/common/auth/actor";

/** A signed-in actor for unit tests; tenant 7, user 11 unless overridden. */
export function testActor(
  roles: string[],
  permissions: string[],
  extra: Partial<Actor> = {},
): Actor {
  return {
    userId: 11n,
    userPublicId: "00000000-0000-4000-8000-000000000011",
    tenantId: 7n,
    tenantPublicId: "00000000-0000-4000-8000-000000000007",
    tenantName: "Sapling Global",
    email: "user@sapling.example",
    displayName: "Sam SPOC",
    mustChangePassword: false,
    roles,
    permissions,
    ...extra,
  };
}

/** JSON with bigint ids, for asserting on Prisma where / data shapes. */
export function bigJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    typeof entry === "bigint" ? entry.toString() : entry,
  );
}
