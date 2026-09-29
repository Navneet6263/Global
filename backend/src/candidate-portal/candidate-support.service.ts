import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { CreateSupportRequestService } from "../support/services/create-support-request.service";
import type { RaiseSupportRequestDto } from "../support/support.validation";
import { authorizeCandidateAccess } from "./candidate-access-authorizer";

/**
 * "Raise a support request" from the candidate link. The token is verified first;
 * the client and case then come from that access, never from the request body.
 */
@Injectable()
export class CandidateSupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requests: CreateSupportRequestService,
  ) {}

  async raise(publicId: string, token: string, input: RaiseSupportRequestDto) {
    const access = await authorizeCandidateAccess(this.prisma, publicId, token);
    return this.requests.forCandidate(
      {
        tenantId: access.tenantId,
        caseId: access.caseId,
        clientId: access.case.clientId,
        clientName: access.case.client.displayName,
        candidateName: access.case.subject.fullName,
      },
      input,
    );
  }
}
