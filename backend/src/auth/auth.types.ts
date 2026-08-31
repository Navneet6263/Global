export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
  deviceKey?: string;
  locationLabel?: string;
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
