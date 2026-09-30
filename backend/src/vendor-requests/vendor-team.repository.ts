import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import type { VendorTx } from "./vendor-assignments.repository";

/** A team user as its Main Vendor sees it: no password data, no other vendor's users. */
export const teamMemberSelect = {
  publicId: true,
  displayName: true,
  email: true,
  phone: true,
  status: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  version: true,
  _count: {
    select: { handledVendorRequests: { where: { status: "PENDING" } } },
  },
} as const;

export type TeamMemberRow = Prisma.UserGetPayload<{
  select: typeof teamMemberSelect;
}>;

/** Data access for a Main Vendor's team. Every lookup is keyed on the owner. */
@Injectable()
export class VendorTeamRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: VendorTx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  findOwnerName(tenantId: bigint, ownerId: bigint) {
    return this.prisma.user.findFirst({
      where: { tenantId, id: ownerId },
      select: { displayName: true },
    });
  }

  policy(ownerId: bigint) {
    return this.prisma.vendorTeamPolicy.findUnique({
      where: { vendorUserId: ownerId },
      select: { maxActiveUsers: true },
    });
  }

  members(tenantId: bigint, ownerId: bigint) {
    return this.prisma.user.findMany({
      where: { tenantId, vendorOwnerId: ownerId },
      select: teamMemberSelect,
      orderBy: [{ displayName: "asc" }, { publicId: "asc" }],
      take: 200,
    });
  }

  /** One of this owner's team users; anyone else (or the owner itself) is not found. */
  findMember(
    db: Pick<VendorTx, "user">,
    tenantId: bigint,
    ownerId: bigint,
    memberPublicId: string,
    onlyActive = false,
  ) {
    return db.user.findFirst({
      where: {
        tenantId,
        vendorOwnerId: ownerId,
        publicId: memberPublicId,
        ...(onlyActive ? { status: "ACTIVE" } : {}),
      },
      select: {
        id: true,
        publicId: true,
        displayName: true,
        status: true,
        version: true,
      },
    });
  }

  /** Optimistic status write: only the version the Main Vendor was looking at. */
  setMemberStatus(
    tx: VendorTx,
    member: { id: bigint; version: number },
    status: "ACTIVE" | "SUSPENDED",
  ) {
    return tx.user.updateMany({
      where: { id: member.id, version: member.version },
      data: { status, version: { increment: 1 } },
    });
  }

  recordAudit(tx: VendorTx, data: Prisma.AuditEventUncheckedCreateInput) {
    return tx.auditEvent.create({ data });
  }
}
