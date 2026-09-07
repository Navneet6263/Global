import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { SubjectPiiService } from "../common/security/subject-pii.service";
import { PrismaService } from "../database/prisma.service";
import { presentCaseDetail, presentCaseListItem } from "./case.presenter";
import { caseDetailSelect, caseListSelect } from "./case.selects";
import type { CaseQueryDto } from "./dto/case-query.dto";
import { rankedCasePage } from "./ranked-case-page";

import { caseRegisterWhere, caseRegisterOrder } from "./case-register-query";
export { caseRegisterWhere, caseRegisterOrder } from "./case-register-query";

@Injectable()
export class CaseReaderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pii: SubjectPiiService,
  ) {}

  async list(actor: Actor, query: CaseQueryDto) {
    const where = caseRegisterWhere(actor, query);
    const orderBy = caseRegisterOrder(query);
    const pageSize = query.pageSize ?? query.limit;
    if (
      query.page &&
      (query.sortBy === "priority" || query.sortBy === "progress")
    ) {
      const { rows, total } = await rankedCasePage(
        this.prisma,
        where,
        query.sortBy,
        query.sortDir ?? "desc",
        query.page,
        pageSize,
      );
      return {
        items: rows.map((row) => presentCaseListItem(row, actor, this.pii)),
        total,
        page: query.page,
        pageSize,
        nextCursor: null,
      };
    }
    if (query.page) {
      const [rows, total] = await Promise.all([
        this.prisma.verificationCase.findMany({
          where,
          select: caseListSelect,
          orderBy,
          skip: (query.page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.verificationCase.count({ where }),
      ]);
      const items = rows.map((row) =>
        presentCaseListItem(row, actor, this.pii),
      );
      return {
        items,
        total,
        page: query.page,
        pageSize,
        nextCursor:
          query.page * pageSize < total ? (items.at(-1)?.id ?? null) : null,
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.verificationCase.findMany({
        where,
        select: caseListSelect,
        orderBy,
        take: query.limit + 1,
        ...(query.cursor
          ? { cursor: { publicId: query.cursor }, skip: 1 }
          : {}),
      }),
      this.prisma.verificationCase.count({ where }),
    ]);
    const hasMore = rows.length > query.limit;
    const items = (hasMore ? rows.slice(0, query.limit) : rows).map((row) =>
      presentCaseListItem(row, actor, this.pii),
    );
    return {
      items,
      total,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async get(actor: Actor, publicId: string) {
    const row = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId },
      select: caseDetailSelect,
    });
    if (!row) throw new NotFoundException("Case not found");
    return presentCaseDetail(row, actor, this.pii);
  }

  async exportCsv(actor: Actor, query: CaseQueryDto) {
    const rows = await this.prisma.verificationCase.findMany({
      where: caseRegisterWhere(actor, query),
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
      orderBy: caseRegisterOrder(query),
      take: 10_001,
    });
    if (rows.length > 10_000) {
      throw new BadRequestException(
        "This export contains more than 10,000 cases; narrow the filters and try again",
      );
    }
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
          stage: query.stage ?? null,
          clientId: query.clientId ?? null,
          priority: query.priority ?? null,
          sla: query.sla ?? null,
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
