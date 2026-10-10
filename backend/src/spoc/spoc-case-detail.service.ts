import { canReadReleasedReport } from "../reports/report-payment-policy";
import { REGENERABLE } from "../reports/report-regeneration.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { spocScope } from "../common/auth/access-scope";
import { CaseActivityService } from "../cases/case-activity.service";
import { PrismaService } from "../database/prisma.service";
import type { SpocActivityQueryDto } from "./dto/spoc-query.dto";
import { holderOf } from "./spoc-holder";
import { currentOwner } from "./spoc-case-records.service";

const name = { select: { displayName: true } } as const;

/**
 * Read-only case context for SPOC-RM. Candidate contact details, document files
 * and evidence files are deliberately excluded: this view shows status metadata only.
 */
const detailSelect = {
  publicId: true,
  caseNumber: true,
  externalRef: true,
  status: true,
  priority: true,
  riskLevel: true,
  dueAt: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  qaClaimedAt: true,
  subject: { select: { fullName: true } },
  client: { select: { publicId: true, displayName: true, status: true } },
  branch: { select: { name: true, city: true } },
  assignedOpsUser: name,
  qaReviewer: name,
  checks: {
    select: {
      publicId: true,
      type: true,
      status: true,
      result: true,
      riskLevel: true,
      dueAt: true,
      completedAt: true,
      sourceSummary: true,
      tasks: {
        select: {
          publicId: true,
          status: true,
          dueAt: true,
          completedAt: true,
          blockerReason: true,
          assignee: name,
        },
      },
      findings: {
        select: { publicId: true, kind: true, severity: true, title: true },
      },
    },
  },
  fieldVisits: {
    select: {
      publicId: true,
      status: true,
      address: true,
      geofenceMeters: true,
      distanceMeters: true,
      checkedInAt: true,
      completedAt: true,
      assignee: name,
      _count: { select: { evidence: true } },
    },
  },
  documents: {
    select: {
      publicId: true,
      type: true,
      status: true,
      currentVersion: true,
      updatedAt: true,
    },
  },
  clarifications: {
    select: {
      publicId: true,
      status: true,
      subject: true,
      dueAt: true,
      resolvedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  qaReviews: {
    select: {
      publicId: true,
      decision: true,
      notes: true,
      createdAt: true,
      reviewer: name,
    },
    orderBy: { createdAt: "desc" as const },
  },
  reports: {
    select: {
      publicId: true,
      status: true,
      currentVersion: true,
      publishedAt: true,
      createdAt: true,
      workflowVersion: true,
      releasedAt: true,
      downloadExpiresAt: true,
      managerReview: { select: { decision: true } },
      versions: {
        orderBy: { version: "desc" as const },
        take: 1,
        select: { version: true, generatedAt: true, authenticityCode: true },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
  invoiceLines: {
    select: {
      lineTotal: true,
      invoice: {
        select: {
          publicId: true,
          invoiceNumber: true,
          status: true,
          dueAt: true,
        },
      },
    },
  },
  statusHistory: {
    select: { fromStatus: true, toStatus: true, reason: true, createdAt: true },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

@Injectable()
export class SpocCaseDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: CaseActivityService,
  ) {}

  async detail(actor: Actor, publicId: string) {
    const row = await this.prisma.verificationCase.findFirst({
      where: { ...spocScope(actor), publicId },
      select: detailSelect,
    });
    if (!row) throw new NotFoundException("Case not found");
    return {
      id: row.publicId,
      caseNumber: row.caseNumber,
      externalRef: row.externalRef,
      status: row.status,
      holderRole: holderOf(row.status),
      currentOwner: currentOwner(row),
      priority: row.priority,
      riskLevel: row.riskLevel,
      dueAt: row.dueAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
      qaClaimedAt: row.qaClaimedAt,
      candidateName: row.subject.fullName,
      client: {
        id: row.client.publicId,
        displayName: row.client.displayName,
        status: row.client.status,
      },
      branch: row.branch,
      opsOwner: row.assignedOpsUser?.displayName ?? null,
      qaReviewer: row.qaReviewer?.displayName ?? null,
      checks: row.checks.map(({ publicId: id, tasks, findings, ...check }) => ({
        id,
        ...check,
        tasks: tasks.map(({ publicId: taskId, assignee, ...task }) => ({
          id: taskId,
          ...task,
          assignee: assignee?.displayName ?? null,
        })),
        findings: findings.map(({ publicId: findingId, ...finding }) => ({
          id: findingId,
          ...finding,
        })),
      })),
      fieldVisits: row.fieldVisits.map(
        ({ publicId: id, assignee, distanceMeters, _count, ...visit }) => ({
          id,
          ...visit,
          distanceMeters:
            distanceMeters === null ? null : Number(distanceMeters),
          assignee: assignee?.displayName ?? null,
          evidenceCount: _count.evidence,
        }),
      ),
      documents: row.documents.map(({ publicId: id, ...document }) => ({
        id,
        ...document,
      })),
      clarifications: row.clarifications.map(({ publicId: id, ...item }) => ({
        id,
        ...item,
      })),
      qaReviews: row.qaReviews.map(({ publicId: id, reviewer, ...review }) => ({
        id,
        ...review,
        reviewer: reviewer.displayName,
      })),
      reports: row.reports.map(
        ({ publicId: id, managerReview, versions, ...report }) => ({
          id,
          ...report,
          latest: versions[0] ?? null,
          canDownload: canReadReleasedReport(report),
          canRegenerate:
            report.workflowVersion === 2 &&
            managerReview?.decision === "APPROVED" &&
            REGENERABLE.includes(report.status),
        }),
      ),
      invoices: row.invoiceLines.map((line) => ({
        id: line.invoice.publicId,
        invoiceNumber: line.invoice.invoiceNumber,
        status: line.invoice.status,
        dueAt: line.invoice.dueAt,
        lineTotal: Number(line.lineTotal),
      })),
      statusHistory: row.statusHistory,
    };
  }

  async activityFor(
    actor: Actor,
    publicId: string,
    query: SpocActivityQueryDto,
  ) {
    const row = await this.prisma.verificationCase.findFirst({
      where: { ...spocScope(actor), publicId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException("Case not found");
    return this.activity.listForCase(actor.tenantId, row.id, publicId, query);
  }
}
