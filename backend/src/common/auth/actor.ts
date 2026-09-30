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
  email: string;
  displayName: string;
  sessionPublicId?: string;
  mustChangePassword: boolean;
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
