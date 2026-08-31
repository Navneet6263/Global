import {
  BadRequestException,
  Injectable,
  StreamableFile,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PDFDocument, rgb } from "pdf-lib";
import { embedUnicodeFonts } from "../common/pdf/unicode-fonts";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { SecretBoxService } from "../common/security/secret-box.service";
import type {
  ExecutiveExportQueryDto,
  ExecutiveScheduleDto,
} from "./dto/executive-query.dto";
import { ExecutiveAnalyticsService } from "./executive-analytics.service";

@Injectable()
export class ExecutiveExportService {
  constructor(
    private readonly analytics: ExecutiveAnalyticsService,
    private readonly prisma: PrismaService,
    private readonly secretBox: SecretBoxService,
    private readonly config: ConfigService,
  ) {}

  async export(actor: Actor, query: ExecutiveExportQueryDto) {
    const data = await this.analytics.dashboard(actor, query, 10_000);
    const date = new Date().toISOString().slice(0, 10);
    const contents =
      query.format === "pdf"
        ? await this.pdf(data)
        : this.csv(data.caseRegister);
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "dashboard.executive.exported",
        resourceType: "executive_dashboard",
        afterJson: JSON.stringify({
          format: query.format,
          filters: data.filters.applied,
        }),
      },
    });
    return new StreamableFile(contents, {
      type:
        query.format === "pdf" ? "application/pdf" : "text/csv; charset=utf-8",
      disposition: `attachment; filename="Sapling-Global-Executive-${date}.${query.format}"`,
    });
  }

  async schedule(actor: Actor, input: ExecutiveScheduleDto) {
    const deliveryAt = new Date(input.deliveryAt);
    const now = new Date();
    if (deliveryAt.getTime() < now.getTime() + 60_000)
      throw new BadRequestException(
        "Delivery time must be at least one minute in the future",
      );
    if (deliveryAt.getTime() > now.getTime() + 366 * 86_400_000)
      throw new BadRequestException(
        "Delivery time cannot be more than one year ahead",
      );
    const query = this.queryString(input);
    const webOrigin = this.config
      .getOrThrow<string>("WEB_ORIGIN")
      .replace(/\/$/, "");
    const apiOrigin = this.config
      .get<string>("PUBLIC_API_ORIGIN", webOrigin)
      .replace(/\/$/, "");
    const secret = this.secretBox.seal({
      recipientEmail: input.recipientEmail.toLowerCase(),
      format: input.format,
      dashboardUrl: `${webOrigin}/admin/analytics?${query}`,
      exportUrl: `${apiOrigin}/api/v1/dashboards/executive/export?${query}&format=${input.format}`,
      deliveryAt: deliveryAt.toISOString(),
    });
    const scheduled = await this.prisma.$transaction(async (tx) => {
      const event = await tx.outboxEvent.create({
        data: {
          tenantId: actor.tenantId,
          topic: "dashboard.executive.delivery",
          aggregateType: "executive_dashboard",
          aggregateId: actor.userPublicId,
          payloadJson: JSON.stringify({ secret }),
          availableAt: deliveryAt,
        },
        select: { id: true, availableAt: true },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "dashboard.executive.delivery-scheduled",
          resourceType: "executive_dashboard",
          resourcePublicId: event.id.toString(),
          afterJson: JSON.stringify({
            recipient: this.maskEmail(input.recipientEmail),
            format: input.format,
            deliveryAt: deliveryAt.toISOString(),
          }),
        },
      });
      return event;
    });
    return {
      scheduled: true,
      id: scheduled.id.toString(),
      deliveryAt: scheduled.availableAt,
    };
  }

  private csv(rows: Array<Record<string, unknown>>) {
    const header = [
      "Case",
      "Candidate",
      "Client",
      "Branch",
      "Owner",
      "Status",
      "Priority",
      "Risk",
      "Due date",
      "Updated",
    ];
    const values = rows.map((row) => {
      const subject = row["subject"] as { fullName?: string } | undefined;
      const client = row["client"] as { displayName?: string } | undefined;
      const branch = row["branch"] as { name?: string } | null;
      const owner = row["owner"] as { displayName?: string } | null;
      return [
        row["caseNumber"],
        subject?.fullName,
        client?.displayName,
        branch?.name,
        owner?.displayName,
        row["status"],
        row["priority"],
        row["riskLevel"],
        this.iso(row["dueAt"]),
        this.iso(row["updatedAt"]),
      ]
        .map((value) => this.escape(value))
        .join(",");
    });
    return Buffer.from(
      `\uFEFF${[header.join(","), ...values].join("\r\n")}`,
      "utf8",
    );
  }

  private async pdf(
    data: Awaited<ReturnType<ExecutiveAnalyticsService["dashboard"]>>,
  ) {
    const document = await PDFDocument.create();
    const { regular, bold } = await embedUnicodeFonts(document);
    const page = document.addPage([842, 595]);
    page.drawText("Sapling Global | Executive portfolio", {
      x: 42,
      y: 548,
      size: 18,
      font: bold,
      color: rgb(0.12, 0.1, 0.09),
    });
    page.drawText(
      `Generated ${new Date(data.generatedAt).toLocaleString("en-IN")}`,
      { x: 42, y: 530, size: 8, font: regular, color: rgb(0.45, 0.42, 0.4) },
    );
    const metrics: Array<[string, string | number]> = [
      ["Portfolio", data.summary.total],
      ["Overdue", data.summary.overdue],
      [
        "SLA health",
        data.performance.slaPercentage === null
          ? "Not available"
          : `${data.performance.slaPercentage}%`,
      ],
      [
        "Average TAT",
        data.performance.completedCases
          ? `${data.performance.averageTatHours}h`
          : "Not available",
      ],
    ];
    metrics.forEach(([label, value], index) => {
      const x = 42 + index * 190;
      page.drawRectangle({
        x,
        y: 475,
        width: 174,
        height: 42,
        color: rgb(0.98, 0.96, 0.94),
        borderColor: rgb(0.92, 0.88, 0.84),
        borderWidth: 0.6,
      });
      page.drawText(String(label), {
        x: x + 10,
        y: 501,
        size: 8,
        font: regular,
        color: rgb(0.45, 0.42, 0.4),
      });
      page.drawText(String(value), { x: x + 10, y: 483, size: 13, font: bold });
    });
    page.drawText("Cases requiring attention", {
      x: 42,
      y: 443,
      size: 11,
      font: bold,
    });
    const columns = [42, 126, 245, 365, 492, 650];
    ["Case", "Candidate", "Client", "Status", "Reason", "Owner"].forEach(
      (label, i) =>
        page.drawText(label, {
          x: columns[i]!,
          y: 425,
          size: 7.5,
          font: bold,
          color: rgb(0.35, 0.32, 0.3),
        }),
    );
    data.attentionQueue.slice(0, 12).forEach((item, index) => {
      const y = 407 - index * 25;
      page.drawLine({
        start: { x: 42, y: y - 7 },
        end: { x: 800, y: y - 7 },
        thickness: 0.4,
        color: rgb(0.9, 0.88, 0.86),
      });
      [
        item.caseNumber,
        item.subject.fullName,
        item.client.displayName,
        item.status,
        item.reasons.join(" / "),
        item.owner?.displayName ?? "Unassigned",
      ].forEach((value, i) =>
        page.drawText(this.clip(value, i === 4 ? 24 : 16), {
          x: columns[i]!,
          y,
          size: 7.2,
          font: regular,
        }),
      );
    });
    if (!data.attentionQueue.length)
      page.drawText(
        "No active exception requires leadership attention in this filter range.",
        { x: 42, y: 405, size: 8, font: regular, color: rgb(0.35, 0.55, 0.4) },
      );
    page.drawText(
      "Source: live application database. Values respect the signed-in user's tenant and access scope.",
      { x: 42, y: 28, size: 7, font: regular, color: rgb(0.5, 0.47, 0.44) },
    );
    return Buffer.from(await document.save());
  }

  private iso(value: unknown) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string" || typeof value === "number")
      return new Date(value).toISOString();
    return "";
  }

  private escape(value: unknown) {
    const text =
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
        ? String(value)
        : "";
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  }

  private clip(value: string, length: number) {
    return value.length > length ? `${value.slice(0, length - 1)}...` : value;
  }

  private queryString(input: ExecutiveScheduleDto) {
    const params = new URLSearchParams();
    for (const key of [
      "months",
      "from",
      "to",
      "clientId",
      "branchId",
      "checkType",
      "priority",
      "riskLevel",
    ] as const) {
      const value = input[key];
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    return params.toString();
  }

  private maskEmail(email: string) {
    const [local = "", domain = ""] = email.split("@");
    return `${local.slice(0, 2)}***@${domain}`;
  }
}
