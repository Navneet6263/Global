import { Injectable, NotFoundException } from "@nestjs/common";
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
}
