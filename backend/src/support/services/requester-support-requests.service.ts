import { Injectable } from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";
import { pageResult } from "../../spoc/spoc-scope";
import { SupportRepository } from "../support.repository";
import type { MySupportRequestQueryDto } from "../support.validation";
import { toRequesterView } from "./support-request-view";

/** A requester's own requests with status and reply: never anyone else's. */
@Injectable()
export class RequesterSupportRequestsService {
  constructor(private readonly repository: SupportRepository) {}

  async forClientAdmin(actor: Actor, query: MySupportRequestQueryDto) {
    const { rows, total } = await this.repository.pageForRequester(
      {
        tenantId: actor.tenantId,
        requesterType: "CLIENT_ADMIN",
        requesterUserId: actor.userId,
      },
      query.page,
      query.pageSize,
    );
    return pageResult(
      rows.map(toRequesterView),
      total,
      query.page,
      query.pageSize,
    );
  }

  /** Shown on the candidate link: this case's candidate requests only. */
  async forCandidate(tenantId: bigint, caseId: bigint) {
    const rows = await this.repository.latestForCase(
      tenantId,
      caseId,
      "CANDIDATE",
    );
    return rows.map(toRequesterView);
  }
}
