import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { queueEmail } from "../common/mail/queue-email";
import { SecretBoxService } from "../common/security/secret-box.service";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { INITIATION_FORMS } from "../workflow/initiation-fields";
import { sourceRequestTemplate } from "./source-outreach.policy";
import { VerificationMethodsService } from "./verification-methods.service";
import { documentScope } from "./check-documents";

/** BGV process: Employment gets 7 automatic follow-ups, Education 3; others none. */
export const SOURCE_FOLLOW_UPS: Readonly<Record<string, number>> = {
  EMPLOYMENT: 7,
  EDUCATION: 3,
};
export const FOLLOW_UP_EVERY_MS = 24 * 3_600_000;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SourceEmailInput = {
  to: string;
  cc?: string[];
  subject: string;
  body: string;
  documentIds?: string[];
  autoFollowUp?: boolean;
};

type Attachment = { objectKey: string; filename: string; contentType: string };

const entriesOf = (json: string | null | undefined) => {
  try {
    const parsed = JSON.parse(json ?? "") as {
      entries?: Array<Record<string, string>>;
    };
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
};

function parseAttachments(json: string): Attachment[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? (parsed as Attachment[]) : [];
  } catch {
    return [];
  }
}

/**
 * Employer / university verification email (BGV process): the verifier edits to, cc,
 * subject, body and attaches case documents; automatic follow-ups go out every 24
 * hours until the source responds. Every send, follow-up and stop is audited.
 */
