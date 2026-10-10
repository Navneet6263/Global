import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  StreamableFile,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { SubjectPiiService } from "../common/security/subject-pii.service";
import { PrismaService } from "../database/prisma.service";
import { ReportPdfService } from "./report-pdf.service";
import { entriesOf } from "./report-snapshot";

/** Source contacts and costs never leave the building in a report that QC has not reviewed. */
const PRIVATE_KEYS = new Set([
  "verifierContact",
  "respondentContact",
  "extraCost",
  "extraCostApproval",
  "challanReference",
]);

const DONE = ["COMPLETED", "VERIFIED", "CLOSED"];

/**
 * Interim (work in progress) report: an on-demand PDF for a case still in verification.
 * Shows only checks that already have a result, without source contacts, methods or
 * internal notes; nothing is stored and every download is audited.
 */
@Injectable()
export class InterimReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: ReportPdfService,
    @Optional() private readonly pii?: SubjectPiiService,
  ) {}

  async download(actor: Actor, casePublicId: string) {
    const row = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId: casePublicId },
      select: {
        id: true,
        caseNumber: true,
        status: true,
        externalRef: true,
        joiningDate: true,
        client: { select: { displayName: true } },
        services: { select: { serviceFamily: true } },
        subject: {
          select: {
            fullName: true,
            email: true,
            phone: true,
            employeeCode: true,
            piiCiphertext: true,
            piiKeyVersion: true,
          },
        },
        checks: {
          orderBy: { id: "asc" },
          select: {
            type: true,
            status: true,
            result: true,
            disposition: true,
            sourceSummary: true,
            initiationJson: true,
            verifiedJson: true,
            caseService: { select: { serviceFamily: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException("Case not found");
    if (["COMPLETED", "CLOSED", "CANCELLED", "DRAFT"].includes(row.status))
      throw new ConflictException(
        "An interim report is only available while verification is in progress",
      );
    const employeeCode = this.pii
      ? this.pii.open(row.subject).employeeCode
      : row.subject.employeeCode;
    const now = new Date();
    const pdf = await this.pdf.render({
      interim: true,
      caseNumber: row.caseNumber,
      generatedAt: now,
      authenticityCode: `INTERIM-${randomBytes(4).toString("hex").toUpperCase()}`,
      clientName: row.client.displayName,
      candidateName: row.subject.fullName,
      identityDetails: employeeCode ? [["Employee code", employeeCode]] : [],
      header: {
        employeeCode: employeeCode ?? null,
        joiningDate: row.joiningDate?.toISOString().slice(0, 10) ?? null,
        clientProcess: row.externalRef,
      },
      completedAt: null,
      riskLevel: null,
      services: [
        ...new Set(row.services.map((service) => service.serviceFamily)),
      ],
      checks: row.checks.map((check) => {
        const done = Boolean(check.result) && DONE.includes(check.status);
        return {
          type: check.type,
          result: done ? check.result : null,
          disposition: done ? check.disposition : null,
          riskLevel: null,
          serviceFamily: check.caseService?.serviceFamily,
          sourceSummary: done ? check.sourceSummary : null,
          claimed: done ? entriesOf(check.initiationJson) : [],
          verified: done
            ? entriesOf(check.verifiedJson).map((entry) =>
                Object.fromEntries(
                  Object.entries(entry).filter(
                    ([key]) => !PRIVATE_KEYS.has(key),
                  ),
                ),
              )
            : [],
          findings: [],
        };
      }),
    });
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "report.interim-downloaded",
        resourceType: "case",
        resourcePublicId: casePublicId,
        afterJson: JSON.stringify({
          caseNumber: row.caseNumber,
          checksReported: row.checks.filter(
            (check) => check.result && DONE.includes(check.status),
          ).length,
        }),
      },
    });
    return new StreamableFile(pdf, {
      type: "application/pdf",
      disposition: `attachment; filename="Sapling-Global-interim-${row.caseNumber}.pdf"`,
    });
  }
}
