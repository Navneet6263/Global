import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { BulkAssignDataEntryDto } from "./dto/bulk-data-entry.dto";
import {
  assignCaseToDataEntry,
  validateDataEntryAssignee,
} from "./intake-assign.helpers";
import { intakeSelect } from "./intake-queue.presenter";
import { isSupervisor } from "./workflow-access";

export interface BulkAssignSuccessItem {
  caseId: string;
  caseNumber: string;
  intakeStage: string;
  version: number;
}

export interface BulkAssignFailureItem {
  caseId: string;
  caseNumber?: string;
  code: string;
  reason: string;
}

function failureDetails(error: unknown): { code: string; reason: string } {
  if (error instanceof ForbiddenException) {
    return { code: "FORBIDDEN", reason: error.message };
  }
  if (error instanceof ConflictException) {
    return { code: "CONFLICT", reason: error.message };
  }
  if (error instanceof BadRequestException) {
    return { code: "BAD_REQUEST", reason: error.message };
  }
  return {
    code: "FAILED",
    reason: error instanceof Error ? error.message : "Assignment failed",
  };
}

@Injectable()
export class BulkDataEntryService {
  constructor(private readonly prisma: PrismaService) {}

  async assignMany(actor: Actor, input: BulkAssignDataEntryDto) {
    const allowedRole =
      isSupervisor(actor) ||
      actor.roles.includes("SPOC_RM") ||
      actor.roles.includes("DATA_ENTRY");
    if (!allowedRole) {
      throw new ForbiddenException(
        "Only responsible RMs, Data Entry leads, or Operations can assign Data Entry",
      );
    }

    const assignee = await validateDataEntryAssignee(
      this.prisma,
      actor,
      input.assigneeId,
    );

    const caseIds = input.items.map((item) => item.caseId);
    const rows = await this.prisma.verificationCase.findMany({
      where: {
        ...caseAccessScope(actor),
        publicId: { in: caseIds },
      },
      select: intakeSelect,
    });
    const byId = new Map(rows.map((row) => [row.publicId, row]));

    const assigned: BulkAssignSuccessItem[] = [];
    const failed: BulkAssignFailureItem[] = [];

    for (const item of input.items) {
      const current = byId.get(item.caseId);
      if (!current) {
        failed.push({
          caseId: item.caseId,
          code: "NOT_FOUND",
          reason: "Case not found in your scope",
        });
        continue;
      }
      try {
        const result = await assignCaseToDataEntry(
          this.prisma,
          actor,
          current,
          assignee,
          item.version,
          input.note,
        );
        assigned.push({
          caseId: result.id,
          caseNumber: current.caseNumber,
          intakeStage: result.intakeStage,
          version: result.version,
        });
      } catch (error) {
        const { code, reason } = failureDetails(error);
        failed.push({
          caseId: item.caseId,
          caseNumber: current.caseNumber,
          code,
          reason,
        });
      }
    }

    return {
      assignedCount: assigned.length,
      failedCount: failed.length,
      assignee: { id: assignee.publicId, name: assignee.displayName },
      assigned,
      failed,
    };
  }
}
