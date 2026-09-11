import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { clientScope } from "./crm-opportunity.shared";
import type {
  CreateProposalDto,
  ProposalDecisionDto,
} from "./dto/crm-proposal.dto";
import {
  assertProposalDecision,
  proposalTotals,
  validateProposal,
  type ProposalSnapshot,
} from "./crm-proposal.policy";

@Injectable()
export class CrmProposalService {
  constructor(private readonly prisma: PrismaService) {}
  async opportunity(actor: Actor, id: string) {
    const row = await this.prisma.salesOpportunity.findFirst({
      where: { publicId: id, tenantId: actor.tenantId, ...clientScope(actor) },
      select: {
        id: true,
        version: true,
        stage: true,
        companyName: true,
        contactName: true,
      },
    });
    if (!row) throw new NotFoundException("Opportunity not found");
    return row;
  }
  async list(actor: Actor, id: string) {
    const opportunity = await this.opportunity(actor, id);
    const [proposals, catalog] = await Promise.all([
      this.prisma.crmProposal.findMany({
        where: { opportunityId: opportunity.id },
        orderBy: { revision: "desc" },
        take: 50,
        select: {
          publicId: true,
          revision: true,
          status: true,
          validUntil: true,
          version: true,
          snapshotJson: true,
          createdById: true,
          approvedAt: true,
        },
      }),
      this.prisma.servicePackage.findMany({
        where: { tenantId: actor.tenantId, isActive: true },
        select: {
          publicId: true,
          name: true,
          price: true,
          tatHours: true,
          serviceFamily: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);
    return {
      opportunityVersion: opportunity.version,
      stage: opportunity.stage,
      items: proposals.map(
        ({ publicId, snapshotJson, createdById, ...row }) => ({
          id: publicId,
          ...row,
          isAuthor: createdById === actor.userId,
          snapshot: JSON.parse(snapshotJson) as ProposalSnapshot,
        }),
      ),
      catalog: catalog.map(({ publicId, price, ...row }) => ({
        id: publicId,
        ...row,
        price: price === null ? null : Number(price),
      })),
    };
  }
  async create(actor: Actor, id: string, input: CreateProposalDto) {
    const opportunity = await this.opportunity(actor, id);
    if (["WON", "LOST"].includes(opportunity.stage))
      throw new ConflictException(
        "Create proposals while the opportunity is open",
      );
    const validUntil = validateProposal(input);
    return this.prisma.$transaction(async (tx) => {
      const lock = await tx.salesOpportunity.updateMany({
        where: {
          id: opportunity.id,
          version: input.opportunityVersion,
          stage: { notIn: ["WON", "LOST"] },
        },
        data: { version: { increment: 1 } },
      });
      if (!lock.count)
        throw new ConflictException(
          "Opportunity changed; refresh before preparing a proposal",
        );
      const packages = await tx.servicePackage.findMany({
        where: {
          tenantId: actor.tenantId,
          isActive: true,
          publicId: { in: input.lines.map((x) => x.packageId) },
        },
        select: {
          publicId: true,
          name: true,
          serviceFamily: true,
          tatHours: true,
        },
      });
      if (packages.length !== input.lines.length)
        throw new BadRequestException(
          "Select active packages from this workspace",
        );
      const latest = await tx.crmProposal.findFirst({
        where: { opportunityId: opportunity.id },
        orderBy: { revision: "desc" },
        select: { revision: true },
      });
      if ((latest?.revision ?? 0) >= 50)
        throw new BadRequestException(
          "Maximum 50 proposal revisions reached; archive the commercial negotiation through your manager",
        );
      const snapshot: ProposalSnapshot = {
        company: opportunity.companyName,
        contact: opportunity.contactName,
        preparedBy: actor.displayName,
        preparedAt: new Date().toISOString(),
        terms: input.terms.trim(),
        currency: "INR",
        ...proposalTotals(input.lines),
        lines: input.lines.map((line) => {
          const pack = packages.find((p) => p.publicId === line.packageId)!;
          return {
            ...line,
            name: pack.name,
            serviceFamily: pack.serviceFamily,
            tatHours: pack.tatHours,
          };
        }),
      };
      const row = await tx.crmProposal.create({
        data: {
          opportunityId: opportunity.id,
          revision: (latest?.revision ?? 0) + 1,
          createdById: actor.userId,
          validUntil,
          snapshotJson: JSON.stringify(snapshot),
        },
        select: { publicId: true, revision: true },
      });
      await tx.salesActivity.create({
        data: {
          tenantId: actor.tenantId,
          opportunityId: opportunity.id,
          actorUserId: actor.userId,
          type: "UPDATED",
          summary: `Proposal revision ${row.revision} prepared for independent approval`,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "crm.proposal.created",
          resourceType: "sales-opportunity",
          resourcePublicId: id,
          afterJson: JSON.stringify({
            proposalId: row.publicId,
            revision: row.revision,
          }),
        },
      });
      return { id: row.publicId, revision: row.revision };
    });
  }
  async decide(
    actor: Actor,
    id: string,
    proposalId: string,
    input: ProposalDecisionDto,
  ) {
    const opportunity = await this.opportunity(actor, id);
    if (input.evidence.trim().length < 10)
      throw new BadRequestException(
        "Record the decision rationale or actual delivery/acceptance evidence",
      );
    return this.prisma.$transaction(async (tx) => {
      const lock = await tx.salesOpportunity.updateMany({
        where: { id: opportunity.id, version: opportunity.version },
        data: { version: { increment: 1 } },
      });
      if (!lock.count)
        throw new ConflictException("Opportunity changed; refresh");
      const row = await tx.crmProposal.findFirst({
        where: { publicId: proposalId, opportunityId: opportunity.id },
      });
      if (!row) throw new NotFoundException("Proposal not found");
      if (
        ["WON", "LOST"].includes(opportunity.stage) &&
        !["WITHDRAWN", "REJECTED", "DECLINED"].includes(input.status)
      )
        throw new ConflictException("The opportunity is closed");
      assertProposalDecision(row, input.status, actor.userId);
      if (
        input.status === "ACCEPTED" &&
        (await tx.crmProposal.count({
          where: {
            opportunityId: opportunity.id,
            status: "ACCEPTED",
            id: { not: row.id },
          },
        }))
      )
        throw new ConflictException(
          "An accepted proposal already exists for this opportunity",
        );
      const changed = await tx.crmProposal.updateMany({
        where: { id: row.id, version: input.version, status: row.status },
        data: {
          status: input.status,
          version: { increment: 1 },
          ...(input.status === "APPROVED"
            ? { approvedById: actor.userId, approvedAt: new Date() }
            : {}),
        },
      });
      if (!changed.count)
        throw new ConflictException(
          "Proposal changed; refresh before deciding",
        );
      await tx.salesActivity.create({
        data: {
          tenantId: actor.tenantId,
          opportunityId: opportunity.id,
          actorUserId: actor.userId,
          type: "UPDATED",
          summary:
            `Proposal r${row.revision} ${input.status.toLowerCase()}: ${input.evidence.trim()}`.slice(
              0,
              1000,
            ),
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "crm.proposal.decided",
          resourceType: "sales-opportunity",
          resourcePublicId: id,
          afterJson: JSON.stringify({
            proposalId,
            from: row.status,
            to: input.status,
            evidence: input.evidence.trim(),
          }),
        },
      });
      return { status: input.status, version: input.version + 1 };
    });
  }
  async forDownload(actor: Actor, id: string, proposalId: string) {
    const opportunity = await this.opportunity(actor, id);
    const row = await this.prisma.crmProposal.findFirst({
      where: { publicId: proposalId, opportunityId: opportunity.id },
      select: {
        publicId: true,
        status: true,
        revision: true,
        validUntil: true,
        snapshotJson: true,
        approvedAt: true,
      },
    });
    if (!row) throw new NotFoundException("Proposal not found");
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "crm.proposal.downloaded",
        resourceType: "sales-opportunity",
        resourcePublicId: id,
        afterJson: JSON.stringify({ proposalId, revision: row.revision }),
      },
    });
    return {
      ...row,
      snapshot: JSON.parse(row.snapshotJson) as ProposalSnapshot,
    };
  }
}
