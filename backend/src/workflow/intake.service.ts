import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException, Optional,
} from "@nestjs/common";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { loadCheckDocumentStates } from "./check-document-state";
import type {
  AssignDataEntryDto, InitiateCheckDto, MarkReadyDto,
  RmQueueQueryDto, SendBackDto, WorkQueueQueryDto,
} from "./dto/workflow.dto";
import { INITIATION_FORMS, cleanInitiation } from "./initiation-fields";
import { executeAssignDataEntry } from "./intake-assign.helpers";
import { intakeSelect, readableTypes, searchWhere } from "./intake-queue.presenter";
import { executeMarkReady } from "./intake-ready.helpers";
import { pageQueueCases, queryRmQueue } from "./intake-rm-queue.helpers";
import { RoutingService } from "./routing.service";
import {
  assertCaseOwner, assertStage, assertVersion,
  assertWorkflowV2, isSupervisor, ledDepartmentIds,
} from "./workflow-access";

export {
  PRE_CONSENT_STATUSES, RM_BUCKETS, RM_ELIGIBLE_CASE_WHERE,
  RM_EXCLUDED_STATUSES, presentQueueCase, queueCaseSelect,
  rmEligibleWhere, searchWhere,
} from "./intake-queue.presenter";

@Injectable()
export class IntakeService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly routing?: RoutingService,
  ) {}

  /** RM (or its Data Entry lead, or Operations) hands the case to a Data Entry user. */
  async assignDataEntry(
    actor: Actor,
    casePublicId: string,
    input: AssignDataEntryDto,
  ) {
    const current = await this.findCase(actor, casePublicId);
    return executeAssignDataEntry(
      this.prisma,
      actor,
      current,
      casePublicId,
      input,
    );
  }

  /** Check-wise initiation forms, so the screen and the validation never drift apart. */
  initiationForms() {
    return { forms: INITIATION_FORMS };
  }

  /**
   * Data Entry records a check's initiation details (address, employer, institute, court
   * years, ID number...). Audited without the personal values themselves.
   */
  async initiateCheck(
    actor: Actor,
    casePublicId: string,
    checkPublicId: string,
    input: InitiateCheckDto,
  ) {
    const current = await this.findCase(actor, casePublicId);
    assertWorkflowV2(current);
    this.assertDataEntryActor(actor, current);
    assertStage(
      current,
      ["DATA_ENTRY", "CORRECTION"],
      "Checks are initiated while the case is with Data Entry",
    );
    const check = await this.prisma.caseCheck.findFirst({
      where: { caseId: current.id, publicId: checkPublicId },
      select: { id: true, type: true, initiatedAt: true, departmentId: true },
    });
    if (!check) throw new NotFoundException("Check not found in this case");
    if (check.departmentId)
      throw new ConflictException("This check was already sent to its team");
    const { states } = await loadCheckDocumentStates(this.prisma, current.id);
    const own = states.find((row) => row.check.publicId === checkPublicId);
    if (own?.state === "TO_REVIEW")
      throw new BadRequestException(
        `Accept this check's documents first: ${readableTypes(own.toReview)}`,
      );
    if (own?.state === "WAITING_CANDIDATE")
      throw new BadRequestException(
        `This check waits for the candidate to upload again: ${readableTypes(own.waiting)}`,
      );
    const entries = cleanInitiation(check.type, input.entries);
    const initiatedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.caseCheck.update({
        where: { id: check.id },
        data: {
          initiationJson: JSON.stringify({ entries }),
          initiatedAt,
          initiatedById: actor.userId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: check.initiatedAt
            ? "check.initiation-updated"
            : "check.initiated",
          resourceType: "check",
          resourcePublicId: checkPublicId,
          afterJson: JSON.stringify({
            caseNumber: current.caseNumber,
            checkType: check.type,
            entries: entries.length,
            fields: [
              ...new Set(entries.flatMap((entry) => Object.keys(entry))),
            ],
          }),
        },
      });
    });
    return { id: checkPublicId, initiatedAt, entries };
  }

  /** Data Entry confirms completeness; the case returns to the RM, never to Operations. */
  async markReady(actor: Actor, casePublicId: string, input: MarkReadyDto) {
    const current = await this.findCase(actor, casePublicId);
    this.assertDataEntryActor(actor, current);
    return executeMarkReady(
      this.prisma,
      this.routing,
      actor,
      current,
      casePublicId,
      input,
    );
  }

  /** RM returns a Ready case to Data Entry with a reason. */
  async sendBack(actor: Actor, casePublicId: string, input: SendBackDto) {
    const current = await this.findCase(actor, casePublicId);
    assertWorkflowV2(current);
    assertVersion(current.version, input.version);
    assertCaseOwner(actor, current.assignedOpsUserId);
    assertStage(
      current,
      ["READY"],
      "Only a Ready case can be sent back to Data Entry",
    );
    const reason = input.reason.trim();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.verificationCase.updateMany({
        where: { id: current.id, version: input.version, intakeStage: "READY" },
        data: {
          intakeStage: "DATA_ENTRY",
          dataEntryReadyAt: null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "Case changed since it was loaded; refresh and try again",
        );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "case.data-entry-returned",
          resourceType: "case",
          resourcePublicId: casePublicId,
          beforeJson: JSON.stringify({ intakeStage: "READY" }),
          afterJson: JSON.stringify({
            caseNumber: current.caseNumber,
            intakeStage: "DATA_ENTRY",
            reason,
          }),
        },
      });
      if (current.dataEntryUserId)
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: current.dataEntryUserId,
            type: "DATA_ENTRY_RETURNED",
            title: "Case returned by RM",
            body: `${current.caseNumber}: ${reason}`,
            href: `/data-entry?caseId=${casePublicId}`,
          },
        });
    });
    return {
      id: casePublicId,
      intakeStage: "DATA_ENTRY",
      version: current.version + 1,
    };
  }

  /** Data Entry queue: own cases; a Data Entry lead also sees its team and can reassign. */
  async dataEntryQueue(actor: Actor, query: WorkQueueQueryDto) {
    const supervisor = isSupervisor(actor);
    if (!supervisor && !actor.roles.includes("DATA_ENTRY"))
      throw new ForbiddenException(
        "Data Entry queue is for the Data Entry team",
      );
    const leads = ledDepartmentIds(actor, "DATA_ENTRY");
    const view = query.view ?? "mine";
    const scope: Prisma.VerificationCaseWhereInput =
      view === "mine" || (!leads.length && !supervisor)
        ? { dataEntryUserId: actor.userId }
        : supervisor
          ? { dataEntryUserId: { not: null } }
          : {
              dataEntryUser: {
                departmentMemberships: {
                  some: { departmentId: { in: leads } },
                },
              },
            };
    const where: Prisma.VerificationCaseWhereInput = {
      ...caseAccessScope(actor),
      workflowVersion: 2,
      intakeStage: { in: ["DATA_ENTRY", "CORRECTION"] },
      AND: [scope, ...(query.search ? [searchWhere(query.search)] : [])],
    };
    return pageQueueCases(
      this.prisma,
      where,
      query,
      [{ dueAt: "asc" }, { dataEntryAssignedAt: "asc" }, { publicId: "asc" }],
      {
        mine: {
          ...caseAccessScope(actor),
          workflowVersion: 2,
          dataEntryUserId: actor.userId,
          intakeStage: "DATA_ENTRY",
        },
        correction: {
          ...caseAccessScope(actor),
          workflowVersion: 2,
          intakeStage: "CORRECTION",
          ...(view === "mine" || (!leads.length && !supervisor)
            ? { dataEntryUserId: actor.userId }
            : {}),
        },
      },
    );
  }

  /** RM work queue: v2 cases of mapped clients in flow order. */
  rmQueue(actor: Actor, query: RmQueueQueryDto) {
    return queryRmQueue(this.prisma, actor, query);
  }

  private assertDataEntryActor(
    actor: Actor,
    current: { dataEntryUserId: bigint | null },
  ) {
    if (isSupervisor(actor)) return;
    if (!actor.roles.includes("DATA_ENTRY"))
      throw new ForbiddenException("Only Data Entry can mark a case Ready");
    if (current.dataEntryUserId === actor.userId) return;
    if (ledDepartmentIds(actor, "DATA_ENTRY").length) return;
    throw new ForbiddenException(
      "This case is assigned to another Data Entry user",
    );
  }

  private async findCase(actor: Actor, publicId: string) {
    const row = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId },
      select: intakeSelect,
    });
    if (!row) throw new NotFoundException("Case not found");
    return row;
  }
}
