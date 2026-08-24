export interface Actor {
  userId: bigint;
  userPublicId: string;
  tenantId: bigint;
  tenantPublicId: string;
  tenantName: string;
  clientId?: bigint;
  clientPublicId?: string;
  clientName?: string;
  email: string;
  displayName: string;
  sessionPublicId?: string;
  mustChangePassword: boolean;
  roles: string[];
  permissions: string[];
}

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  email: string;
  sessionId: string;
  type: "access";
}
