import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Actor } from "../common/auth/actor";
import { SecretBoxService } from "../common/security/secret-box.service";
import { SubjectPiiService } from "../common/security/subject-pii.service";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { QaReadinessService } from "../verification/qa-readiness.service";
import { cleanInitiation } from "../workflow/initiation-fields";
import { executeL2CompleteReentry } from "./clarification-l2-complete.helpers";
import {
  assertDataEntryClarificationAccess,
  formatReentryItem,
  loadReentryCheckMap,
  reentryCaseWhere,
} from "./clarification-l2-reentry.helpers";
import { executeL2DocumentRejection } from "./clarification-l2-reject.helpers";
import type {
  CompleteL2ReentryDto,
  ReentryQueueQueryDto,
  RejectL2DocumentDto,
} from "./dto/l2-clarification.dto";

const REENTRY_ITEM_SELECT = {
  publicId: true,
  status: true,
  level: true,
  subject: true,
  caseId: true,
  checkId: true,
  requestedDocumentType: true,
  submittedDocumentVersion: true,
  opsReviewedAt: true,
  opsReviewNote: true,
  rejectionCount: true,
  lastRejectedAt: true,
  lastRejectedReason: true,
  dueAt: true,
  createdAt: true,
  updatedAt: true,
  case: {
    select: {
      publicId: true,
      caseNumber: true,
      status: true,
      workflowVersion: true,
      intakeStage: true,
      branchId: true,
      clientId: true,
      dataEntryUserId: true,
      subject: { select: { publicId: true, fullName: true } },
      client: { select: { publicId: true, displayName: true } },
    },
  },
  submittedDocument: {
    select: {
      publicId: true,
      type: true,
      status: true,
      currentVersion: true,
      versions: {
        select: {
          version: true,
          originalName: true,
          contentType: true,
          sizeBytes: true,
          malwareState: true,
          reviewStatus: true,
          reviewNote: true,
          reviewedAt: true,
          createdAt: true,
        },
        orderBy: { version: "desc" },
      },
    },
  },
  messages: {
    select: { senderType: true, body: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  },
} as const;

@Injectable()
export class ClarificationL2ReentryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qaReadiness: QaReadinessService,
    @Optional() private readonly secretBox?: SecretBoxService,
    @Optional() private readonly pii?: SubjectPiiService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  private noticeDeps() {
    const webOrigin = this.config?.get<string>("WEB_ORIGIN");
    return this.secretBox && this.pii && webOrigin
      ? { secretBox: this.secretBox, pii: this.pii, webOrigin }
      : undefined;
  }

  async queue(actor: Actor, query: ReentryQueueQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.ClarificationWhereInput = {
      tenantId: actor.tenantId,
      level: "L2",
      status: "DATA_ENTRY_PENDING",
      case: reentryCaseWhere(actor),
      ...(search
        ? {
            OR: [
              { subject: { contains: search } },
              { case: { caseNumber: { contains: search } } },
              { case: { subject: { fullName: { contains: search } } } },
              { case: { client: { displayName: { contains: search } } } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.clarification.findMany({
      where,
      select: REENTRY_ITEM_SELECT,
      orderBy: [{ opsReviewedAt: "asc" }, { createdAt: "asc" }],
      take: query.limit ?? 50,
    });
    const checkIds = [
      ...new Set(
        rows.map((r) => r.checkId).filter((id): id is bigint => id != null),
      ),
    ];
    const checkMap = await loadReentryCheckMap(this.prisma, checkIds);
    const items = await Promise.all(
      rows.map((row) =>
        formatReentryItem(
          this.prisma,
          row,
          row.checkId ? checkMap.get(row.checkId) : undefined,
        ),
      ),
    );
    return { items };
  }

  async detail(actor: Actor, clarificationPublicId: string) {
    const row = await this.prisma.clarification.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: clarificationPublicId,
        level: "L2",
      },
      select: REENTRY_ITEM_SELECT,
    });
    if (!row) throw new NotFoundException("Clarification not found");
    await assertDataEntryClarificationAccess(this.prisma, actor, row.case);
    const checkMap = await loadReentryCheckMap(
      this.prisma,
      row.checkId ? [row.checkId] : [],
    );
    return formatReentryItem(
      this.prisma,
      row,
      row.checkId ? checkMap.get(row.checkId) : undefined,
    );
  }

  async rejectDocument(
    actor: Actor,
    clarificationPublicId: string,
    input: RejectL2DocumentDto,
  ) {
    const reason = input.reason.trim();
    if (reason.length < 5 || reason.length > 1000) {
      throw new BadRequestException(
        "Rejection reason must be between 5 and 1000 characters",
      );
    }
    const clarification = await this.loadActionable(
      actor,
      clarificationPublicId,
      input.documentVersion,
    );
    return executeL2DocumentRejection(
      this.prisma,
      actor,
      clarification,
      reason,
      this.noticeDeps(),
    );
  }

  async completeReentry(
    actor: Actor,
    clarificationPublicId: string,
    input: CompleteL2ReentryDto,
  ) {
    const clarification = await this.loadActionable(
      actor,
      clarificationPublicId,
      input.documentVersion,
    );
    let cleanEntries: Array<Record<string, string>> | undefined;
    if (input.entries !== undefined) {
      if (!clarification.checkId) {
        throw new BadRequestException(
          "This clarification is not attached to a specific check",
        );
      }
      const check = await this.prisma.caseCheck.findUniqueOrThrow({
        where: { id: clarification.checkId },
        select: { type: true },
      });
      cleanEntries = cleanInitiation(check.type, input.entries);
    }
    return executeL2CompleteReentry(
      this.prisma,
      this.qaReadiness,
      actor,
      clarification,
      { cleanEntries, note: input.note?.trim() },
    );
  }

  private async loadActionable(
    actor: Actor,
    clarificationPublicId: string,
    expectedVersion?: number,
  ) {
    const row = await this.prisma.clarification.findFirst({
      where: { tenantId: actor.tenantId, publicId: clarificationPublicId },
      select: {
        id: true,
        publicId: true,
        level: true,
        status: true,
        subject: true,
        checkId: true,
        raisedById: true,
        opsReviewedById: true,
        rejectionCount: true,
        submittedDocumentVersion: true,
        submittedDocument: {
          select: {
            id: true,
            publicId: true,
            type: true,
            status: true,
            currentVersion: true,
          },
        },
        case: {
          select: {
            id: true,
            publicId: true,
            status: true,
            caseNumber: true,
            branchId: true,
            clientId: true,
            workflowVersion: true,
            intakeStage: true,
            dataEntryUserId: true,
            assignedOpsUserId: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException("Clarification not found");
    await assertDataEntryClarificationAccess(this.prisma, actor, row.case);
    if (row.level !== "L2") {
      throw new ConflictException(
        "Only L2 clarifications use the Data Entry re-entry workflow",
      );
    }
    if (row.status !== "DATA_ENTRY_PENDING") {
      throw new ConflictException(
        "Clarification is not awaiting Data Entry review",
      );
    }
    if (!row.submittedDocument || row.submittedDocumentVersion == null) {
      throw new ConflictException(
        "Submitted document version is missing on this clarification",
      );
    }
    if (
      expectedVersion !== undefined &&
      expectedVersion !== row.submittedDocumentVersion
    ) {
      throw new ConflictException(
        "Submitted document version changed; refresh and inspect the latest version",
      );
    }
    return row;
  }
}
