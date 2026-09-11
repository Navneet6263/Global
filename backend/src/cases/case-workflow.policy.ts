import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { caseTransitions } from "./case.constants";
import type { Prisma } from "../generated/prisma/client";
import { assertCaseEvidenceReady } from "../documents/evidence-readiness";

@Injectable()
export class CaseWorkflowPolicy {
  constructor(private readonly prisma: PrismaService) {}

  async assertAllowed(
    caseId: bigint,
    from: string,
    to: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (
      ["MANAGER_REVIEW", "REPORT_PENDING", "PAYMENT_PENDING"].includes(from) ||
      [
        "MANAGER_REVIEW",
        "REPORT_PENDING",
        "PAYMENT_PENDING",
        "COMPLETED",
      ].includes(to)
    ) {
      throw new BadRequestException(
        "Use the controlled review, billing or report-release action for this stage",
      );
    }
    if (!(caseTransitions[from] ?? []).includes(to)) {
      throw new ConflictException(`Case cannot move from ${from} to ${to}`);
    }
    if (to === "DOCUMENT_PENDING") {
      const accepted = await tx.consent.count({
        where: { caseId, status: "ACCEPTED" },
      });
      if (!accepted)
        throw new BadRequestException("Accepted consent is required");
    }
    if (to === "IN_PROGRESS") {
      await assertCaseEvidenceReady(tx, caseId, { includeWork: false });
      if (
        from === "CLARIFICATION_PENDING" &&
        (await tx.clarification.count({
          where: { caseId, status: { in: ["OPEN", "RESPONDED"] } },
        }))
      ) {
        throw new BadRequestException(
          "Resolve the outstanding clarifications before resuming verification",
        );
      }
    }
    if (to === "QA_REVIEW") {
      await assertCaseEvidenceReady(tx, caseId);
      const unfinished = await tx.caseCheck.count({
        where: { caseId, status: { not: "COMPLETED" } },
      });
      if (unfinished)
        throw new BadRequestException("All checks must be completed before QA");
    }
    if (to === "CLOSED") {
      const report = await tx.report.findFirst({
        where: { caseId },
        orderBy: { createdAt: "desc" },
        select: { status: true, releasedAt: true, workflowVersion: true },
      });
      if (
        !report ||
        report.status !== "PUBLISHED" ||
        (report.workflowVersion >= 2 && !report.releasedAt)
      ) {
        throw new BadRequestException(
          "Release the approved, paid report before closing this case",
        );
      }
    }
  }
}
