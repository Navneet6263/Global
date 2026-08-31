export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface TokenIdentity {
  userId: bigint;
  userPublicId: string;
  tenantId: bigint;
  tenantPublicId: string;
  branchPublicId?: string;
  email: string;
}
