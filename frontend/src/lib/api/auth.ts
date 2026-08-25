import { apiRequest } from "./client";

export type Session = {
  id: string;
  tenantId: string;
  tenantName: string;
  clientId?: string;
  clientName?: string;
  email: string;
  displayName: string;
  mustChangePassword: boolean;
  roles: string[];
  permissions: string[];
};

export type ActiveSession = {
  id: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
};

export function getSession() {
  return apiRequest<Session>("/auth/me");
}

export function login(input: { tenantCode: string; email: string; password: string }) {
  return apiRequest<{ authenticated: true; session: Session }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logout() {
  try {
    return await apiRequest<{ authenticated: false }>("/auth/logout", { method: "POST" }, false);
  } finally {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.controller?.postMessage({ type: "PURGE_PRIVATE_CACHE" });
    }
  }
}

export function changePassword(input: { currentPassword: string; newPassword: string }) {
  return apiRequest<{ changed: true }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listActiveSessions() {
  return apiRequest<{ items: ActiveSession[] }>("/auth/sessions");
}

export function revokeActiveSession(sessionId: string) {
  return apiRequest<{ revoked: number; current: boolean }>(`/auth/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export function revokeOtherSessions() {
  return apiRequest<{ revoked: number }>("/auth/sessions/others", { method: "DELETE" });
}
