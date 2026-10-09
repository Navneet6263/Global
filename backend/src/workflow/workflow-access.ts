import { ConflictException, ForbiddenException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";

export const INTAKE_STAGES = [
  "INTAKE",
  "DATA_ENTRY",
  "CORRECTION",
  "READY",
  "ROUTED",
] as const;
export type IntakeStage = (typeof INTAKE_STAGES)[number];

export const OPEN_CLARIFICATION = ["OPEN", "RESPONDED"];
export const ACTIVE_TASK = ["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED"];
export const REASSIGNABLE_TASK = ["UNASSIGNED", "OPEN", "BLOCKED"];

/** Operations and platform admins supervise every step and may act when the owner is away. */
export function isSupervisor(actor: Actor) {
  return actor.roles.some((role) =>
    ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role),
  );
}

export function ledDepartmentIds(actor: Actor, kind?: string) {
  return (actor.departments ?? [])
    .filter(
      (department) =>
        department.role === "LEAD" && (!kind || department.kind === kind),
    )
    .map((department) => department.id);
}

/** RM-owned steps: the case's current RM, or an Operations supervisor. */
export function assertCaseOwner(actor: Actor, ownerId: bigint | null) {
  if (isSupervisor(actor)) return;
  if (
    actor.roles.includes("SPOC_RM") &&
    ownerId !== null &&
    ownerId === actor.userId
  )
    return;
  throw new ForbiddenException(
    "Only the case's responsible RM can take this action",
  );
}

export function assertWorkflowV2(record: { workflowVersion: number }) {
  if (record.workflowVersion !== 2)
    throw new ConflictException(
      "This case follows the earlier delivery path; use the Operations case workspace",
    );
}

export function assertStage(
  record: { intakeStage: string | null },
  allowed: readonly IntakeStage[],
  message: string,
) {
  if (!allowed.includes((record.intakeStage ?? "") as IntakeStage))
    throw new ConflictException(message);
}

export function assertVersion(current: number, expected: number) {
  if (current !== expected)
    throw new ConflictException(
      "Case changed since it was loaded; refresh and try again",
    );
}

/** New cases join the v2 flow unless INTERNAL_WORKFLOW_V2=false (rollback switch). */
export function internalWorkflowV2Enabled() {
  return (
    (process.env.INTERNAL_WORKFLOW_V2 ?? "true").trim().toLowerCase() !==
    "false"
  );
}

export function trimNote(note?: string) {
  const value = note?.trim();
  return value ? value.slice(0, 1000) : undefined;
}
