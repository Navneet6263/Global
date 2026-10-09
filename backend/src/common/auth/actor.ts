export interface Actor {
  userId: bigint;
  userPublicId: string;
  tenantId: bigint;
  tenantPublicId: string;
  tenantName: string;
  branchId?: bigint;
  branchPublicId?: string;
  branchName?: string;
  clientId?: bigint;
  clientPublicId?: string;
  clientName?: string;
  /** Client users only: ONBOARDING while a self sign-up company is not yet approved. */
  clientStatus?: string;
  email: string;
  displayName: string;
  sessionPublicId?: string;
  mustChangePassword: boolean;
  /** Tenant switch: branch (office) scoping on or off. */
  branchScoping?: boolean;
  roles: string[];
  permissions: string[];
  /**
   * SPOC-RM only: the clients it may monitor (SpocClientScope), reloaded on every
   * request. Undefined for every other role, which keep the single clientId above.
   */
  spocClients?: readonly SpocClient[];
  /**
   * Vendor team users only: the Main Vendor that manages this login. Undefined for a
   * Main Vendor and every other role. Team users work only requests delegated to them.
   */
  vendorOwnerId?: bigint;
  /**
   * Active department memberships (Data Entry, Employment...), reloaded on every request
   * for DATA_ENTRY and VERIFIER users. LEAD = Team Leader of that department.
   */
  departments?: readonly ActorDepartment[];
}

export interface ActorDepartment {
  id: bigint;
  publicId: string;
  code: string;
  name: string;
  kind: string;
  role: "LEAD" | "MEMBER";
}

export interface SpocClient {
  id: bigint;
  publicId: string;
  name: string;
}

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  branchId?: string;
  email: string;
  sessionId: string;
  type: "access";
}
