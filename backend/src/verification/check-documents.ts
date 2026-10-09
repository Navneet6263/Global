import type { Actor } from "../common/auth/actor";
import type { Prisma } from "../generated/prisma/client";

/**
 * Documents each check needs (manual mapping until the package document arrives). The
 * vendor gets these by default; a verifier sees only these plus the identity documents.
 */
export const CHECK_DOCUMENTS: Readonly<Record<string, readonly string[]>> = {
  ADDRESS: ["ADDRESS_PROOF", "AADHAAR"],
  EMPLOYMENT: ["EMPLOYMENT_PROOF"],
  EDUCATION: ["EDUCATION_CERTIFICATE"],
  COURT_RECORD: ["AADHAAR", "ADDRESS_PROOF"],
  CRIMINAL: ["AADHAAR", "ADDRESS_PROOF"],
  DRUG_TEST: ["AADHAAR"],
  IDENTITY: ["AADHAAR", "PAN", "PASSPORT", "DRIVING_LICENCE"],
  PAN_VALIDATION: ["PAN"],
  REFERENCE: [],
};

/** Always visible to the verifier of any check, to match the person's name and identity. */
export const IDENTITY_DOCUMENTS: readonly string[] = ["AADHAAR", "PAN"];

/** Roles that see every document of a case they can open. */
const FULL_DOCUMENT_ROLES = [
  "PLATFORM_ADMIN",
  "OPS_MANAGER",
  "QA_REVIEWER",
  "DATA_ENTRY",
  "SPOC_RM",
  "CLIENT_ADMIN",
];

/** A verifier (or Team Leader) who sees only the documents of its own checks. */
export function hasCheckDocumentScope(actor: Actor) {
  return (
    actor.roles.includes("VERIFIER") &&
    !actor.roles.some((role) => FULL_DOCUMENT_ROLES.includes(role))
  );
}

/** Document types a verifier may see for a check type. */
export function verifierDocumentTypes(checkType: string) {
  return [
    ...new Set([
      ...(CHECK_DOCUMENTS[checkType.toUpperCase()] ?? []),
      ...IDENTITY_DOCUMENTS,
    ]),
  ];
}

/** The checks of a case that are the verifier's: assigned to it, or in a team it leads. */
function ownChecks(actor: Actor): Prisma.CaseCheckWhereInput {
  const leads = (actor.departments ?? [])
    .filter((department) => department.role === "LEAD")
    .map((department) => department.id);
  return {
    OR: [
      { tasks: { some: { assigneeId: actor.userId } } },
      ...(leads.length ? [{ departmentId: { in: leads } }] : []),
    ],
  };
}

/**
 * Prisma filter for `document` rows: unrestricted for full-document roles; for a verifier,
 * only types mapped to one of its checks in that case, plus the identity documents.
 */
export function documentScope(actor: Actor): Prisma.DocumentWhereInput {
  if (!hasCheckDocumentScope(actor)) return {};
  const mine = ownChecks(actor);
  return {
    OR: [
      {
        type: { in: [...IDENTITY_DOCUMENTS] },
        case: { checks: { some: mine } },
      },
      ...Object.entries(CHECK_DOCUMENTS)
        .filter(([, types]) => types.length)
        .map(([checkType, types]) => ({
          type: { in: [...types] },
          case: { checks: { some: { AND: [{ type: checkType }, mine] } } },
        })),
    ],
  };
}

/** Same rule for documents already loaded with their case's checks (in memory). */
export function visibleDocumentTypes(
  actor: Actor,
  checks: ReadonlyArray<{
    type: string;
    departmentId?: bigint | null;
    tasks?: ReadonlyArray<{ assigneeId: bigint | null }>;
  }>,
): ReadonlySet<string> | null {
  if (!hasCheckDocumentScope(actor)) return null;
  const leads = (actor.departments ?? [])
    .filter((department) => department.role === "LEAD")
    .map((department) => department.id);
  const mine = checks.filter(
    (check) =>
      (check.departmentId != null && leads.includes(check.departmentId)) ||
      (check.tasks ?? []).some((task) => task.assigneeId === actor.userId),
  );
  return new Set(mine.flatMap((check) => verifierDocumentTypes(check.type)));
}
