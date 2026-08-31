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
import type { Prisma } from "../generated/prisma/client";
import { presentCaseDetail, presentCaseListItem } from "./case.presenter";
import { caseDetailSelect, caseListSelect } from "./case.selects";
import type { CaseQueryDto } from "./dto/case-query.dto";

const stageStatuses: Record<NonNullable<CaseQueryDto["stage"]>, string[]> = {
  intake: ["DRAFT"],
  consent: ["CONSENT_PENDING"],
  documents: ["DOCUMENT_PENDING"],
  verification: ["IN_PROGRESS"],
  clarification: ["CLARIFICATION_PENDING"],
  qa: ["QA_REVIEW"],
  completed: ["COMPLETED", "CLOSED", "CANCELLED"],
};

export function caseRegisterWhere(
  actor: Actor,
  query: CaseQueryDto,
  now = new Date(),
): Prisma.VerificationCaseWhereInput {
  const and: Prisma.VerificationCaseWhereInput[] = [];
  const search = query.search?.trim();
  if (search) {
    and.push({
      OR: [
        { caseNumber: { contains: search } },
        { externalRef: { contains: search } },
        { subject: { fullName: { contains: search } } },
        { client: { displayName: { contains: search } } },
        { assignedOpsUser: { displayName: { contains: search } } },
      ],
    });
  }
  if (query.sla) {
    const approachingAt = new Date(now.getTime() + 8 * 60 * 60 * 1_000);
    and.push(
      query.sla === "overdue"
        ? { dueAt: { lt: now } }
        : query.sla === "approaching"
          ? { dueAt: { gte: now, lte: approachingAt } }
          : { OR: [{ dueAt: null }, { dueAt: { gt: approachingAt } }] },
    );
  }

  return {
    ...caseAccessScope(actor),
    ...(query.status
      ? { status: query.status }
      : query.stage
        ? { status: { in: stageStatuses[query.stage] } }
        : {}),
    ...(query.clientId ? { client: { publicId: query.clientId } } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: inclusiveDateEnd(query.to) } : {}),
          },
        }
      : {}),
    ...(and.length ? { AND: and } : {}),
  };
}

export function caseRegisterOrder(
  query: CaseQueryDto,
): Prisma.VerificationCaseOrderByWithRelationInput[] {
  const direction = query.sortDir ?? "desc";
  if (query.sortBy === "candidateName") {
    return [{ subject: { fullName: direction } }, { publicId: "desc" }];
  }
  if (query.sortBy === "sla") {
    return [{ dueAt: direction }, { publicId: "desc" }];
  }
  return [{ updatedAt: direction }, { publicId: "desc" }];
}

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

function inclusiveDateEnd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T23:59:59.999Z`)
    : new Date(value);
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
