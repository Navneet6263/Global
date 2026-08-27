export interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  operatingSystem: string;
  ipAddress: string;
  location: string;
  startedAt: string;
  lastSeenAt: string;
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
  ipAddress: string;
  device: string;
  detail: string;
}

export interface SecurityOverview {
  sessions: readonly ActiveSession[];
  events: readonly AuthEvent[];
  refreshReuseDetected: boolean;
  passwordUpdatedAt: string;
}
