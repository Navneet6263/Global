import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { storeZip } from "../common/zip/store-zip";
import { PrismaService } from "../database/prisma.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import type { Prisma } from "../generated/prisma/client";
import {
  DispositionLabels,
  caseColour,
  type Disposition,
} from "../verification/dispositions";
import {
  MIS_COLUMNS,
  MIS_TITLES,
  istDay,
  misCsv,
  misRows,
  nextMisRun,
  type MisFrequency,
  type MisPreset,
} from "./client-mis";
import { canReadReleasedReport } from "./report-payment-policy";

const MAX_CASES = 2000;
const MAX_BULK = 50;

export const misCaseSelect = {
  caseNumber: true,
  status: true,
  createdAt: true,
  completedAt: true,
  dueAt: true,
  subject: { select: { fullName: true } },
  checks: {
    select: {
      type: true,
      result: true,
      disposition: true,
      sourceSummary: true,
      completedAt: true,
    },
  },
} satisfies Prisma.VerificationCaseSelect;

export function misCases(
  prisma: Pick<PrismaService, "verificationCase">,
  input: { tenantId: bigint; clientId: bigint; from: Date; to: Date },
) {
  return prisma.verificationCase.findMany({
    where: {
      tenantId: input.tenantId,
      clientId: input.clientId,
      status: { not: "DRAFT" },
      createdAt: { gte: input.from, lte: input.to },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_CASES,
    select: misCaseSelect,
  });
}

function range(from?: string, to?: string) {
  const end = to ? new Date(`${to}T23:59:59.999+05:30`) : new Date();
  const start = from
    ? new Date(`${from}T00:00:00+05:30`)
    : new Date(end.getTime() - 30 * 86_400_000);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()))
    throw new BadRequestException("Choose a valid date range");
  if (start > end)
    throw new BadRequestException("The start date is after the end date");
  if (end.getTime() - start.getTime() > 366 * 86_400_000)
    throw new BadRequestException("Choose a range of one year or less");
  return { from: start, to: end };
}

/**
 * Company Admin reports (BGV process): preset MIS (case status, TAT, UTV,
 * discrepancy) with colour codes, bulk download of released reports for a date range,
 * and MIS emailed on a daily / weekly / monthly schedule.
 */
