import { Injectable, NotFoundException, StreamableFile } from "@nestjs/common";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { SubjectPiiService } from "../common/security/subject-pii.service";
import { PrismaService } from "../database/prisma.service";
import { presentCaseDetail, presentCaseListItem } from "./case.presenter";
import { caseDetailSelect, caseListSelect } from "./case.selects";
import type { CaseQueryDto } from "./dto/case-query.dto";

@Injectable()
export class CaseReaderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pii: SubjectPiiService,
  ) {}

  async list(actor: Actor, query: CaseQueryDto) {
    const search = query.search?.trim();
    const rows = await this.prisma.verificationCase.findMany({
      where: {
        ...caseAccessScope(actor),
        status: query.status,
        client: query.clientId ? { publicId: query.clientId } : undefined,
        ...(search
          ? {
              OR: [
                { caseNumber: { contains: search } },
                { externalRef: { contains: search } },
                { subject: { fullName: { contains: search } } },
                { client: { displayName: { contains: search } } },
              ],
            }
          : {}),
      },
      select: caseListSelect,
      orderBy: [{ createdAt: "desc" }, { publicId: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { publicId: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const items = (hasMore ? rows.slice(0, query.limit) : rows).map((row) =>
      presentCaseListItem(row, this.pii),
    );
    return { items, nextCursor: hasMore ? items.at(-1)?.id : null };
  }

  async get(actor: Actor, publicId: string) {
    const row = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId },
      select: caseDetailSelect,
    });
    if (!row) throw new NotFoundException("Case not found");
    return presentCaseDetail(row, this.pii);
  }

  async exportCsv(actor: Actor, query: CaseQueryDto) {
    const search = query.search?.trim();
    const rows = await this.prisma.verificationCase.findMany({
      where: {
        ...caseAccessScope(actor),
        status: query.status,
        client: query.clientId ? { publicId: query.clientId } : undefined,
        ...(search
          ? {
              OR: [
                { caseNumber: { contains: search } },
                { externalRef: { contains: search } },
                { subject: { fullName: { contains: search } } },
                { client: { displayName: { contains: search } } },
              ],
            }
          : {}),
      },
      select: {
        caseNumber: true,
        externalRef: true,
        status: true,
        priority: true,
        dueAt: true,
        createdAt: true,
        subject: { select: { fullName: true } },
        client: { select: { displayName: true } },
      },
      orderBy: [{ createdAt: "desc" }, { publicId: "desc" }],
      take: 10_000,
    });
    const csv = [
      [
        "Case number",
        "Candidate",
        "Client",
        "External ref",
        "Status",
        "Priority",
        "Due date",
        "Created at",
      ],
      ...rows.map((row) => [
        row.caseNumber,
        row.subject.fullName,
        row.client.displayName,
        row.externalRef ?? "",
        row.status,
        row.priority,
        row.dueAt?.toISOString() ?? "",
        row.createdAt.toISOString(),
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "case.portfolio-exported",
        resourceType: "case-portfolio",
        afterJson: JSON.stringify({
          count: rows.length,
          status: query.status ?? null,
        }),
      },
    });
    return new StreamableFile(Buffer.from(`\uFEFF${csv}`, "utf8"), {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="sapling-global-cases-${new Date().toISOString().slice(0, 10)}.csv"`,
    });
  }
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
