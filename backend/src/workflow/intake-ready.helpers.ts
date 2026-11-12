import { BadRequestException, ConflictException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import type { PrismaService } from "../database/prisma.service";
import { assertCaseEvidenceReady } from "../documents/evidence-readiness";
import { loadCheckDocumentStates } from "./check-document-state";
import type { MarkReadyDto } from "./dto/workflow.dto";
import { INITIATION_FORMS } from "./initiation-fields";
import {
  readableTypes,
  type IntakeCaseRecord,
} from "./intake-queue.presenter";
import type { RoutingService } from "./routing.service";
import {
  OPEN_CLARIFICATION,
  assertStage,
  assertVersion,
  assertWorkflowV2,
  trimNote,
} from "./workflow-access";

export async function executeMarkReady(
  prisma: PrismaService,
  routing: RoutingService | undefined,
  actor: Actor,
  current: IntakeCaseRecord,
  casePublicId: string,
  input: MarkReadyDto,
) {
  assertWorkflowV2(current);
  assertVersion(current.version, input.version);
  assertStage(
    current,
    ["DATA_ENTRY"],
    current.intakeStage === "CORRECTION"
      ? "Resolve the open correction request before marking Ready"
      : "This case is not with Data Entry",
  );
  const note = trimNote(input.note);
  const { states, unreviewed } = await loadCheckDocumentStates(
    prisma,
    current.id,
  );
  const open = states.filter(
    (row) => !row.check.departmentId && row.check.status !== "COMPLETED",
  );
  const held = open.filter((row) => row.state === "WAITING_CANDIDATE");
  if (held.length || current.status === "IN_PROGRESS") {
    const openRequests = await prisma.clarification.count({
      where: { caseId: current.id, status: { in: OPEN_CLARIFICATION } },
    });
    if (openRequests) {
      throw new BadRequestException(
        "Resolve every open correction request before completing",
      );
    }
    if (unreviewed.length) {
      throw new BadRequestException(
        `Accept or reject every document first: ${readableTypes(unreviewed)}`,
      );
    }
    const ready = open.filter((row) => row.state === "ACCEPTED");
    const notInitiated = ready.filter(
      (row) => !row.check.initiatedAt && INITIATION_FORMS[row.check.type],
    );
    if (notInitiated.length) {
      throw new BadRequestException(
        `Initiate every accepted check first: ${readableTypes(notInitiated.map((row) => row.check.type))}`,
      );
    }
    if (held.length && !input.processNow) {
      throw new BadRequestException(
        `${held.length === 1 ? "1 check waits" : `${held.length} checks wait`} for the candidate to upload again (${readableTypes(
          [...new Set(held.flatMap((row) => row.waiting))],
        )}). Process the accepted checks now, or wait for the candidate.`,
      );
    }
    if (!ready.length) {
      throw new BadRequestException(
        "No check is ready yet. Wait for the candidate to upload again.",
      );
    }
    if (!routing) throw new ConflictException("Routing is not available");
    const result = await routing.routeAccepted(
      actor,
      current,
      ready.map((row) => row.check),
      {
        finish: !held.length,
        waiting: held.map((row) => row.check.type),
        note,
      },
    );
    if (current.assignedOpsUserId) {
      await prisma.notification.create({
        data: {
          tenantId: actor.tenantId,
          userId: current.assignedOpsUserId,
          type: "CHECKS_ROUTED",
          title: held.length
            ? "Some checks sent to verification"
            : "Case sent to verification",
          body: held.length
            ? `${current.caseNumber}: ${ready.length} accepted check(s) went to their teams; ${readableTypes(held.map((row) => row.check.type))} wait for the candidate's documents.`
            : `${current.caseNumber}: Data Entry finished and the remaining checks went to their departments.`,
          href: `/spoc-rm/work?caseId=${casePublicId}`,
        },
      });
    }
    return result;
  }

  await prisma.$transaction(async (tx) => {
    const [openRequests, rejected] = await Promise.all([
      tx.clarification.count({
        where: { caseId: current.id, status: { in: OPEN_CLARIFICATION } },
      }),
      tx.document.count({
        where: { caseId: current.id, status: "REJECTED" },
      }),
    ]);
    if (openRequests) {
      throw new BadRequestException(
        "Resolve every open correction request before marking Ready",
      );
    }
    if (rejected) {
      throw new BadRequestException(
        "Rejected documents must be replaced before marking Ready",
      );
    }
    const notAccepted = await tx.document.findMany({
      where: {
        caseId: current.id,
        currentVersion: { gt: 0 },
        status: { notIn: ["VERIFIED", "REJECTED", "REUPLOAD_REQUIRED"] },
      },
      select: { type: true },
    });
    if (notAccepted.length) {
      throw new BadRequestException(
        `Accept every uploaded document before marking Ready: ${[
          ...new Set(notAccepted.map((doc) => doc.type)),
        ]
          .map((type) => type.replaceAll("_", " ").toLowerCase())
          .join(", ")}`,
      );
    }
    const notInitiated = await tx.caseCheck.findMany({
      where: {
        caseId: current.id,
        initiatedAt: null,
        type: { in: Object.keys(INITIATION_FORMS) },
      },
      select: { type: true },
    });
    if (notInitiated.length) {
      throw new BadRequestException(
        `Initiate every check before marking Ready: ${notInitiated
          .map((check) => check.type.replaceAll("_", " ").toLowerCase())
          .join(", ")}`,
      );
    }
    await assertCaseEvidenceReady(tx, current.id, { includeWork: false });
    const updated = await tx.verificationCase.updateMany({
      where: {
        id: current.id,
        version: input.version,
        intakeStage: "DATA_ENTRY",
      },
      data: {
        intakeStage: "READY",
        dataEntryReadyAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        "Case changed since it was loaded; refresh and try again",
      );
    }
    await tx.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "case.data-entry-ready",
        resourceType: "case",
        resourcePublicId: casePublicId,
        beforeJson: JSON.stringify({
          intakeStage: "DATA_ENTRY",
          version: current.version,
        }),
        afterJson: JSON.stringify({
          caseNumber: current.caseNumber,
          intakeStage: "READY",
          note,
        }),
      },
    });
  });

  const auto = routing
    ? await routing.autoRoute(actor, casePublicId)
    : ({ routed: false, reason: "" } as const);
  if (current.assignedOpsUserId) {
    const rm = current.assignedOpsUserId;
    await prisma.$transaction((tx) =>
      tx.notification.create({
        data: auto.routed
          ? {
              tenantId: actor.tenantId,
              userId: rm,
              type: "CHECKS_ROUTED",
              title: "Case sent to verification",
              body: `${current.caseNumber}: Data Entry finished and its checks went to their departments.`,
              href: `/spoc-rm/work?caseId=${casePublicId}`,
            }
          : {
              tenantId: actor.tenantId,
              userId: rm,
              type: "DATA_ENTRY_READY",
              title: "Case ready for routing",
              body: `${current.caseNumber}: Data Entry marked the case Ready. Route its checks to verification.${auto.reason ? ` ${auto.reason}.` : ""}`,
              href: `/spoc-rm/work?caseId=${casePublicId}`,
            },
      }),
    );
  }
  if (auto.routed) {
    return {
      id: casePublicId,
      intakeStage: auto.intakeStage,
      status: auto.status,
      version: auto.version,
      routed: true,
    };
  }
  return {
    id: casePublicId,
    intakeStage: "READY",
    version: current.version + 1,
    routed: false,
    routeNote: auto.reason || undefined,
  };
}
