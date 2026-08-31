import { API_BASE_URL as apiBase } from "@/config/api";

export type ProblemDetails = {
  status: number;
  title?: string;
  detail?: string | string[];
  requestId?: string;
};

export class ApiError extends Error {
  constructor(public readonly problem: ProblemDetails) {
    super(
      Array.isArray(problem.detail)
        ? problem.detail.join(". ")
        : (problem.detail ?? problem.title ?? "Request failed"),
    );
  }
}

let refreshPromise: Promise<boolean> | null = null;
let expiryCleanup: (() => Promise<void> | void) | null = null;
let expiryCleanupPromise: Promise<void> | null = null;
const refreshVersionKey = "sapling.auth.refresh-version";

export function registerSessionExpiryHandler(handler: () => Promise<void> | void): void {
  expiryCleanup = handler;
}

async function handleExpiredSession(): Promise<void> {
  if (!expiryCleanup) return;
  if (!expiryCleanupPromise) {
    expiryCleanupPromise = Promise.resolve(expiryCleanup()).finally(() => {
      expiryCleanupPromise = null;
    });
  }
  await expiryCleanupPromise.catch(() => undefined);
}

function refreshVersion() {
  try {
    return window.localStorage.getItem(refreshVersionKey);
  } catch {
    return null;
  }
}

function markRefreshed() {
  try {
    window.localStorage.setItem(refreshVersionKey, crypto.randomUUID());
  } catch {
    // Storage can be disabled; the in-tab single-flight remains safe.
  }
}

async function performRefresh() {
  const response = await fetch(`${apiBase}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (response.ok) markRefreshed();
  return response.ok;
}

async function coordinatedRefresh() {
  const before = refreshVersion();
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("sapling-auth-refresh", async () => {
      if (refreshVersion() !== before) return true;
      return performRefresh();
    });
  }
  return performRefresh();
}

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = coordinatedRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function toApiError(response: Response) {
  let problem: ProblemDetails = { status: response.status, title: response.statusText };
  try {
    problem = (await response.json()) as ProblemDetails;
  } catch {
    // Non-JSON upstream errors still become a stable client error.
  }
  return new ApiError(problem);
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  headers.set("accept", "application/json");
  const method = (init.method ?? "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !headers.has("idempotency-key")) {
    headers.set("idempotency-key", crypto.randomUUID());
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (
    response.status === 401 &&
    allowRefresh &&
    !["/auth/login", "/auth/refresh", "/auth/logout"].includes(path)
  ) {
    if (await refreshSession()) {
      return apiRequest<T>(path, { ...init, headers }, false);
    }
  }
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login") await handleExpiredSession();
    throw await toApiError(response);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiDownload(path: string, allowRefresh = true): Promise<Blob> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    headers: { accept: "application/octet-stream, application/pdf" },
  });
  if (response.status === 401 && allowRefresh && (await refreshSession())) {
    return apiDownload(path, false);
  }
  if (!response.ok) {
    if (response.status === 401) await handleExpiredSession();
    throw await toApiError(response);
  }
  return response.blob();
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
