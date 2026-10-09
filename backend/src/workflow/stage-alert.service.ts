import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from "@nestjs/common";
import { queueEmail } from "../common/mail/queue-email";
import { SecretBoxService } from "../common/security/secret-box.service";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import {
  STAGE_LABELS,
  calendarFromEnv,
  dueAlerts,
  waitingStage,
  workingMinutesBetween,
  type AlertLevel,
  type WaitingStage,
} from "./stage-alerts";

/**
 * Every 15 minutes: finds internal steps waiting beyond 6 / 8 working hours and alerts the
 * people responsible, once per step and level. Each alert is recorded in the audit trail.
 */
@Injectable()
export class StageAlertService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(StageAlertService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private cursor = 0n;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly secretBox?: SecretBoxService,
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

  async run(now = new Date()) {
    if (this.running) return 0;
    this.running = true;
    let sent = 0;
    try {
      const calendar = calendarFromEnv(
        process.env.WORKING_DAYS,
        process.env.WORKING_HOURS,
      );
      const records = await this.prisma.verificationCase.findMany({
        where: {
          id: { gt: this.cursor },
          status: {
            in: ["DOCUMENT_PENDING", "IN_PROGRESS", "CLARIFICATION_PENDING"],
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
          status: true,
          workflowVersion: true,
          intakeStage: true,
          assignedOpsUserId: true,
          dataEntryUserId: true,
          dataEntryAssignedAt: true,
          dataEntryReadyAt: true,
          createdAt: true,
          statusHistory: {
            where: { toStatus: "DOCUMENT_PENDING" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
          checks: {
            where: {
              departmentId: { not: null },
              tasks: { some: { status: "UNASSIGNED" } },
            },
            orderBy: { routedAt: "asc" },
            select: { routedAt: true, departmentId: true },
          },
        },
      });
      this.cursor =
        records.length === 200 ? records[records.length - 1]!.id : 0n;
      for (const record of records) {
        const waiting = waitingStage({
          ...record,
          documentPendingSince: record.statusHistory[0]?.createdAt ?? null,
          oldestUnassignedRoutedAt:
            record.checks.find((check) => check.routedAt)?.routedAt ?? null,
        });
        if (!waiting) continue;
        for (const level of dueAlerts(waiting.since, now, calendar))
          sent += await this.alert(
            record,
            waiting.stage,
            waiting.since,
            level,
            now,
            calendar,
          );
      }
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : "Stage alert scan failed",
      );
    } finally {
      this.running = false;
    }
    return sent;
  }

  private async alert(
    record: {
      id: bigint;
      publicId: string;
      caseNumber: string;
      tenantId: bigint;
      branchId: bigint | null;
      assignedOpsUserId: bigint | null;
      dataEntryUserId: bigint | null;
      checks: Array<{ departmentId: bigint | null }>;
    },
    stage: WaitingStage,
    since: Date,
    level: AlertLevel,
    now: Date,
    calendar: ReturnType<typeof calendarFromEnv>,
  ) {
    const key = `${stage}:${since.toISOString()}:${level}`;
    return this.prisma.$transaction(async (tx) => {
      const lock = `stage-alert:${record.publicId}:${key}`;
      const locked = await tx.$queryRaw<Array<{ result: number }>>`
        DECLARE @result int;
        EXEC @result = sp_getapplock @Resource = ${lock}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 0;
        SELECT @result AS result;
      `;
      if ((locked[0]?.result ?? -1) < 0) return 0;
      const already = await tx.auditEvent.count({
        where: {
          tenantId: record.tenantId,
          action: "case.stage-alert",
          resourcePublicId: record.publicId,
          afterJson: { contains: `"key":"${key}"` },
        },
      });
      if (already) return 0;
      const recipients = await this.recipients(tx, record, stage, level);
      const hours = Math.floor(
        workingMinutesBetween(since, now, calendar) / 60,
      );
      if (recipients.length)
        await tx.notification.createMany({
          data: recipients.map((recipient) => ({
            tenantId: record.tenantId,
            userId: recipient.userId,
            type: level === "HOD" ? "STAGE_ALERT_HOD" : "STAGE_ALERT_RED",
            title:
              level === "HOD"
                ? "Escalation: case delayed 8+ working hours"
                : "Red alert: case delayed 6+ working hours",
            body: `${record.caseNumber} has been ${STAGE_LABELS[stage]} for ${hours} working hours.`,
            href: recipient.href,
          })),
        });
      // The process document asks for a red intimation *mail*, not only an in-app notice.
      const webOrigin = this.config.get<string>("WEB_ORIGIN");
      if (recipients.length && this.secretBox && webOrigin) {
        const people = await tx.user.findMany({
          where: {
            id: { in: recipients.map((recipient) => recipient.userId) },
          },
          select: { id: true, email: true },
        });
        for (const person of people)
          await queueEmail(tx, this.secretBox, {
            tenantId: record.tenantId,
            aggregateType: "case",
            aggregateId: record.publicId,
            to: person.email,
            template: "stage-alert",
            variables: {
              level,
              caseNumber: record.caseNumber,
              stage: STAGE_LABELS[stage],
              hours,
              url: `${webOrigin}${recipients.find((recipient) => recipient.userId === person.id)?.href ?? `/cases/${record.publicId}`}`,
            },
          });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: record.tenantId,
          action: "case.stage-alert",
          resourceType: "case",
          resourcePublicId: record.publicId,
          afterJson: JSON.stringify({
            key,
            caseNumber: record.caseNumber,
            stage,
            level,
            workingHours: hours,
            recipients: recipients.length,
          }),
        },
      });
      return recipients.length;
    });
  }

  private async recipients(
    tx: Prisma.TransactionClient,
    record: {
      publicId: string;
      tenantId: bigint;
      branchId: bigint | null;
      assignedOpsUserId: bigint | null;
      dataEntryUserId: bigint | null;
      checks: Array<{ departmentId: bigint | null }>;
    },
    stage: WaitingStage,
    level: AlertLevel,
  ) {
    const branch = record.branchId
      ? { OR: [{ branchId: record.branchId }, { branchId: null }] }
      : {};
    const caseHref = `/cases/${record.publicId}`;
    const list = new Map<bigint, string>();
    const add = (ids: bigint[], href: string) =>
      ids.forEach((id) => list.has(id) || list.set(id, href));
    if (level === "HOD") {
      const heads = await tx.user.findMany({
        where: {
          tenantId: record.tenantId,
          status: "ACTIVE",
          userRoles: { some: { role: { code: "PLATFORM_ADMIN" } } },
        },
        select: { id: true },
      });
      add(
        heads.map((user) => user.id),
        caseHref,
      );
      return [...list].map(([userId, href]) => ({ userId, href }));
    }
    if (record.assignedOpsUserId && stage !== "NEEDS_RM")
      add(
        [record.assignedOpsUserId],
        `/spoc-rm/work?caseId=${record.publicId}`,
      );
    if (stage === "DATA_ENTRY") {
      if (record.dataEntryUserId)
        add([record.dataEntryUserId], `/data-entry?caseId=${record.publicId}`);
      const leads = await tx.departmentMember.findMany({
        where: {
          role: "LEAD",
          department: {
            tenantId: record.tenantId,
            kind: "DATA_ENTRY",
            status: "ACTIVE",
          },
          user: { status: "ACTIVE" },
        },
        select: { userId: true },
      });
      add(
        leads.map((lead) => lead.userId),
        "/data-entry?view=team",
      );
    }
    if (stage === "TEAM_ASSIGNMENT") {
      const departments = [
        ...new Set(
          record.checks.flatMap((check) =>
            check.departmentId ? [check.departmentId] : [],
          ),
        ),
      ];
      const leads = await tx.departmentMember.findMany({
        where: {
          role: "LEAD",
          departmentId: { in: departments },
          user: { status: "ACTIVE" },
        },
        select: { userId: true },
      });
      add(
        leads.map((lead) => lead.userId),
        "/verifier/team",
      );
    }
    const managers = await tx.user.findMany({
      where: {
        tenantId: record.tenantId,
        status: "ACTIVE",
        ...branch,
        userRoles: { some: { role: { code: "OPS_MANAGER" } } },
      },
      select: { id: true },
    });
    add(
      managers.map((user) => user.id),
      caseHref,
    );
    return [...list].map(([userId, href]) => ({ userId, href }));
  }
}
