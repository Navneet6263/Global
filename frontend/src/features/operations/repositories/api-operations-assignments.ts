import type {
  AssignInput,
  AssignmentQueue,
  AssignmentResult,
  CaseActionInput,
  CaseActionResult,
} from "../contracts/operations";
import { priorityOf, slaOf, typeOf } from "./api-operations-mappers";
import { getCase } from "@/lib/backend-api/cases";
import { apiRequest } from "@/lib/backend-api/client";
import { createTask } from "@/lib/backend-api/tasks";
import { listAllUsers } from "@/lib/backend-api/users";
import { listAllOperationCases } from "./api-operations-cases";
import { buildVerifierTeam } from "./api-operations-team";

const activeTaskByCheck = new Map<string, { id: string; version: number; assigned: boolean }>();

export async function getApiAssignments(): Promise<AssignmentQueue> {
  const [cases, users] = await Promise.all([listAllOperationCases(), listAllUsers("VERIFIER")]);
  activeTaskByCheck.clear();
  const items = cases.flatMap((row) =>
    row.checks.flatMap((check) => {
      const activeTask = (check.tasks ?? []).find((task) =>
        ["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED"].includes(task.status),
      );
      if (activeTask) {
        activeTaskByCheck.set(check.publicId, {
          id: activeTask.publicId,
          version: activeTask.version,
          assigned: Boolean(activeTask.assignee),
        });
      }
      if (activeTask?.assignee || check.status === "COMPLETED") return [];
      const sla = slaOf(check.dueAt ?? row.dueAt);
      return [
        {
          id: check.publicId,
          caseId: row.id,
          caseNumber: row.caseNumber,
          candidateName: row.subject.fullName,
          clientName: row.client.displayName,
          checkType: typeOf(check.type),
          checkLabel: check.type.replaceAll("_", " "),
          priority: priorityOf(row.priority),
          slaState: sla.state,
          slaMinutesRemaining: sla.minutes,
          branch: row.branch?.name ?? "No branch assigned",
          city: row.branch?.city ?? "Location not recorded",
          requestedAt: row.createdAt,
        },
      ];
    }),
  );
  return {
    items,
    members: buildVerifierTeam(cases, users.items).members,
  };
}

export async function assignApiChecks(input: AssignInput): Promise<AssignmentResult> {
  return bulkAssign(input, "ASSIGN");
}

export async function reassignApiChecks(input: AssignInput): Promise<AssignmentResult> {
  const missing = input.itemIds.filter((checkId) => !activeTaskByCheck.get(checkId)?.assigned);
  if (missing.length) throw new Error("Refresh the assignment queue before reassigning work");
  return bulkAssign(input, "REASSIGN");
}

export async function runApiCaseAction(input: CaseActionInput): Promise<CaseActionResult> {
  const detail = await getCase(input.caseId);
  if (input.action === "escalate") {
    await apiRequest(`/cases/${input.caseId}/escalation`, {
      method: "PATCH",
      body: JSON.stringify({
        version: detail.version,
        note: input.note || "Operations escalated this case for client attention.",
      }),
    });
    return { caseId: input.caseId, message: "Case escalated for client attention" };
  }
  if (["assign_verifier", "reassign_verifier"].includes(input.action) && input.value) {
    const check = detail.checks.find((item) => item.status !== "COMPLETED");
    if (!check) throw new Error("No open check is available for assignment");
    const activeTask = (check.tasks ?? []).find((task) => task.status !== "COMPLETED");
    if (activeTask) {
      await reassignTask(activeTask.publicId, input.value, activeTask.version, input.note);
    } else {
      await createTask(check.publicId, { assigneeId: input.value, instructions: input.note });
    }
    return {
      caseId: input.caseId,
      message: input.action === "reassign_verifier" ? "Verifier reassigned" : "Verifier assigned",
    };
  }
  throw new Error("This workflow action needs a dedicated backend endpoint");
}

function bulkAssign(input: AssignInput, mode: "ASSIGN" | "REASSIGN") {
  return apiRequest<AssignmentResult>("/tasks/bulk-assignment", {
    method: "POST",
    body: JSON.stringify({
      assigneeId: input.memberId,
      mode,
      instructions: input.note,
      items: input.itemIds.map((checkId) => {
        const activeTask = activeTaskByCheck.get(checkId);
        return activeTask
          ? { checkId, taskId: activeTask.id, version: activeTask.version }
          : { checkId };
      }),
    }),
  });
}

function reassignTask(taskId: string, assigneeId: string, version: number, instructions?: string) {
  return apiRequest(`/tasks/${taskId}/assignee`, {
    method: "PATCH",
    body: JSON.stringify({ assigneeId, version, instructions }),
  });
}
