import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import {
  EXTRA_COST_MAX,
  RELEASABLE_STATUSES,
  parseJsonArray,
  vendorText,
  type VendorCheckStatus,
} from "./vendor-check-rules";
import { notifyQueueVendors } from "./vendor-queue";
import { ownVendorJobs } from "./vendor-work.service";

const WORKING = ["IN_PROGRESS", "RETURNED"];
const MAX_EXTRA_COSTS = 10;

const isMain = (actor: Actor) => actor.vendorOwnerId === undefined;

function assertVendor(actor: Actor) {
  if (!actor.roles.includes("VENDOR"))
    throw new ForbiddenException("Vendor access is required");
}

/**
 * The open vendor queue and the vendor's own review chain:
 * - every approved vendor sees each OPEN check (type, city, pincode, payment, due date,
 *   documents to collect) without the candidate's identity, and the first to pick it gets
 *   it; it can go back to the queue (with a reason) until proof is attached;
 * - a member's finished work goes to the vendor's Team Leader before the case RM;
 * - extra cost lines (amount + reason) wait for the case RM's decision.
 * Every step is audited.
 */
@Injectable()
export class VendorQueueService {
  constructor(private readonly prisma: PrismaService) {}

  async open(actor: Actor, query: { checkType?: string; city?: string }) {
    assertVendor(actor);
    const city = query.city?.trim();
    const type = query.checkType?.trim().toUpperCase();
    const rows = await this.prisma.vendorCheckAssignment.findMany({
      where: {
        tenantId: actor.tenantId,
        status: "OPEN",
        vendorUserId: null,
        ...(city ? { city: { contains: city } } : {}),
        ...(type ? { check: { type } } : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 300,
      select: {
        publicId: true,
        version: true,
        price: true,
        city: true,
        pincode: true,
        dueAt: true,
        note: true,
        createdAt: true,
        releaseCount: true,
        sharedDocumentsJson: true,
        check: { select: { type: true } },
      },
    });
    const shared = rows.map((row) =>
      parseJsonArray<string>(row.sharedDocumentsJson),
    );
    const ids = [...new Set(shared.flat())];
    const documents = ids.length
      ? await this.prisma.document.findMany({
          where: { tenantId: actor.tenantId, publicId: { in: ids } },
          select: { publicId: true, type: true },
        })
      : [];
    const typeOf = new Map(
      documents.map((document) => [document.publicId, document.type]),
    );
    const items = rows.map((row, index) => ({
      id: row.publicId,
      version: row.version,
      checkType: row.check.type,
      price: row.price === null ? null : Number(row.price),
      city: row.city,
      pincode: row.pincode,
      dueAt: row.dueAt,
      postedAt: row.createdAt,
      instructions: row.note,
      returnedTimes: row.releaseCount,
      documents: [
        ...new Set(
          (shared[index] ?? []).flatMap((id) => {
            const documentType = typeOf.get(id);
            return documentType ? [documentType] : [];
          }),
        ),
      ],
    }));
    return {
      items,
      summary: {
        count: items.length,
        value: items.reduce((sum, item) => sum + (item.price ?? 0), 0),
      },
    };
  }

  /** First come, first served: one conditional update, so two vendors can never both win. */
  async pick(actor: Actor, jobId: string, version: number, now = new Date()) {
    assertVendor(actor);
    const owner = actor.vendorOwnerId ?? actor.userId;
    const member = isMain(actor) ? null : actor.userId;
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.vendorCheckAssignment.findFirst({
        where: { tenantId: actor.tenantId, publicId: jobId },
        select: {
          id: true,
          publicId: true,
          status: true,
          assignedById: true,
          case: { select: { caseNumber: true } },
          check: { select: { type: true } },
        },
      });
      if (
        !row ||
        row.status === "PENDING_APPROVAL" ||
        row.status === "REJECTED"
      )
        throw new NotFoundException("Check not found");
      if (row.status !== "OPEN")
        throw new ConflictException(
          "Another vendor has already picked this check",
        );
      const changed = await tx.vendorCheckAssignment.updateMany({
        where: { id: row.id, status: "OPEN", vendorUserId: null, version },
        data: {
          vendorUserId: owner,
          handlerUserId: member,
          status: "IN_PROGRESS",
          pickedAt: now,
          acceptedAt: now,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          "Another vendor picked this check just now; refresh the queue",
        );
      const vendor = await tx.user.findUnique({
        where: { id: owner },
        select: { displayName: true },
      });
      await tx.notification.create({
        data: {
          tenantId: actor.tenantId,
          userId: row.assignedById,
          type: "VENDOR_CHECK_UPDATE",
          title: `Picked from the queue: ${row.case.caseNumber}`,
          body: `${vendor?.displayName ?? "A vendor"} · ${readable(row.check.type)}`,
          href: "/operations/vendor-work",
        },
      });
      await this.audit(tx, actor, row.publicId, "vendor_check.picked", {
        caseNumber: row.case.caseNumber,
        checkType: row.check.type,
        ...(member ? { pickedByMember: true } : {}),
      });
      return { id: row.publicId, status: "IN_PROGRESS", version: version + 1 };
    });
  }

  /** Back to the open queue for every vendor, with a reason, until proof is attached. */
  async release(
    actor: Actor,
    jobId: string,
    input: { version: number; reason: string },
  ) {
    const reason = vendorText(input.reason, "Reason for returning it", 10);
    return this.prisma.$transaction(async (tx) => {
      const row = await this.own(tx, actor, jobId);
      if (!row.pickedAt)
        throw new ConflictException(
          "This check was sent to you directly; decline it instead",
        );
      if (!RELEASABLE_STATUSES.includes(row.status as VendorCheckStatus))
        throw new ConflictException(
          "Only a check you are still working on can go back to the queue",
        );
      if (row._count.evidence)
        throw new ConflictException(
          "Remove the proof you uploaded before returning it to the queue",
        );
      const changed = await tx.vendorCheckAssignment.updateMany({
        where: {
          id: row.id,
          version: input.version,
          status: { in: [...RELEASABLE_STATUSES] },
        },
        data: {
          status: "OPEN",
          vendorUserId: null,
          handlerUserId: null,
          submissionJson: null,
          result: null,
          remarks: null,
          acceptedAt: null,
          pickedAt: null,
          releaseCount: { increment: 1 },
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException("Changed meanwhile; refresh and try again");
      await tx.vendorExtraCost.deleteMany({
        where: { assignmentId: row.id, status: "PENDING" },
      });
      await tx.notification.create({
        data: {
          tenantId: actor.tenantId,
          userId: row.assignedById,
          type: "VENDOR_CHECK_UPDATE",
          title: `Returned to the vendor queue: ${row.case.caseNumber}`,
          body: reason,
          href: "/operations/vendor-work",
        },
      });
      await notifyQueueVendors(tx, actor.tenantId, {
        checkType: row.check.type,
        city: row.city,
        price: row.price === null ? null : Number(row.price),
      });
      await this.audit(tx, actor, row.publicId, "vendor_check.released", {
        caseNumber: row.case.caseNumber,
        checkType: row.check.type,
        reason,
      });
      return { id: row.publicId, status: "OPEN", version: input.version + 1 };
    });
  }

  /** The vendor's Team Leader (main account) approves a member's work or sends it back. */
  async teamReview(
    actor: Actor,
    jobId: string,
    input: { version: number; decision: "APPROVE" | "RETURN"; note?: string },
    now = new Date(),
  ) {
    if (!isMain(actor))
      throw new ForbiddenException(
        "Your vendor's Team Leader reviews the team's work",
      );
    const approve = input.decision === "APPROVE";
    const note = approve
      ? input.note?.trim() || null
      : vendorText(input.note, "What to fix", 10);
    return this.prisma.$transaction(async (tx) => {
      const row = await this.own(tx, actor, jobId);
      if (row.status !== "TEAM_REVIEW")
        throw new ConflictException(
          "This check is not waiting for your review",
        );
      const changed = await tx.vendorCheckAssignment.updateMany({
        where: { id: row.id, version: input.version, status: "TEAM_REVIEW" },
        data: approve
          ? {
              status: "SUBMITTED",
              submittedAt: now,
              teamReviewedAt: now,
              teamReviewedById: actor.userId,
              version: { increment: 1 },
            }
          : {
              status: "IN_PROGRESS",
              reviewNote: note,
              version: { increment: 1 },
            },
      });
      if (changed.count !== 1)
        throw new ConflictException("Changed meanwhile; refresh and try again");
      if (approve)
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: row.assignedById,
            type: "VENDOR_CHECK_UPDATE",
            title: `Vendor result ready to review: ${row.case.caseNumber}`,
            body: `${readable(row.check.type)}${row._count.extraCosts ? " · with extra cost to decide" : ""}`,
            href: "/operations/vendor-work",
          },
        });
      else if (row.handlerUserId)
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: row.handlerUserId,
            type: "VENDOR_CHECK_RETURNED",
            title: `Your Team Leader sent it back: ${row.case.caseNumber}`,
            body: note ?? "",
            href: "/vendor/checks",
          },
        });
      await this.audit(
        tx,
        actor,
        row.publicId,
        approve ? "vendor_check.team-approved" : "vendor_check.team-returned",
        { caseNumber: row.case.caseNumber, ...(note ? { note } : {}) },
      );
      return {
        id: row.publicId,
        status: approve ? "SUBMITTED" : "IN_PROGRESS",
        version: input.version + 1,
      };
    });
  }

  /** An extra cost (travel, fees...) with a reason, for the case RM to approve. */
  async addExtraCost(
    actor: Actor,
    jobId: string,
    input: { amount: number; reason: string },
  ) {
    const amount = Math.round(Number(input.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > EXTRA_COST_MAX)
      throw new BadRequestException(
        `Enter an amount between ₹1 and ₹${EXTRA_COST_MAX.toLocaleString("en-IN")}`,
      );
    const reason = vendorText(
      input.reason,
      "Why the extra cost was needed",
      10,
    );
    return this.prisma.$transaction(async (tx) => {
      const row = await this.own(tx, actor, jobId);
      if (!WORKING.includes(row.status))
        throw new ConflictException(
          "Add extra cost while you work on the check",
        );
      if (row._count.extraCosts >= MAX_EXTRA_COSTS)
        throw new ConflictException(
          `At most ${MAX_EXTRA_COSTS} extra cost lines`,
        );
      const created = await tx.vendorExtraCost.create({
        data: {
          tenantId: actor.tenantId,
          assignmentId: row.id,
          amount,
          reason,
          createdById: actor.userId,
        },
        select: { publicId: true, createdAt: true },
      });
      await this.audit(
        tx,
        actor,
        row.publicId,
        "vendor_check.extra-cost-added",
        {
          costId: created.publicId,
          amount,
          reason,
        },
      );
      return {
        id: created.publicId,
        amount,
        reason,
        status: "PENDING",
        addedAt: created.createdAt,
      };
    });
  }

  async removeExtraCost(actor: Actor, jobId: string, costId: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.own(tx, actor, jobId);
      if (!WORKING.includes(row.status))
        throw new ConflictException(
          "Extra cost can change only while you work on it",
        );
      const removed = await tx.vendorExtraCost.deleteMany({
        where: { publicId: costId, assignmentId: row.id, status: "PENDING" },
      });
      if (removed.count !== 1)
        throw new NotFoundException("Extra cost not found");
      await this.audit(
        tx,
        actor,
        row.publicId,
        "vendor_check.extra-cost-removed",
        {
          costId,
        },
      );
      return { id: costId, removed: true };
    });
  }

  private async own(tx: Prisma.TransactionClient, actor: Actor, jobId: string) {
    const row = await tx.vendorCheckAssignment.findFirst({
      where: { ...ownVendorJobs(actor), publicId: jobId },
      select: {
        id: true,
        publicId: true,
        status: true,
        version: true,
        pickedAt: true,
        price: true,
        city: true,
        assignedById: true,
        handlerUserId: true,
        case: { select: { caseNumber: true } },
        check: { select: { type: true } },
        _count: {
          select: {
            evidence: true,
            extraCosts: { where: { status: "PENDING" } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException("Check not found");
    return row;
  }

  private audit(
    db: Prisma.TransactionClient,
    actor: Actor,
    jobId: string,
    action: string,
    after: Record<string, unknown>,
  ) {
    return db.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action,
        resourceType: "vendor_check",
        resourcePublicId: jobId,
        afterJson: JSON.stringify(after),
      },
    });
  }
}

const readable = (value: string) => value.replaceAll("_", " ").toLowerCase();
