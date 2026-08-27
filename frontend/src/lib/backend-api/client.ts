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

const apiBase =
  import.meta.env["VITE_API_URL"] ??
  (typeof window !== "undefined" && ["3000", "5173"].includes(window.location.port)
    ? "http://localhost:4000/api/v1"
    : "/api/v1");

async function refreshSession() {
  const response = await fetch(`${apiBase}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  return response.ok;
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
    if (await refreshSession()) return apiRequest<T>(path, init, false);
  }
  if (!response.ok) {
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
  if (!response.ok) throw await toApiError(response);
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
