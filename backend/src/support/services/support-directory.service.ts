import { Injectable } from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";
import { supportScope } from "../../common/auth/access-scope";
import type { Prisma } from "../../generated/prisma/client";
import { statusesHeldBy, terminalCaseStatuses } from "../../spoc/spoc-holder";
import { pageResult } from "../../spoc/spoc-scope";
import { SupportDirectoryRepository } from "../support-directory.repository";
import type {
  SupportEmployeeQueryDto,
  SupportPageQueryDto,
} from "../support.validation";
import { toSupportClient } from "./support-client-view";
import { toEmployee } from "./support-employee-view";
import { supportStateWhere } from "./support-rules";

/** Read-only, tenant-wide lists for the support desk: summary, clients, employees. */
@Injectable()
export class SupportDirectoryService {
  constructor(private readonly repository: SupportDirectoryRepository) {}

  async summary(actor: Actor) {
    const now = new Date();
    const scope = supportScope(actor);
    const [clients, activeEmployees, exceptions, openRequests] =
      await Promise.all([
        this.repository.countClients(scope),
        this.repository.countCases({
          ...scope,
          status: { notIn: terminalCaseStatuses },
        }),
        this.repository.countCases({
          ...scope,
          ...supportStateWhere("EXCEPTION", now),
        }),
        this.repository.countOpenRequests(actor.tenantId),
      ]);
    return { clients, activeEmployees, exceptions, openRequests };
  }

  async clients(actor: Actor, query: SupportPageQueryDto) {
    const text = query.search?.trim();
    const where: Prisma.ClientWhereInput = {
      ...supportScope(actor),
      ...(text
        ? {
            OR: [
              { displayName: { contains: text } },
              { code: { contains: text } },
            ],
          }
        : {}),
    };
    const { rows, total } = await this.repository.pageClients(
      where,
      query.page,
      query.pageSize,
    );
    const inPage = {
      tenantId: actor.tenantId,
      clientId: { in: rows.map((row) => row.id) },
    };
    const [totals, exceptions, requests] = await Promise.all([
      this.repository.caseTotals(inPage),
      this.repository.caseCountsWhere(
        inPage,
        supportStateWhere("EXCEPTION", new Date()),
      ),
      this.repository.openRequestCounts(inPage),
    ]);
    return pageResult(
      rows.map((row) => toSupportClient(row, totals, exceptions, requests)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async employees(actor: Actor, query: SupportEmployeeQueryDto) {
    const now = new Date();
    const text = query.search?.trim();
    const conditions: Prisma.VerificationCaseWhereInput[] = [
      supportScope(actor),
    ];
    if (query.clientId)
      conditions.push({ client: { publicId: query.clientId } });
    if (query.state) conditions.push(supportStateWhere(query.state, now));
    if (query.status) conditions.push({ status: query.status });
    else if (query.holderRole)
      conditions.push({ status: { in: statusesHeldBy(query.holderRole) } });
    if (text)
      conditions.push({
        OR: [
          { caseNumber: { contains: text } },
          { subject: { fullName: { contains: text } } },
          { client: { displayName: { contains: text } } },
        ],
      });
    const { rows, total } = await this.repository.pageEmployees(
      { AND: conditions },
      query.page,
      query.pageSize,
    );
    return pageResult(
      rows.map((row) => toEmployee(row, now)),
      total,
      query.page,
      query.pageSize,
    );
  }
}
