import { expect, test } from "@playwright/test";
import { canAccessWorkspace } from "../src/lib/auth/workspace-access";
import type { Session } from "../src/lib/backend-api/auth";

function session(...roles: string[]): Session {
  return {
    id: "user-1",
    tenantId: "tenant-1",
    tenantName: "Sapling Global",
    email: "user@example.test",
    displayName: "Test User",
    mustChangePassword: false,
    roles,
    permissions: [],
  };
}

test.describe("workspace navigation access policy", () => {
  test("allows every known workspace and its nested routes for the owning role", () => {
    expect(canAccessWorkspace(session("PLATFORM_ADMIN"), "/admin/users/active")).toBe(true);
    expect(canAccessWorkspace(session("OPS_MANAGER"), "/operations/cases/SG-1024")).toBe(true);
    expect(canAccessWorkspace(session("OPS_MANAGER"), "/cases/SG-1024")).toBe(true);
    expect(canAccessWorkspace(session("SALES_MANAGER"), "/sales-crm/opportunities/SG-42")).toBe(
      true,
    );
    expect(canAccessWorkspace(session("CLIENT_ADMIN"), "/client-portal?tab=pending")).toBe(true);
    expect(canAccessWorkspace(session("FINANCE_MANAGER"), "/change-password")).toBe(true);
  });

  test("fails closed for unknown paths, prefix collisions and another role's workspace", () => {
    expect(canAccessWorkspace(session("PLATFORM_ADMIN"), "/not-a-workspace")).toBe(false);
    expect(canAccessWorkspace(session("PLATFORM_ADMIN"), "/administrator")).toBe(false);
    expect(canAccessWorkspace(session("CLIENT_ADMIN"), "/operations/cases")).toBe(false);
    expect(canAccessWorkspace(session("OPS_MANAGER"), "/sales-crm")).toBe(false);
  });
});
