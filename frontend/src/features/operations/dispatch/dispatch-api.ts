import { apiRequest } from "@/lib/backend-api/client";

export type DispatchCheck = {
  id: string;
  type: string;
  checkVersion: number;
  taskId?: string;
  version?: number;
};
export type DispatchCase = {
  id: string;
  caseNumber: string;
  candidateName: string;
  clientName: string;
  branchName: string;
  status: string;
  version: number;
  ready: boolean;
  issues: string[];
  checks: DispatchCheck[];
  eligibleVerifierIds: string[];
};
export type DispatchVerifier = {
  id: string;
  name: string;
  email: string;
  branchName: string;
  activeChecks: number;
  overdue: number;
};
export type DispatchPreview = {
  cases: DispatchCase[];
  verifiers: DispatchVerifier[];
  unavailableIds: string[];
  verifierLimitReached: boolean;
  workloadScope: string;
};
export type DispatchBody = {
  operationId: string;
  version: number;
  instructions?: string;
  allocations: {
    checkId: string;
    assigneeId: string;
    checkVersion: number;
    taskId?: string;
    version?: number;
  }[];
};
export type DispatchResult = {
  caseId: string;
  assigned: number;
  started: boolean;
  version: number;
};
export type DispatchProgress = {
  status: "waiting" | "saving" | "success" | "error";
  message?: string;
  assigned?: number;
};

export function previewDispatch(caseIds: string[], signal?: AbortSignal) {
  return apiRequest<DispatchPreview>(
    `/cases/dispatch/preview?${new URLSearchParams({ caseIds: caseIds.join(",") })}`,
    { signal },
  );
}
export function commitDispatch(caseId: string, body: DispatchBody, key: string) {
  return apiRequest<DispatchResult>(`/cases/dispatch/${caseId}/commit`, {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
}

export function buildDispatchBody(
  record: DispatchCase,
  allocations: Record<string, string>,
  operationId: string,
  instructions: string,
): DispatchBody {
  if (!record.ready || !record.checks.length) throw new Error("Case is not ready for dispatch");
  return {
    operationId,
    version: record.version,
    ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
    allocations: record.checks.map((check) => {
      const assigneeId = allocations[check.id];
      if (!assigneeId || !record.eligibleVerifierIds.includes(assigneeId))
        throw new Error("Choose an eligible verifier for every check");
      return {
        checkId: check.id,
        checkVersion: check.checkVersion,
        assigneeId,
        ...(check.taskId ? { taskId: check.taskId, version: check.version } : {}),
      };
    }),
  };
}

/** A bounded batch, not one unbounded transaction or a request for every case at once. */
export async function runDispatchBatch<T>(
  items: T[],
  work: (item: T) => Promise<void>,
  isActive: () => boolean = () => true,
) {
  let next = 0;
  const worker = async () => {
    while (next < items.length && isActive()) {
      const item = items[next++];
      if (item !== undefined) await work(item);
    }
  };
  await Promise.all([worker(), worker()]);
}
