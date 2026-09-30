import type { PrismaService } from "../../src/database/prisma.service";
import { testActor } from "./test-actor";

export const MEMBER = "77777777-7777-4777-8777-777777777777";
export const OTHER = "88888888-8888-4888-8888-888888888888";

/** Main Vendor XYZ (user 31) and its team user Ravi (user 41). */
export const mainVendor = testActor(
  ["VENDOR"],
  ["vendor:review", "notification:read"],
  {
    userId: 31n,
    userPublicId: "00000000-0000-4000-8000-000000000031",
    displayName: "XYZ Vendors",
  },
);
export const teamUser = testActor(
  ["VENDOR"],
  ["vendor:review", "notification:read"],
  {
    userId: 41n,
    displayName: "Ravi",
    vendorOwnerId: 31n,
  },
);

export type Call = { name: string; args: Record<string, unknown> };

/**
 * A fake Prisma for team writes. Every call is recorded in order (so lock-before-count
 * can be asserted); `vendorOwnerId` counts and the policy limit are configurable.
 */
export function teamPrisma(
  options: {
    locked?: number;
    limit?: number | null;
    active?: number;
    emailTaken?: boolean;
    member?: Record<string, unknown> | null;
    statusUpdated?: number;
    released?: number;
  } = {},
) {
  const calls: Call[] = [];
  const record =
    (name: string, result: unknown) =>
    (args: Record<string, unknown> = {}): Promise<unknown> => {
      calls.push({ name, args });
      return Promise.resolve(result);
    };
  const member =
    options.member === undefined
      ? {
          id: 42n,
          publicId: MEMBER,
          displayName: "Asha",
          status: "ACTIVE",
          version: 3,
        }
      : options.member;
  const tx = {
    user: {
      updateMany: (args: { data?: { status?: string } }) => {
        const isStatus = Boolean(args.data?.status);
        calls.push({ name: isStatus ? "status" : "lock", args });
        return Promise.resolve({
          count: isStatus
            ? (options.statusUpdated ?? 1)
            : (options.locked ?? 1),
        });
      },
      count: record("count", options.active ?? 0),
      findFirst: (args: { where?: { normalizedEmail?: string } }) => {
        if (args.where?.normalizedEmail !== undefined) {
          calls.push({ name: "email", args });
          return Promise.resolve(options.emailTaken ? { id: 1n } : null);
        }
        calls.push({ name: "member", args });
        return Promise.resolve(member);
      },
      create: (args: { data: { email: string; displayName: string } }) => {
        calls.push({ name: "create", args });
        return Promise.resolve({
          publicId: "u-new",
          email: args.data.email,
          displayName: args.data.displayName,
          status: "ACTIVE",
          mustChangePassword: true,
          version: 1,
          createdAt: new Date(0),
        });
      },
      update: record("password", {}),
    },
    vendorTeamPolicy: {
      findUnique: record(
        "policy",
        options.limit === null ? null : { maxActiveUsers: options.limit ?? 2 },
      ),
    },
    role: { findMany: record("roles", [{ id: 9n, code: "VENDOR" }]) },
    refreshSession: { updateMany: record("revoke", { count: 1 }) },
    vendorAssignment: {
      updateMany: record("release", { count: options.released ?? 0 }),
    },
    notification: { create: record("notify", {}) },
    auditEvent: { create: record("audit", {}) },
  };
  const prisma = {
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  return { prisma, tx, calls, names: () => calls.map((call) => call.name) };
}