@Injectable()
export class SourceEmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly methods: VerificationMethodsService,
    @Optional() private readonly secretBox?: SecretBoxService,
  ) {}

  async compose(actor: Actor, checkId: string) {
    const check = await this.methods.check(actor, checkId);
    const row = await this.prisma.caseCheck.findUniqueOrThrow({
      where: { id: check.id },
      select: {
        type: true,
        initiationJson: true,
        case: {
          select: {
            subject: { select: { fullName: true } },
            documents: {
              where: {
                status: { notIn: ["REJECTED", "DELETED"] },
                ...documentScope(actor),
              },
              orderBy: { createdAt: "desc" },
              select: {
                publicId: true,
                type: true,
                versions: {
                  where: { malwareState: "CLEAN" },
                  orderBy: { version: "desc" },
                  take: 1,
                  select: {
                    originalName: true,
                    sizeBytes: true,
                    version: true,
                  },
                },
              },
            },
          },
        },
        sourceEmails: {
          orderBy: { id: "desc" },
          take: 20,
          select: {
            publicId: true,
            toEmail: true,
            ccEmails: true,
            subject: true,
            attachmentsJson: true,
            maxFollowUps: true,
            followUpsSent: true,
            lastSentAt: true,
            nextFollowUpAt: true,
            stoppedAt: true,
            stopReason: true,
            createdAt: true,
          },
        },
      },
    });
    const template = sourceRequestTemplate(row.type, check.case.caseNumber);
    const form = INITIATION_FORMS[row.type.toUpperCase()];
    const lines = entriesOf(row.initiationJson).flatMap((entry, index, all) => [
      ...(all.length > 1 ? [`Entry ${index + 1}`] : []),
      ...(form?.fields ?? [])
        .filter((field) => entry[field.key])
        .map((field) => `- ${field.label}: ${entry[field.key]}`),
    ]);
    const details = [
      `Candidate: ${row.case.subject.fullName}`,
      ...(lines.length ? ["", "Details to confirm:", ...lines] : []),
    ].join("\n");
    return {
      checkType: row.type,
      followUps: SOURCE_FOLLOW_UPS[row.type.toUpperCase()] ?? 0,
      draft: {
        subject: template.subject,
        body: template.body.replace(
          "\n\nPlease include",
          `\n\n${details}\n\nPlease include`,
        ),
      },
      documents: row.case.documents.flatMap((document) =>
        document.versions.map((version) => ({
          id: document.publicId,
          type: document.type,
          name: version.originalName,
          version: version.version,
          sizeBytes: Number(version.sizeBytes),
        })),
      ),
      items: row.sourceEmails.map((email) => ({
        id: email.publicId,
        to: email.toEmail,
        cc: email.ccEmails ? email.ccEmails.split(",") : [],
        subject: email.subject,
        attachments: parseAttachments(email.attachmentsJson).map(
          (file) => file.filename,
        ),
        maxFollowUps: email.maxFollowUps,
        followUpsSent: email.followUpsSent,
        lastSentAt: email.lastSentAt,
        nextFollowUpAt: email.nextFollowUpAt,
        stoppedAt: email.stoppedAt,
        stopReason: email.stopReason,
        createdAt: email.createdAt,
      })),
    };
  }

  async send(
    actor: Actor,
    checkId: string,
    input: SourceEmailInput,
    now = new Date(),
  ) {
    if (!this.secretBox)
      throw new ConflictException("Email delivery is not configured");
    const check = await this.methods.check(actor, checkId, true);
    if (check.status === "COMPLETED")
      throw new ConflictException("This check is already completed");
    const to = input.to.trim().toLowerCase();
    const cc = [
      ...new Set((input.cc ?? []).map((value) => value.trim().toLowerCase())),
    ].filter(Boolean);
    if (!EMAIL.test(to) || cc.some((value) => !EMAIL.test(value)))
      throw new BadRequestException("Enter valid email addresses");
    if (cc.length > 5) throw new BadRequestException("At most 5 cc addresses");
    const subject = input.subject.trim();
    const body = input.body.trim();
    if (subject.length < 5 || body.length < 20)
      throw new BadRequestException("Write a subject and a message");
    const documentIds = [...new Set(input.documentIds ?? [])];
    if (documentIds.length > MAX_ATTACHMENTS)
      throw new BadRequestException(`At most ${MAX_ATTACHMENTS} attachments`);
    const attachments = await this.attachments(
      actor,
      check.case.id,
      documentIds,
    );
    const maxFollowUps =
      input.autoFollowUp === false
        ? 0
        : (SOURCE_FOLLOW_UPS[check.type.toUpperCase()] ?? 0);
    const secretBox = this.secretBox;
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.sourceEmail.create({
        data: {
          tenantId: actor.tenantId,
          checkId: check.id,
          toEmail: to,
          ccEmails: cc.length ? cc.join(",") : null,
          subject,
          body,
          attachmentsJson: JSON.stringify(attachments),
          maxFollowUps,
          lastSentAt: now,
          nextFollowUpAt: maxFollowUps
            ? new Date(now.getTime() + FOLLOW_UP_EVERY_MS)
            : null,
          createdById: actor.userId,
        },
        select: { publicId: true, nextFollowUpAt: true },
      });
      await queueEmail(tx, secretBox, {
        tenantId: actor.tenantId,
        aggregateType: "check",
        aggregateId: checkId,
        to,
        cc,
        attachments,
        template: "source-verification",
        variables: { subject, body },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "verification.source-email-sent",
          resourceType: "case",
          resourcePublicId: check.case.publicId,
          afterJson: JSON.stringify({
            checkId,
            emailId: created.publicId,
            toDomain: to.split("@")[1],
            ccCount: cc.length,
            attachments: attachments.length,
            maxFollowUps,
          }),
        },
      });
      return {
        id: created.publicId,
        maxFollowUps,
        nextFollowUpAt: created.nextFollowUpAt,
      };
    });
  }

  async stop(actor: Actor, checkId: string, emailId: string, reason: string) {
    const check = await this.methods.check(actor, checkId, true);
    return this.prisma.$transaction(async (tx) => {
      const email = await tx.sourceEmail.findFirst({
        where: { publicId: emailId, checkId: check.id },
        select: { id: true, stoppedAt: true },
      });
      if (!email) throw new NotFoundException("Email not found");
      if (email.stoppedAt)
        throw new ConflictException("Follow-ups are already stopped");
      await stopSourceEmails(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        where: { id: email.id },
        reason: reason.trim(),
        casePublicId: check.case.publicId,
        checkId,
      });
      return { id: emailId, stopped: true };
    });
  }

  private async attachments(
    actor: Actor,
    caseId: bigint,
    documentIds: string[],
  ): Promise<Attachment[]> {
    if (!documentIds.length) return [];
    const documents = await this.prisma.document.findMany({
      where: {
        caseId,
        publicId: { in: documentIds },
        status: { notIn: ["REJECTED", "DELETED"] },
        ...documentScope(actor),
      },
      select: {
        versions: {
          where: { malwareState: "CLEAN" },
          orderBy: { version: "desc" },
          take: 1,
          select: {
            objectKey: true,
            originalName: true,
            contentType: true,
            sizeBytes: true,
          },
        },
      },
    });
    const files = documents.flatMap((document) => document.versions);
    if (files.length !== documentIds.length)
      throw new BadRequestException(
        "Attach only clean documents from this case",
      );
    if (
      files.reduce((sum, file) => sum + Number(file.sizeBytes), 0) >
      MAX_ATTACHMENT_BYTES
    )
      throw new BadRequestException("Attachments must total 10 MB or less");
    return files.map((file) => ({
      objectKey: file.objectKey,
      filename: file.originalName,
      contentType: file.contentType,
    }));
  }
}

/** Stops follow-ups (response received, details verified, or by hand) with an audit row. */
export async function stopSourceEmails(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: bigint;
    actorUserId?: bigint;
    where: Prisma.SourceEmailWhereInput;
    reason: string;
    casePublicId: string;
    checkId: string;
  },
  now = new Date(),
) {
  const stopped = await tx.sourceEmail.updateMany({
    where: { ...input.where, stoppedAt: null },
    data: {
      stoppedAt: now,
      stopReason: input.reason.slice(0, 300),
      nextFollowUpAt: null,
    },
  });
  if (stopped.count)
    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "verification.source-email-stopped",
        resourceType: "case",
        resourcePublicId: input.casePublicId,
        afterJson: JSON.stringify({
          checkId: input.checkId,
          emails: stopped.count,
          reason: input.reason.slice(0, 300),
        }),
      },
    });
  return stopped.count;
}
