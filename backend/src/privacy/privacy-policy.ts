import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";

export const privacyKinds = ["DATA_REQUEST", "INCIDENT"] as const;
export const privacyStatuses = [
  "RECEIVED",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "FULFILLED",
  "OPEN",
  "INVESTIGATING",
  "CONTAINED",
  "CLOSED",
] as const;
export const requestTypes = [
  "ACCESS",
  "CORRECTION",
  "ERASURE",
  "OTHER",
] as const;
export const incidentSeverities = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

export const privacyTrackingNotice =
  "Recorded human decisions only. This desk does not erase data, withdraw consent, notify regulators or certify legal compliance.";

export function assertPrivacyAdmin(actor: Actor) {
  if (!actor.roles.includes("PLATFORM_ADMIN"))
    throw new ForbiddenException(
      "Only platform administrators can access privacy records",
    );
}

export function privacyText(
  value: string,
  label: string,
  min: number,
  max: number,
) {
  const text = value.trim();
  if (text.length < min || text.length > max)
    throw new BadRequestException(
      `${label} must contain ${min}–${max} characters`,
    );
  return text;
}

export function privacyTransition(
  kind: string,
  from: string,
  to: string,
  note: string,
  evidenceReference?: string,
) {
  const paths: Record<string, Record<string, string[]>> = {
    DATA_REQUEST: {
      RECEIVED: ["IN_REVIEW"],
      IN_REVIEW: ["APPROVED", "REJECTED"],
      APPROVED: ["FULFILLED"],
      REJECTED: [],
      FULFILLED: [],
    },
    INCIDENT: {
      OPEN: ["INVESTIGATING"],
      INVESTIGATING: ["CONTAINED"],
      CONTAINED: ["INVESTIGATING", "CLOSED"],
      CLOSED: [],
    },
  };
  if (!(paths[kind]?.[from] ?? []).includes(to))
    throw new ConflictException(
      `Privacy record cannot move from ${from} to ${to}`,
    );
  const rationale = privacyText(note, "Decision rationale", 10, 2000);
  const reference = evidenceReference?.trim()
    ? privacyText(evidenceReference, "Evidence reference", 3, 300)
    : undefined;
  if (["FULFILLED", "CLOSED"].includes(to) && !reference)
    throw new BadRequestException(
      "Record an evidence reference before marking this work complete",
    );
  return { rationale, reference };
}
