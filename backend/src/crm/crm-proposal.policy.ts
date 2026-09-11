import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import type { CreateProposalDto } from "./dto/crm-proposal.dto";

export function proposalTotals(
  lines: Array<{ quantity: number; unitPrice: number; taxRate: number }>,
) {
  let subtotal = 0n,
    tax = 0n;
  for (const line of lines) {
    const price = BigInt(Math.round(line.unitPrice * 100));
    const net = price * BigInt(line.quantity);
    const rate = BigInt(Math.round(line.taxRate * 100));
    subtotal += net;
    tax += (net * rate + 5000n) / 10000n;
  }
  return {
    subtotalPaise: subtotal.toString(),
    taxPaise: tax.toString(),
    totalPaise: (subtotal + tax).toString(),
  };
}
export function validateProposal(input: CreateProposalDto, now = new Date()) {
  const validUntil = new Date(input.validUntil);
  if (
    !Number.isFinite(validUntil.getTime()) ||
    validUntil <= now ||
    validUntil.getTime() > now.getTime() + 180 * 86_400_000
  )
    throw new BadRequestException(
      "Proposal validity must be within the next 180 days",
    );
  if (new Set(input.lines.map((x) => x.packageId)).size !== input.lines.length)
    throw new BadRequestException("Select each package once");
  if (input.terms.trim().length < 10)
    throw new BadRequestException("Commercial terms are required");
  return validUntil;
}
export function assertProposalDecision(
  row: { status: string; createdById: bigint; validUntil: Date },
  target: string,
  actorId: bigint,
  now = new Date(),
) {
  const transitions: Record<string, string[]> = {
    DRAFT: ["APPROVED", "REJECTED", "WITHDRAWN"],
    APPROVED: ["SENT", "WITHDRAWN"],
    SENT: ["ACCEPTED", "DECLINED", "WITHDRAWN"],
  };
  if (!transitions[row.status]?.includes(target))
    throw new ConflictException(
      "This proposal decision is not available from the current status",
    );
  if (target === "APPROVED" && row.createdById === actorId)
    throw new ForbiddenException(
      "A different authorised colleague must approve this proposal",
    );
  if (
    ["APPROVED", "SENT", "ACCEPTED"].includes(target) &&
    row.validUntil <= now
  )
    throw new ConflictException("Proposal expired; create a new revision");
}

export interface ProposalSnapshot {
  company: string;
  contact: string;
  preparedBy: string;
  preparedAt: string;
  terms: string;
  currency: "INR";
  lines: Array<{
    packageId: string;
    name: string;
    serviceFamily: string;
    tatHours: number;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
  subtotalPaise: string;
  taxPaise: string;
  totalPaise: string;
}
