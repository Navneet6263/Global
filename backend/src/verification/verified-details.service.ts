import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { INITIATION_FORMS } from "../workflow/initiation-fields";
import { VerificationMethodsService } from "./verification-methods.service";
import { stopSourceEmails } from "./source-email.service";
import {
  checkStatusLabel,
  cleanVerified,
  verifiedFormFor,
} from "./verified-fields";

const entriesOf = (json: string | null | undefined) => {
  try {
    const parsed = JSON.parse(json ?? "") as {
      entries?: Array<Record<string, string>>;
    };
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
};

/**
 * LHS vs RHS for one check (BGV process): the verifier sees what Data Entry recorded
 * (LHS) and records what the source confirmed (RHS). Audited without the values.
 */
@Injectable()
export class VerifiedDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly methods: VerificationMethodsService,
  ) {}

  async get(actor: Actor, checkId: string) {
    const check = await this.methods.check(actor, checkId);
    const row = await this.prisma.caseCheck.findUniqueOrThrow({
      where: { id: check.id },
      select: {
        type: true,
        result: true,
        disposition: true,
        initiationJson: true,
        verifiedJson: true,
        verifiedAt: true,
      },
    });
    return {
      checkId,
      type: row.type,
      statusLabel: checkStatusLabel(row.type, row.result, row.disposition),
      lhs: {
        form: INITIATION_FORMS[row.type.toUpperCase()] ?? null,
        entries: entriesOf(row.initiationJson),
      },
      rhs: {
        form: verifiedFormFor(row.type),
        entries: entriesOf(row.verifiedJson),
        verifiedAt: row.verifiedAt,
      },
    };
  }

  async save(
    actor: Actor,
    checkId: string,
    entries: Array<Record<string, unknown>>,
  ) {
    const check = await this.methods.check(actor, checkId, true);
    const clean = cleanVerified(check.type, entries);
    const verifiedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.caseCheck.findUniqueOrThrow({
        where: { id: check.id },
        select: { verifiedAt: true },
      });
      await tx.caseCheck.update({
        where: { id: check.id },
        data: {
          verifiedJson: JSON.stringify({ entries: clean }),
          verifiedAt,
          verifiedById: actor.userId,
        },
      });
      await stopSourceEmails(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        where: { checkId: check.id },
        reason: "Verified details recorded",
        casePublicId: check.case.publicId,
        checkId,
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: before.verifiedAt
            ? "check.verified-details-updated"
            : "check.verified-details-recorded",
          resourceType: "check",
          resourcePublicId: checkId,
          afterJson: JSON.stringify({
            caseNumber: check.case.caseNumber,
            checkType: check.type,
            entries: clean.length,
            fields: [...new Set(clean.flatMap((entry) => Object.keys(entry)))],
          }),
        },
      });
    });
    return { checkId, verifiedAt, entries: clean };
  }
}
