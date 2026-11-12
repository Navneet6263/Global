import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import type { UploadedBinary } from "../common/http/uploaded-binary";
import { authorizeCandidateAccess } from "../candidate-portal/candidate-access-authorizer";
import { PrismaService } from "../database/prisma.service";
import { CANDIDATE_PRIVACY_NOTICE } from "../documents/candidate-privacy-notice";
import { ContentInspectionService } from "../documents/content-inspection.service";
import { withUploadStorageLease } from "../documents/document-storage-lease";
import { computeNextDocumentVersion } from "../documents/document-version-writer";
import { assertDocumentUploadAllowed } from "../documents/documents.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import {
  assertNotDuplicateDocument,
  documentExpiry,
} from "../documents/upload-document-policy";
import {
  executeL2SubmissionTransaction,
  resolveL2TargetDocumentType,
} from "./clarification-l2-submission.helpers";

export interface SubmitL2ClarificationInput {
  message?: string;
  documentType?: string;
  expiry?: string;
  noticeVersion?: string;
}

@Injectable()
export class ClarificationL2SubmissionService {
  private readonly logger = new Logger(ClarificationL2SubmissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly inspection: ContentInspectionService,
    private readonly storage: LocalObjectStorageService,
  ) {}

  async submit(
    accessPublicId: string,
    token: string,
    clarificationPublicId: string,
    file: UploadedBinary,
    input: SubmitL2ClarificationInput,
  ) {
    if (!file) throw new BadRequestException("A corrected document is required");
    const access = await authorizeCandidateAccess(
      this.prisma,
      accessPublicId,
      token,
    );
    const consent = access.case.consents[0]?.status;
    if (consent && consent !== "ACCEPTED") {
      throw new ConflictException(
        "Confirm your consent with the one-time code before uploading",
      );
    }
    if (
      input.noticeVersion &&
      input.noticeVersion !== CANDIDATE_PRIVACY_NOTICE.version
    ) {
      throw new ConflictException(
        "Read and acknowledge the current privacy notice before uploading",
      );
    }
    const explanation = input.message?.trim() ?? "";
    if (explanation.length < 3 || explanation.length > 5000) {
      throw new BadRequestException(
        "Explanation must be between 3 and 5000 characters",
      );
    }
    assertDocumentUploadAllowed(access.case.status);

    const clarification = await this.prisma.clarification.findFirst({
      where: {
        tenantId: access.tenantId,
        caseId: access.caseId,
        publicId: clarificationPublicId,
      },
      select: {
        id: true,
        publicId: true,
        level: true,
        status: true,
        subject: true,
        checkId: true,
        requestedDocumentType: true,
      },
    });
    if (!clarification) throw new NotFoundException("Clarification not found");
    if (clarification.level !== "L2") {
      throw new ConflictException(
        "Only verification clarifications accept L2 document submissions",
      );
    }
    if (clarification.status !== "OPEN") {
      throw new ConflictException(
        "This clarification is not awaiting a candidate submission",
      );
    }

    const targetType = await resolveL2TargetDocumentType(
      this.prisma,
      access.caseId,
      clarification.checkId,
      clarification.requestedDocumentType,
      input.documentType,
    );
    const expiresAt = documentExpiry(input.expiry);
    await this.inspection.inspect(
      file,
      this.config.get<number>("UPLOAD_MAX_BYTES", 10_485_760),
      { documentType: targetType },
    );
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    await assertNotDuplicateDocument(
      this.prisma,
      access.tenantId,
      access.caseId,
      sha256,
    );

    const existingDoc = await this.prisma.document.findFirst({
      where: { tenantId: access.tenantId, caseId: access.caseId, type: targetType },
      orderBy: { createdAt: "desc" },
      select: { id: true, publicId: true, currentVersion: true },
    });
    const docUuidHint = existingDoc?.publicId ?? randomUUID();
    const versionHint = existingDoc
      ? await computeNextDocumentVersion(
          this.prisma,
          existingDoc.id,
          existingDoc.currentVersion,
        )
      : 1;
    const objectKey = `${access.tenant.publicId}/${access.case.publicId}/${docUuidHint}/v${versionHint}-${randomUUID()}`;

    return withUploadStorageLease(
      {
        prisma: this.prisma,
        storage: this.storage,
        logger: this.logger,
        tenantId: access.tenantId,
        aggregateId: clarification.publicId,
        objectKey,
        buffer: file.buffer,
      },
      (leaseId) =>
        executeL2SubmissionTransaction(this.prisma, {
          tenantId: access.tenantId,
          caseId: access.caseId,
          casePublicId: access.case.publicId,
          caseNumber: access.case.caseNumber,
          branchId: access.case.branchId,
          clientId: access.case.clientId,
          assignedOpsUserId: access.case.assignedOpsUserId,
          clarificationId: clarification.id,
          clarificationPublicId: clarification.publicId,
          subject: clarification.subject,
          docUuidHint,
          targetType,
          expiresAt,
          objectKey,
          file,
          sha256,
          explanation,
          leaseId,
        }),
    );
  }
}
