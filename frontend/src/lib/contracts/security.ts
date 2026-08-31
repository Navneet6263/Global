export interface ActiveSession {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  locationLabel: string;
  startedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export type AuthEventType =
  | "login_success"
  | "login_failure"
  | "password_change"
  | "session_revoked"
  | "refresh_token_reuse"
  | "mfa_challenge";

export interface AuthEvent {
  id: string;
  type: AuthEventType;
  at: string;
  ipAddress: string | null;
  locationLabel: string;
  userAgent: string | null;
  detail: string;
}

export interface SecurityOverview {
  sessions: readonly ActiveSession[];
  events: readonly AuthEvent[];
  refreshReuseDetected: boolean;
  passwordUpdatedAt: string;
}
