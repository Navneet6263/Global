import { API_BASE_URL as apiBase } from "@/config/api";
import { ApiRequestScope } from "./request-scope";
import { beginRequestActivity, requestActivity } from "./request-activity";

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
const pendingGetRequests = new Map<string, Promise<unknown>>();
const requestScope = new ApiRequestScope();
const refreshVersionKey = "sapling.auth.refresh-version";

export function resetApiSession(): void {
  requestScope.reset();
  pendingGetRequests.clear();
  refreshPromise = null;
  requestActivity.reset();
}

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
  const context = requestScope.capture();
  const response = await fetch(`${apiBase}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    signal: context.signal,
  });
  context.assertCurrent();
  if (response.ok) markRefreshed();
  return response.ok;
}

async function coordinatedRefresh() {
  const context = requestScope.capture();
  const before = refreshVersion();
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("sapling-auth-refresh", async () => {
      context.assertCurrent();
      if (refreshVersion() !== before) return true;
      return performRefresh();
    });
  }
  return performRefresh();
}

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    const pending = coordinatedRefresh();
    refreshPromise = pending;
    const clear = () => {
      if (refreshPromise === pending) refreshPromise = null;
    };
    void pending.then(clear, clear);
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

export function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const mayDeduplicate =
    typeof window !== "undefined" && method === "GET" && !init.body && !init.signal;
  if (!mayDeduplicate) {
    if (method !== "GET") pendingGetRequests.clear();
    const finish =
      method !== "GET" && path !== "/auth/refresh"
        ? beginRequestActivity(init.body instanceof FormData ? "upload" : "write")
        : () => undefined;
    const request = executeApiRequest<T>(path, init, allowRefresh).finally(finish);
    if (method !== "GET") {
      const clear = () => pendingGetRequests.clear();
      void request.then(clear, clear);
    }
    return request;
  }

  const headerKey = [...new Headers(init.headers).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
  const key = JSON.stringify([
    requestScope.version,
    path,
    headerKey,
    allowRefresh,
    init.cache,
    init.mode,
  ]);
  const pending = pendingGetRequests.get(key);
  if (pending) return pending as Promise<T>;

  const request = executeApiRequest<T>(path, init, allowRefresh);
  pendingGetRequests.set(key, request);
  const clear = () => {
    if (pendingGetRequests.get(key) === request) pendingGetRequests.delete(key);
  };
  void request.then(clear, clear);
  return request;
}

async function executeApiRequest<T>(
  path: string,
  init: RequestInit,
  allowRefresh: boolean,
): Promise<T> {
  const context = requestScope.capture(
    init.signal,
    init.body instanceof FormData ? 120_000 : 30_000,
  );
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
    signal: context.signal,
  });
  context.assertCurrent();
  if (
    response.status === 401 &&
    allowRefresh &&
    !path.startsWith("/public/") &&
    !["/auth/login", "/auth/refresh", "/auth/logout"].includes(path)
  ) {
    const refreshed = await refreshSession();
    context.assertCurrent();
    if (refreshed) {
      return executeApiRequest<T>(path, { ...init, headers }, false);
    }
  }
  if (!response.ok) {
    const error = await toApiError(response);
    context.assertCurrent();
    if (response.status === 401 && path !== "/auth/login" && !path.startsWith("/public/"))
      await handleExpiredSession();
    throw error;
  }
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as T;
  context.assertCurrent();
  return body;
}

export async function apiDownload(path: string, allowRefresh = true): Promise<Blob> {
  const finish = beginRequestActivity("download");
  try {
    return await executeApiDownload(path, allowRefresh);
  } finally {
    finish();
  }
}

async function executeApiDownload(path: string, allowRefresh: boolean): Promise<Blob> {
  const context = requestScope.capture(undefined, 120_000);
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    headers: { accept: "application/octet-stream, application/pdf" },
    signal: context.signal,
  });
  context.assertCurrent();
  if (response.status === 401 && allowRefresh && !path.startsWith("/public/")) {
    const refreshed = await refreshSession();
    context.assertCurrent();
    if (refreshed) return executeApiDownload(path, false);
  }
  if (!response.ok) {
    const error = await toApiError(response);
    context.assertCurrent();
    if (response.status === 401 && !path.startsWith("/public/")) await handleExpiredSession();
    throw error;
  }
  const blob = await response.blob();
  context.assertCurrent();
  return blob;
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
