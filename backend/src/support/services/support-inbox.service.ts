import { Injectable, NotFoundException } from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";
import { supportScope } from "../../common/auth/access-scope";
import type { Prisma } from "../../generated/prisma/client";
import { pageResult } from "../../spoc/spoc-scope";
import { SupportRepository } from "../support.repository";
import type { SupportRequestQueryDto } from "../support.validation";
import { toSupportRequest } from "./support-request-view";

/** The Support Agent inbox (reads): every request of the tenant, filtered. */
@Injectable()
export class SupportInboxService {
  constructor(private readonly repository: SupportRepository) {}

  async list(actor: Actor, query: SupportRequestQueryDto) {
    const text = query.search?.trim();
    const where: Prisma.SupportRequestWhereInput = {
      ...supportScope(actor),
      ...(query.status ? { status: query.status } : {}),
      ...(query.requesterType ? { requesterType: query.requesterType } : {}),
      ...(query.clientId ? { client: { publicId: query.clientId } } : {}),
      ...(query.mine ? { assignedToId: actor.userId } : {}),
      ...(text
        ? {
            OR: [
              { requestNumber: { contains: text } },
              { subject: { contains: text } },
              { case: { caseNumber: { contains: text } } },
              { case: { subject: { fullName: { contains: text } } } },
              { client: { displayName: { contains: text } } },
            ],
          }
        : {}),
    };
    const { rows, total } = await this.repository.pageForAgent(
      where,
      query.page,
      query.pageSize,
    );
    return pageResult(
      rows.map((row) => toSupportRequest(row, actor.userId)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async detail(actor: Actor, publicId: string) {
    const row = await this.repository.findForAgent({
      ...supportScope(actor),
      publicId,
    });
    if (!row) throw new NotFoundException("Support request not found");
    return toSupportRequest(row, actor.userId);
  }
}
