import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { caseTransitions } from "./case.constants";

@Injectable()
export class CaseWorkflowPolicy {
  constructor(private readonly prisma: PrismaService) {}

  async assertAllowed(caseId: bigint, from: string, to: string): Promise<void> {
    if (!(caseTransitions[from] ?? []).includes(to)) {
      throw new ConflictException(`Case cannot move from ${from} to ${to}`);
    }
    if (to === "DOCUMENT_PENDING") {
      const accepted = await this.prisma.consent.count({
        where: { caseId, status: "ACCEPTED" },
      });
      if (!accepted)
        throw new BadRequestException("Accepted consent is required");
    }
    if (to === "QA_REVIEW") {
      const unfinished = await this.prisma.caseCheck.count({
        where: { caseId, status: { not: "COMPLETED" } },
      });
      if (unfinished)
        throw new BadRequestException("All checks must be completed before QA");
    }
    if (to === "COMPLETED") {
      const review = await this.prisma.qaReview.findFirst({
        where: { caseId },
        orderBy: { createdAt: "desc" },
        select: { decision: true },
      });
      if (review?.decision !== "APPROVED") {
        throw new BadRequestException("An approved QA review is required");
      }
    }
  }
}
