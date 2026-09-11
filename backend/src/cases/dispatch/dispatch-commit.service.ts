import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Actor } from "../../common/auth/actor";
import { caseAccessScope } from "../../common/auth/access-scope";
import { assertAnyRole, OPERATIONS_ROLES } from "../../common/auth/roles";
import { PrismaService } from "../../database/prisma.service";
import {
  isAssignmentWriteConflict,
  validateAssignmentCheck,
  validateBulkAssignmentInput,
} from "../../verification/bulk-task-assignment.helpers";
import type { DispatchCommitDto } from "./dispatch.dto";
import {
  dispatchCaseSelect,
  dispatchIssues,
  unassignedCheck,
} from "./dispatch.policy";
import { writeDispatchTasks, writeDispatchTransition } from "./dispatch-write";

@Injectable()
export class DispatchCommitService {
  constructor(private readonly prisma: PrismaService) {}

  async commit(actor: Actor, caseId: string, input: DispatchCommitDto) {
    assertAnyRole(
      actor,
      OPERATIONS_ROLES,
      "Only operations can dispatch cases",
    );
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const record = await tx.verificationCase.findFirst({
            where: { ...caseAccessScope(actor), publicId: caseId },
            select: dispatchCaseSelect,
          });
          if (!record)
            throw new NotFoundException("Case is unavailable in your scope");
          // A durable receipt shares the business transaction; a lost HTTP response
          // cannot make a retry create another set of tasks.
          const receipt = await tx.auditEvent.findFirst({
            where: {
              tenantId: actor.tenantId,
              actorUserId: actor.userId,
              resourceType: "case",
              resourcePublicId: caseId,
              action: "case.dispatch.committed",
              afterJson: { contains: `"operationId":"${input.operationId}"` },
            },
            select: { afterJson: true },
          });
          if (receipt?.afterJson) {
            const saved = JSON.parse(receipt.afterJson) as {
              fingerprint: string;
              result: {
                caseId: string;
                assigned: number;
                started: boolean;
                version: number;
              };
            };
            if (saved.fingerprint !== fingerprint)
              throw new ConflictException(
                "This operation ID was used for another allocation plan",
              );
            return saved.result;
          }
          if (record.version !== input.version)
            throw new ConflictException(
              "Case changed; refresh readiness and review the allocation again",
            );
          const issues = dispatchIssues(record);
          if (issues.length) throw new BadRequestException(issues.join("; "));
          const available = record.checks.filter(unassignedCheck);
          const ids = new Set(input.allocations.map((item) => item.checkId));
          if (
            ids.size !== input.allocations.length ||
            available.length !== ids.size ||
            available.some((check) => !ids.has(check.publicId))
          )
            throw new ConflictException(
              "Unassigned checks changed; every remaining check needs an allocation",
            );
          const verifiers = await tx.user.findMany({
            where: {
              tenantId: actor.tenantId,
              publicId: {
                in: input.allocations.map((item) => item.assigneeId),
              },
              status: "ACTIVE",
              userRoles: { some: { role: { code: "VERIFIER" } } },
            },
            select: {
              id: true,
              publicId: true,
              displayName: true,
              branchId: true,
              clientId: true,
            },
          });
          const plan = available.map((check) => {
            const item = input.allocations.find(
              (allocation) => allocation.checkId === check.publicId,
            )!;
            if (check.version !== item.checkVersion)
              throw new ConflictException(
                "Verification check changed; refresh the allocation",
              );
            const verifier = verifiers.find(
              (user) => user.publicId === item.assigneeId,
            );
            if (!verifier)
              throw new BadRequestException(
                "Selected verifier is no longer active or eligible",
              );
            const bulk = {
              assigneeId: item.assigneeId,
              mode: "ASSIGN" as const,
              items: [item],
            };
            validateBulkAssignmentInput(bulk);
            const scopedCheck = {
              ...check,
              case: { ...record, status: "IN_PROGRESS" },
            };
            const task = validateAssignmentCheck(
              scopedCheck,
              item,
              bulk,
              verifier,
            );
            return { check: scopedCheck, verifier, task };
          });
          const lock = await tx.verificationCase.updateMany({
            where: {
              id: record.id,
              tenantId: actor.tenantId,
              status: record.status,
              version: input.version,
            },
            data: { status: "IN_PROGRESS", version: { increment: 1 } },
          });
          if (lock.count !== 1)
            throw new ConflictException("Case was changed by another operator");
          await writeDispatchTasks(
            tx,
            actor,
            plan,
            input.instructions?.trim() || undefined,
          );
          await writeDispatchTransition(tx, actor, record);
          const result = {
            caseId: record.publicId,
            assigned: plan.length,
            started: record.status !== "IN_PROGRESS",
            version: record.version + 1,
          };
          await tx.auditEvent.create({
            data: {
              tenantId: actor.tenantId,
              actorUserId: actor.userId,
              action: "case.dispatch.committed",
              resourceType: "case",
              resourcePublicId: record.publicId,
              afterJson: JSON.stringify({
                operationId: input.operationId,
                fingerprint,
                caseNumber: record.caseNumber,
                result,
              }),
            },
          });
          return result;
        },
        { isolationLevel: "Serializable", maxWait: 5000, timeout: 20000 },
      );
    } catch (error) {
      if (isAssignmentWriteConflict(error))
        throw new ConflictException(
          "Case or assignment changed concurrently; refresh readiness and retry",
        );
      throw error;
    }
  }
}
