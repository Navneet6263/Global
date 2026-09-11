import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { activeOperationsRecipients } from "../common/persistence/operations-recipients";
import { requiredDocumentTypes } from "../documents/evidence-readiness";

export function reminderTypes(
  input: {
    dueAt: Date | null;
    clarificationDueDates: Array<Date | null>;
    documents: Array<{
      type: string;
      currentVersion: number;
      expiresAt: Date | null;
    }>;
    requiredTypes: string[];
    createdAt: Date;
    sourceDueDates?: Array<Date | null>;
    sourceFollowUpDates?: Array<Date | null>;
  },
  now = new Date(),
) {
  const notices: Array<{ type: string; title: string }> = [];
  if (input.dueAt && input.dueAt < now)
    notices.push({
      type: "CASE_SLA_OVERDUE",
      title: "Case turnaround deadline exceeded",
    });
  if (input.clarificationDueDates.some((date) => date && date < now))
    notices.push({
      type: "CLARIFICATION_OVERDUE",
      title: "Clarification response is overdue",
    });
  if (input.sourceDueDates?.some((date) => date && date < now))
    notices.push({
      type: "SOURCE_RESPONSE_OVERDUE",
      title: "Verification source response is overdue",
    });
  if (input.sourceFollowUpDates?.some((date) => date && date <= now))
    notices.push({
      type: "SOURCE_CONTACT_DUE",
      title: "Scheduled source follow-up is due",
    });
  if (
    input.documents.some(
      (doc) =>
        doc.expiresAt &&
        doc.expiresAt <= new Date(now.getTime() + 30 * 86_400_000),
    )
  ) {
    notices.push({
      type: "DOCUMENT_EXPIRY",
      title: "Document expired or expiring within 30 days",
    });
  }
  if (
    now.getTime() - input.createdAt.getTime() > 86_400_000 &&
    input.requiredTypes.some(
      (type) =>
        !input.documents.some(
          (doc) => doc.type === type && doc.currentVersion > 0,
        ),
    )
  ) {
    notices.push({
      type: "DOCUMENTS_MISSING",
      title: "Required candidate documents are missing",
    });
  }
  return notices;
}

@Injectable()
export class WorkflowReminderService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(WorkflowReminderService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private cursor = 0n;
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (
      !this.config.get<boolean>("OUTBOX_WORKER_ENABLED", true) ||
      !["all", "worker"].includes(
        this.config.get<string>("PROCESS_ROLE", "all"),
      )
    )
      return;
    this.timer = setInterval(() => void this.run(), 15 * 60_000);
    this.timer.unref();
    void this.run();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const records = await this.prisma.verificationCase.findMany({
        where: {
          id: { gt: this.cursor },
          status: {
            in: [
              "CONSENT_PENDING",
              "DOCUMENT_PENDING",
              "IN_PROGRESS",
              "CLARIFICATION_PENDING",
            ],
          },
        },
        orderBy: { id: "asc" },
        take: 200,
        select: {
          id: true,
          publicId: true,
          caseNumber: true,
          tenantId: true,
          branchId: true,
          clientId: true,
          assignedOpsUserId: true,
          dueAt: true,
          createdAt: true,
          services: { select: { requiredDocumentsJson: true } },
          documents: {
            select: { type: true, currentVersion: true, expiresAt: true },
          },
          clarifications: {
            where: { status: "OPEN" },
            select: { dueAt: true },
          },
          checks: {
            select: {
              methodRuns: {
                where: { status: "REQUESTED" },
                select: { dueAt: true, nextFollowUpAt: true },
              },
            },
          },
        },
      });
      this.cursor =
        records.length === 200 ? records[records.length - 1]!.id : 0n;
      for (const record of records) {
        const requiredTypes = record.services.length
          ? [
              ...new Set(
                record.services.flatMap((service) =>
                  requiredDocumentTypes(service.requiredDocumentsJson),
                ),
              ),
            ]
          : [];
        const notices = reminderTypes(
          {
            ...record,
            requiredTypes,
            sourceDueDates: record.checks.flatMap((check) =>
              check.methodRuns.map((run) => run.dueAt),
            ),
            sourceFollowUpDates: record.checks.flatMap((check) =>
              check.methodRuns.map((run) => run.nextFollowUpAt),
            ),
            clarificationDueDates: record.clarifications.map(
              (item) => item.dueAt,
            ),
          },
          now,
        );
        if (!notices.length) continue;
        const operations = await activeOperationsRecipients(this.prisma, {
          tenantId: record.tenantId,
          clientId: record.clientId,
          branchId: record.branchId,
          assignedUserId: record.assignedOpsUserId,
        });
        const clients = await this.prisma.user.findMany({
          where: {
            tenantId: record.tenantId,
            clientId: record.clientId,
            status: "ACTIVE",
            ...(record.branchId
              ? { OR: [{ branchId: record.branchId }, { branchId: null }] }
              : { branchId: null }),
            userRoles: { some: { role: { code: "CLIENT_ADMIN" } } },
          },
          select: { id: true },
        });
        const users = [
          ...new Set([...operations, ...clients].map((user) => user.id)),
        ];
        for (const notice of notices)
          await this.prisma.$transaction(async (tx) => {
            const lock = `workflow-notice:${record.publicId}:${notice.type}`;
            const result = await tx.$queryRaw<Array<{ result: number }>>`
            DECLARE @result int;
            EXEC @result = sp_getapplock @Resource = ${lock}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 0;
            SELECT @result AS result;
          `;
            if ((result[0]?.result ?? -1) < 0) return;
            const since = new Date(now.getTime() - 24 * 60 * 60_000);
            const href = `/cases/${record.publicId}`;
            const existing = await tx.notification.findMany({
              where: {
                tenantId: record.tenantId,
                type: notice.type,
                href,
                createdAt: { gte: since },
              },
              select: { userId: true },
            });
            const sent = new Set(existing.map((item) => item.userId));
            const data = users
              .filter((userId) => !sent.has(userId))
              .map((userId) => ({
                tenantId: record.tenantId,
                userId,
                type: notice.type,
                title: notice.title,
                body: `${record.caseNumber}: review the case and record the next action.`,
                href,
              }));
            if (data.length) await tx.notification.createMany({ data });
          });
      }
    } catch (error) {
      this.logger.error(
        error instanceof Error
          ? error.message
          : "Workflow reminder scan failed",
      );
    } finally {
      this.running = false;
    }
  }
}