@Injectable()
export class ClientReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalObjectStorageService,
  ) {}

  private clientId(actor: Actor) {
    if (!actor.clientId)
      throw new ForbiddenException("Reports are for company users");
    return actor.clientId;
  }

  /**
   * Preset MIS for the Client Admin's company, or for `company` when an RM generates
   * it for one of its assigned companies (the caller has checked the assignment).
   */
  async mis(
    actor: Actor,
    preset: MisPreset,
    from?: string,
    to?: string,
    company?: { id: bigint; publicId: string },
  ) {
    const window = range(from, to);
    const cases = await misCases(this.prisma, {
      tenantId: actor.tenantId,
      clientId: company?.id ?? this.clientId(actor),
      ...window,
    });
    const rows = misRows(preset, cases);
    const colours: Record<string, number> = {};
    for (const row of rows)
      colours[row.colour ?? "NONE"] = (colours[row.colour ?? "NONE"] ?? 0) + 1;
    return {
      preset,
      title: MIS_TITLES[preset],
      from: window.from,
      to: window.to,
      columns: MIS_COLUMNS[preset],
      total: rows.length,
      colours,
      rows: rows.slice(0, 200),
    };
  }

  async misExport(
    actor: Actor,
    preset: MisPreset,
    from?: string,
    to?: string,
    company?: { id: bigint; publicId: string },
  ) {
    const window = range(from, to);
    const cases = await misCases(this.prisma, {
      tenantId: actor.tenantId,
      clientId: company?.id ?? this.clientId(actor),
      ...window,
    });
    const rows = misRows(preset, cases);
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: company ? "rm.client-mis-exported" : "client.mis-exported",
        resourceType: "client",
        resourcePublicId: company?.publicId ?? actor.clientPublicId ?? "client",
        afterJson: JSON.stringify({
          preset,
          from: window.from,
          to: window.to,
          rows: rows.length,
        }),
      },
    });
    return new StreamableFile(Buffer.from(misCsv(preset, rows)), {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="Sapling-Global-${preset.toLowerCase()}-mis.csv"`,
    });
  }

  /** Released reports in a date range (optionally one colour) as a ZIP with an index. */
  async bulk(actor: Actor, from?: string, to?: string, colour?: Disposition) {
    const window = range(from, to);
    const reports = await this.prisma.report.findMany({
      where: {
        tenantId: actor.tenantId,
        status: "PUBLISHED",
        releasedAt: { gte: window.from, lte: window.to },
        case: { tenantId: actor.tenantId, clientId: this.clientId(actor) },
      },
      orderBy: { releasedAt: "desc" },
      take: 500,
      select: {
        publicId: true,
        status: true,
        workflowVersion: true,
        releasedAt: true,
        downloadExpiresAt: true,
        case: {
          select: {
            caseNumber: true,
            subject: { select: { fullName: true } },
            checks: { select: { result: true, disposition: true } },
          },
        },
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { objectKey: true, version: true },
        },
      },
    });
    const chosen = reports
      .filter((report) => canReadReleasedReport(report) && report.versions[0])
      .map((report) => ({ report, colour: caseColour(report.case.checks) }))
      .filter((item) => !colour || item.colour === colour);
    if (!chosen.length)
      throw new NotFoundException(
        "No downloadable reports were released in this range",
      );
    if (chosen.length > MAX_BULK)
      throw new BadRequestException(
        `${chosen.length} reports match. Narrow the range to ${MAX_BULK} or fewer.`,
      );
    const files: Array<{ name: string; data: Buffer }> = [];
    const index = ["Sapling ID,Candidate,Released,Colour code,File"];
    for (const { report, colour: code } of chosen) {
      const name = `${report.case.caseNumber}.pdf`;
      files.push({
        name,
        data: await this.storage.get(report.versions[0]!.objectKey),
      });
      index.push(
        [
          report.case.caseNumber,
          `"${report.case.subject.fullName.replaceAll('"', '""')}"`,
          istDay(report.releasedAt),
          code ? DispositionLabels[code] : "",
          name,
        ].join(","),
      );
    }
    files.unshift({
      name: "index.csv",
      data: Buffer.from(`${String.fromCharCode(0xfeff)}${index.join("\r\n")}`),
    });
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "report.bulk-downloaded",
        resourceType: "client",
        resourcePublicId: actor.clientPublicId ?? "client",
        afterJson: JSON.stringify({
          reports: chosen.map((item) => item.report.publicId),
          from: window.from,
          to: window.to,
          colour: colour ?? null,
        }),
      },
    });
    return new StreamableFile(storeZip(files), {
      type: "application/zip",
      disposition: `attachment; filename="Sapling-Global-reports.zip"`,
    });
  }

  async schedules(actor: Actor) {
    const rows = await this.prisma.clientMisSchedule.findMany({
      where: {
        tenantId: actor.tenantId,
        clientId: this.clientId(actor),
        active: true,
      },
      orderBy: { createdAt: "desc" },
      select: {
        publicId: true,
        preset: true,
        frequency: true,
        recipientsJson: true,
        nextRunAt: true,
        lastRunAt: true,
        createdAt: true,
      },
    });
    const recipients = await this.prisma.user.findMany({
      where: {
        tenantId: actor.tenantId,
        clientId: this.clientId(actor),
        status: "ACTIVE",
      },
      orderBy: { displayName: "asc" },
      take: 100,
      select: { email: true, displayName: true },
    });
    return {
      items: rows.map(({ publicId, recipientsJson, ...row }) => ({
        id: publicId,
        ...row,
        recipients: JSON.parse(recipientsJson) as string[],
      })),
      recipients,
    };
  }

  async schedule(
    actor: Actor,
    input: { preset: MisPreset; frequency: MisFrequency; recipients: string[] },
  ) {
    const clientId = this.clientId(actor);
    const emails = [
      ...new Set(input.recipients.map((email) => email.trim().toLowerCase())),
    ];
    const users = await this.prisma.user.findMany({
      where: {
        tenantId: actor.tenantId,
        clientId,
        status: "ACTIVE",
        email: { in: emails },
      },
      select: { email: true },
    });
    if (!emails.length || users.length !== emails.length)
      throw new BadRequestException(
        "Send the MIS only to active users of your company",
      );
    const active = await this.prisma.clientMisSchedule.count({
      where: { tenantId: actor.tenantId, clientId, active: true },
    });
    if (active >= 10)
      throw new BadRequestException("At most 10 scheduled reports");
    const nextRunAt = nextMisRun(input.frequency);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.clientMisSchedule.create({
        data: {
          tenantId: actor.tenantId,
          clientId,
          preset: input.preset,
          frequency: input.frequency,
          recipientsJson: JSON.stringify(emails),
          nextRunAt,
          createdById: actor.userId,
        },
        select: { publicId: true, nextRunAt: true },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "client.mis-scheduled",
          resourceType: "client",
          resourcePublicId: actor.clientPublicId ?? "client",
          afterJson: JSON.stringify({
            scheduleId: created.publicId,
            preset: input.preset,
            frequency: input.frequency,
            recipients: emails.length,
          }),
        },
      });
      return { id: created.publicId, nextRunAt: created.nextRunAt };
    });
  }

  async unschedule(actor: Actor, scheduleId: string) {
    const clientId = this.clientId(actor);
    const changed = await this.prisma.clientMisSchedule.updateMany({
      where: {
        publicId: scheduleId,
        tenantId: actor.tenantId,
        clientId,
        active: true,
      },
      data: { active: false },
    });
    if (changed.count !== 1) throw new NotFoundException("Schedule not found");
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "client.mis-unscheduled",
        resourceType: "client",
        resourcePublicId: actor.clientPublicId ?? "client",
        afterJson: JSON.stringify({ scheduleId }),
      },
    });
    return { id: scheduleId, active: false };
  }
}
