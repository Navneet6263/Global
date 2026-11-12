import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { notifyClarificationStakeholders } from "../common/persistence/clarification-recipients";
import { SecretBoxService } from "../common/security/secret-box.service";
import { SubjectPiiService } from "../common/security/subject-pii.service";
import { PrismaService } from "../database/prisma.service";
import { lockMutableCaseEvidence } from "../documents/upload-document-policy";
import { QaReadinessService } from "../verification/qa-readiness.service";
import { resumeCaseAfterClarifications } from "./clarification-case-resume.helpers";
import { createClarificationRecord } from "./clarification-create.helpers";
import {
  getPublicClarification,
  respondToPublicClarification,
} from "./clarification-public-response.helpers";
import { listCaseClarifications } from "./clarification-read.helpers";
import { requestClarificationReverification } from "./clarification-reverification";
import { ClarificationTokenService } from "./clarification-token.service";
import type { CreateClarificationDto } from "./dto/create-clarification.dto";

@Injectable()
export class ClarificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: ClarificationTokenService,
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

  listForCase(actor: Actor, casePublicId: string) {
    return listCaseClarifications(this.prisma, actor, casePublicId);
  }

  async create(
    actor: Actor,
    casePublicId: string,
    input: CreateClarificationDto,
  ) {
    const verificationCase = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId: casePublicId },
      select: {
        id: true,
        publicId: true,
        caseNumber: true,
        branchId: true,
        clientId: true,
        assignedOpsUserId: true,
        status: true,
        workflowVersion: true,
        intakeStage: true,
        dataEntryUserId: true,
      },
    });
    if (!verificationCase) throw new NotFoundException("Case not found");
    if (["DRAFT", "CONSENT_PENDING"].includes(verificationCase.status)) {
      throw new ConflictException(
        "Wait for candidate consent before raising a clarification or insufficiency",
      );
    }
    const level: "L1" | "L2" =
      verificationCase.status === "DOCUMENT_PENDING" ? "L1" : "L2";
    const intakeCorrection =
      verificationCase.workflowVersion === 2 &&
      level === "L1" &&
      ["DATA_ENTRY", "CORRECTION"].includes(verificationCase.intakeStage ?? "");
    if (
      actor.roles.includes("DATA_ENTRY") &&
      !actor.roles.some((role) =>
        ["PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM"].includes(role),
      ) &&
      !intakeCorrection
    ) {
      throw new ConflictException(
        "Data Entry can raise insufficiency only while the case is under Data Entry review",
      );
    }
    if (
      [
        "MANAGER_REVIEW",
        "REPORT_PENDING",
        "PAYMENT_PENDING",
        "COMPLETED",
        "CLOSED",
        "CANCELLED",
      ].includes(verificationCase.status)
    ) {
      throw new ConflictException(
        "A completed or cancelled case cannot receive a clarification",
      );
    }
    const check = input.checkId
      ? await this.prisma.caseCheck.findFirst({
          where: {
            tenantId: actor.tenantId,
            publicId: input.checkId,
            caseId: verificationCase.id,
          },
          select: { id: true, type: true, reviewCycle: true },
        })
      : null;
    if (input.checkId && !check)
      throw new NotFoundException("Check not found in this case");

    return createClarificationRecord(
      this.prisma,
      actor,
      verificationCase,
      check,
      input,
      { level, intakeCorrection, noticeDeps: this.noticeDeps() },
    );
  }

  getPublic(publicId: string, token: string) {
    return getPublicClarification(this.tokens, publicId, token);
  }

  respond(publicId: string, token: string, body: string) {
    return respondToPublicClarification(
      this.prisma,
      this.tokens,
      publicId,
      token,
      body,
    );
  }

  async resolve(
    actor: Actor,
    casePublicId: string,
    clarificationPublicId: string,
    note?: string,
  ) {
    const clarification = await this.prisma.clarification.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: clarificationPublicId,
        case: { ...caseAccessScope(actor), publicId: casePublicId },
      },
      select: {
        id: true,
        status: true,
        level: true,
        subject: true,
        checkId: true,
        raisedById: true,
        requestedDocumentType: true,
        submittedDocumentId: true,
        submittedDocumentVersion: true,
        reverificationRequired: true,
        case: {
          select: {
            id: true,
            publicId: true,
            status: true,
            branchId: true,
            clientId: true,
            assignedOpsUserId: true,
            caseNumber: true,
            workflowVersion: true,
            intakeStage: true,
            dataEntryUserId: true,
          },
        },
      },
    });
    if (!clarification) throw new NotFoundException("Clarification not found");
    if (
      clarification.status === "CANDIDATE_SUBMITTED" ||
      clarification.status === "DATA_ENTRY_PENDING" ||
      (clarification.level === "L2" &&
        (clarification.requestedDocumentType != null ||
          clarification.submittedDocumentId != null ||
          clarification.submittedDocumentVersion != null))
    ) {
      throw new ConflictException(
        "L2 insufficiency clarifications require Operations review and Data Entry re-entry before resolution",
      );
    }
    if (clarification.status === "RESOLVED") {
      return {
        id: clarificationPublicId,
        status: "RESOLVED",
        caseStatus: clarification.case.status,
      };
    }
    if (clarification.status !== "RESPONDED") {
      throw new BadRequestException(
        "A candidate response must be reviewed before resolution",
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await lockMutableCaseEvidence(tx, clarification.case.id, true);
      const updated = await tx.clarification.updateMany({
        where: { id: clarification.id, status: "RESPONDED" },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          responseTokenHash: null,
          responseTokenExpiresAt: null,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          "Clarification changed; refresh and try again",
        );
      }
      if (note?.trim()) {
        await tx.clarificationMessage.create({
          data: {
            clarificationId: clarification.id,
            senderUserId: actor.userId,
            senderType: "TEAM",
            body: note.trim(),
          },
        });
      }
      if (clarification.reverificationRequired) {
        await requestClarificationReverification(tx, actor, {
          caseId: clarification.case.id,
          checkId: clarification.checkId,
          subject: clarification.subject,
        });
      }
      const { caseStatus } = await resumeCaseAfterClarifications(
        tx,
        this.qaReadiness,
        {
          tenantId: actor.tenantId,
          caseId: clarification.case.id,
          casePublicId: clarification.case.publicId,
          caseStatus: clarification.case.status,
          caseNumber: clarification.case.caseNumber,
          branchId: clarification.case.branchId,
          clientId: clarification.case.clientId,
          workflowVersion: clarification.case.workflowVersion,
          intakeStage: clarification.case.intakeStage,
          dataEntryUserId: clarification.case.dataEntryUserId,
          changedById: actor.userId,
          reason: "All candidate clarifications reviewed and resolved",
        },
      );
      await notifyClarificationStakeholders(tx, {
        tenantId: actor.tenantId,
        branchId: clarification.case.branchId,
        clientId: clarification.case.clientId,
        assignedUserId: clarification.case.assignedOpsUserId,
        raisedById: clarification.raisedById,
        excludeUserId: actor.userId,
        type: "CLARIFICATION_RESOLVED",
        title: "Clarification resolved",
        body: `${clarification.case.caseNumber}: ${clarification.subject} resolved by ${actor.displayName}.`,
        opsHref: "/operations/clarifications",
        rmHref: "/spoc-rm/work?bucket=correction",
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "clarification.resolved",
          resourceType: "clarification",
          resourcePublicId: clarificationPublicId,
          beforeJson: JSON.stringify({ status: clarification.status }),
          afterJson: JSON.stringify({
            status: "RESOLVED",
            actorRoles: actor.roles,
            caseStatus,
          }),
        },
      });
      return { id: clarificationPublicId, status: "RESOLVED", caseStatus };
    });
  }
}
