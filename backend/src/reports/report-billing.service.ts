import { ForbiddenException, Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import type { PageQueryDto } from "../common/dto/page-query.dto";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class ReportBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async ready(actor: Actor, query: PageQueryDto) {
    if (
      !actor.roles.some((role) =>
        ["PLATFORM_ADMIN", "FINANCE_MANAGER"].includes(role),
      )
    ) {
      throw new ForbiddenException("Finance access is required");
    }
    const rows = await this.prisma.report.findMany({
      where: {
        tenantId: actor.tenantId,
        workflowVersion: 2,
        status: "PREPARED",
        invoiceLines: { none: { invoice: { status: { not: "CANCELLED" } } } },
        case: {
          status: "PAYMENT_PENDING",
          ...(actor.clientId ? { clientId: actor.clientId } : {}),
          ...(actor.branchId ? { branchId: actor.branchId } : {}),
          ...(query.search
            ? { caseNumber: { contains: query.search.trim() } }
            : {}),
        },
      },
      select: {
        publicId: true,
        currentVersion: true,
        createdAt: true,
        case: {
          select: {
            publicId: true,
            caseNumber: true,
            subject: { select: { fullName: true } },
            servicePackage: { select: { name: true, price: true } },
            client: { select: { publicId: true, displayName: true } },
            services: {
              select: {
                serviceFamily: true,
                unitPrice: true,
                taxRate: true,
                servicePackage: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { publicId: "asc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { publicId: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const items = (hasMore ? rows.slice(0, query.limit) : rows).map((row) => ({
      reportId: row.publicId,
      reportVersion: row.currentVersion,
      preparedAt: row.createdAt,
      caseId: row.case.publicId,
      caseNumber: row.case.caseNumber,
      candidateName: row.case.subject.fullName,
      client: {
        id: row.case.client.publicId,
        displayName: row.case.client.displayName,
      },
      lines: (row.case.services.length
        ? row.case.services
        : row.case.servicePackage
          ? [
              {
                serviceFamily: "HIRECHECK",
                servicePackage: { name: row.case.servicePackage.name },
                unitPrice: row.case.servicePackage.price ?? 0,
                taxRate: 0,
              },
            ]
          : []
      ).map((service) => ({
        caseId: row.case.publicId,
        reportId: row.publicId,
        description: `${service.serviceFamily}: ${service.servicePackage.name}`,
        quantity: 1,
        unitPrice: Number(service.unitPrice),
        taxRate: Number(service.taxRate),
      })),
    }));
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.reportId ?? null) : null,
    };
  }
}
