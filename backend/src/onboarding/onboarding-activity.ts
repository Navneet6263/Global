import type { Prisma } from "../generated/prisma/client";
import type { PrismaService } from "../database/prisma.service";
import { ONBOARDING_DOCUMENTS } from "./onboarding-checklist";

/** Activity filters shown to Operations, the RM and the Platform Admin. */
export const ACTIVITY_KINDS = {
  DOCUMENTS: [
    "client.agreement-file.uploaded",
    "client.agreement-file.reviewed",
    "client.agreement-file.downloaded",
  ],
  PRICING: ["client.commercial.updated", "client-pricing.discount-set"],
  PEOPLE: [
    "client.primary-rm-assigned",
    "client.primary-rm-removed",
    "client.onboarding.message",
  ],
  DECISIONS: [
    "client.self-signup",
    "client.onboarding.details-updated",
    "client.onboarding.submitted",
    "client.onboarding.activated",
    "client.onboarding.rejected",
  ],
} as const;

export type ActivityKind = keyof typeof ACTIVITY_KINDS;

const kindOf = (action: string): ActivityKind | "OTHER" =>
  (Object.keys(ACTIVITY_KINDS) as ActivityKind[]).find((kind) =>
    (ACTIVITY_KINDS[kind] as readonly string[]).includes(action),
  ) ?? "OTHER";

function parse(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

const text = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

/**
 * One page of a company's activity. Each entry carries a short, allow-listed detail
 * (document name, decision, package, discount, RM) — never raw audit JSON.
 */
export async function companyActivity(
  prisma: PrismaService,
  input: {
    tenantId: bigint;
    clientPublicId: string;
    page: number;
    pageSize: number;
    kind?: ActivityKind;
  },
) {
  const where: Prisma.AuditEventWhereInput = {
    tenantId: input.tenantId,
    resourceType: "client",
    resourcePublicId: input.clientPublicId,
    ...(input.kind ? { action: { in: [...ACTIVITY_KINDS[input.kind]] } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true,
        action: true,
        createdAt: true,
        afterJson: true,
        actor: {
          select: {
            displayName: true,
            userRoles: { select: { role: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.auditEvent.count({ where }),
  ]);
  const after = rows.map((row) => parse(row.afterJson));
  const agreementIds = [
    ...new Set(after.map((data) => text(data.agreementId)).filter(Boolean)),
  ];
  const packageIds = [
    ...new Set(
      after.flatMap((data) => [
        text(data.packageId),
        ...(Array.isArray(data.packageIds) ? data.packageIds.map(text) : []),
      ]),
    ),
  ].filter(Boolean);
  const [agreements, packages] = await Promise.all([
    agreementIds.length
      ? prisma.clientAgreement.findMany({
          where: { publicId: { in: agreementIds } },
          select: { publicId: true, type: true },
        })
      : [],
    packageIds.length
      ? prisma.servicePackage.findMany({
          where: { tenantId: input.tenantId, publicId: { in: packageIds } },
          select: { publicId: true, name: true },
        })
      : [],
  ]);
  const docLabel = (agreementId: string) => {
    const type = agreements.find((row) => row.publicId === agreementId)?.type;
    return (
      ONBOARDING_DOCUMENTS.find((doc) => doc.type === type)?.label ??
      type?.replaceAll("_", " ").toLowerCase() ??
      "Document"
    );
  };
  const packageName = (id: string) =>
    packages.find((row) => row.publicId === id)?.name ?? "a package";

  const detailOf = (action: string, data: Record<string, unknown>) => {
    switch (action) {
      case "client.agreement-file.uploaded":
        return `${docLabel(text(data.agreementId))}${
          Number(data.revision) > 1 ? ` · version ${text(data.revision)}` : ""
        }`;
      case "client.agreement-file.reviewed":
        return `${docLabel(text(data.agreementId))} · ${
          data.status === "APPROVED" ? "approved" : "sent back"
        }${data.status !== "APPROVED" && text(data.notes) ? `: ${text(data.notes)}` : ""}`;
      case "client.agreement-file.downloaded":
        return docLabel(text(data.agreementId));
      case "client.commercial.updated":
        return Array.isArray(data.packageIds) && data.packageIds.length
          ? data.packageIds.map((id) => packageName(text(id))).join(", ")
          : "";
      case "client-pricing.discount-set":
        return `${packageName(text(data.packageId))} · ${text(data.discountPercent)}% discount${
          text(data.note) ? ` · ${text(data.note)}` : ""
        }`;
      case "client.primary-rm-assigned":
        return text(data.primaryRmName);
      case "client.onboarding.message":
        return text(data.message).slice(0, 160);
      case "client.onboarding.rejected":
        return text(data.reason);
      case "client.onboarding.submitted":
      case "client.onboarding.activated":
        return text(data.note);
      default:
        return "";
    }
  };

  return {
    items: rows.map((row, index) => ({
      id: row.id.toString(),
      action: row.action,
      kind: kindOf(row.action),
      at: row.createdAt,
      by: row.actor?.displayName ?? "System",
      byRole: row.actor?.userRoles[0]?.role.name ?? null,
      detail: detailOf(row.action, after[index]!) || null,
      outcome:
        row.action === "client.agreement-file.reviewed"
          ? after[index]!.status === "APPROVED"
            ? "good"
            : "bad"
          : row.action === "client.onboarding.activated"
            ? "good"
            : row.action === "client.onboarding.rejected"
              ? "bad"
              : null,
    })),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}
