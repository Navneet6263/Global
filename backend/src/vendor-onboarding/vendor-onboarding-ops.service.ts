import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import type {
  VendorDocumentReviewDto,
  VendorOnboardingQueryDto,
  VendorRejectDto,
} from "./dto/vendor-onboarding.dto";

@Injectable()
export class VendorOnboardingOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalObjectStorageService,
  ) {}

  async listForOperations(actor: Actor, query: VendorOnboardingQueryDto) {
    const where: any = { tenantId: actor.tenantId };
    if (query.status && query.status !== "ALL") {
      where.verificationStatus = query.status;
    }
    if (query.search?.trim()) {
      where.businessName = { contains: query.search.trim() };
    }

    const [profiles, groupedCounts] = await Promise.all([
      this.prisma.vendorProfile.findMany({
        where,
        include: {
          vendorUser: { select: { displayName: true, email: true, phone: true } },
          documents: {
            select: { documentType: true, status: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.vendorProfile.groupBy({
        by: ["verificationStatus"],
        where: { tenantId: actor.tenantId },
        _count: { id: true },
      }),
    ]);

    const statusMap = new Map<string, number>();
    let total = 0;
    for (const g of groupedCounts) {
      statusMap.set(g.verificationStatus, g._count.id);
      total += g._count.id;
    }
    const pendingReview = statusMap.get("PENDING_REVIEW") ?? 0;
    const approved = statusMap.get("APPROVED") ?? 0;
    const rejected = statusMap.get("REJECTED") ?? 0;
    const pendingUpload = statusMap.get("PENDING_UPLOAD") ?? 0;

    const items = profiles.map((p) => ({
      publicId: p.publicId,
      businessName: p.businessName,
      businessType: p.businessType,
      verificationStatus: p.verificationStatus,
      submittedAt: p.submittedAt,
      createdAt: p.createdAt,
      reviewedAt: p.reviewedAt,
      contact: p.vendorUser,
      documentsCount: p.documents.length,
      verifiedDocumentsCount: p.documents.filter((d) => d.status === "VERIFIED").length,
    }));

    return {
      items,
      counts: {
        pendingReview,
        approved,
        rejected,
        pendingUpload,
        onboarding: pendingReview + pendingUpload,
        all: total,
      },
    };
  }

  async detailForOperations(actor: Actor, vendorProfileId: string) {
    const profile = await this.prisma.vendorProfile.findFirst({
      where: { publicId: vendorProfileId, tenantId: actor.tenantId },
      include: {
        vendorUser: { select: { displayName: true, email: true, phone: true, createdAt: true } },
        reviewedBy: { select: { displayName: true, email: true } },
        documents: {
          include: {
            revisions: { orderBy: { revisionNumber: "desc" } },
            verifiedBy: { select: { displayName: true } },
          },
        },
      },
    });
    if (!profile) throw new NotFoundException("Vendor profile not found");
    return profile;
  }

  async downloadDocForOperations(actor: Actor, vendorProfileId: string, docId: string) {
    const profile = await this.prisma.vendorProfile.findFirst({
      where: { publicId: vendorProfileId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException("Vendor profile not found");

    const doc = await this.prisma.vendorDocument.findFirst({
      where: { publicId: docId, vendorProfileId: profile.id },
      include: {
        revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
      },
    });
    if (!doc || !doc.revisions[0]) throw new NotFoundException("Document not found");

    const rev = doc.revisions[0];
    const stored = await this.storage.get(rev.storageKey);
    return new StreamableFile(stored, {
      type: rev.mimeType,
      disposition: `inline; filename="${rev.fileName}"`,
    });
  }

  async reviewDocument(actor: Actor, vendorProfileId: string, docId: string, input: VendorDocumentReviewDto) {
    const profile = await this.prisma.vendorProfile.findFirst({
      where: { publicId: vendorProfileId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException("Vendor profile not found");

    const doc = await this.prisma.vendorDocument.findFirst({
      where: { publicId: docId, vendorProfileId: profile.id },
      include: {
        revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
      },
    });
    if (!doc || !doc.revisions[0]) throw new NotFoundException("Document not found");

    const rev = doc.revisions[0];
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.vendorDocumentRevision.update({
        where: { id: rev.id },
        data: {
          status: input.decision === "ACCEPT" ? "ACCEPTED" : "REJECTED",
          decisionReason: input.rejectionReason ?? null,
          decidedAt: now,
          decidedById: actor.userId,
        },
      });

      return tx.vendorDocument.update({
        where: { id: doc.id },
        data: {
          status: input.decision === "ACCEPT" ? "VERIFIED" : "REJECTED",
          rejectionReason: input.decision === "REJECT" ? (input.rejectionReason ?? null) : null,
          verifiedAt: input.decision === "ACCEPT" ? now : null,
          verifiedById: input.decision === "ACCEPT" ? actor.userId : null,
        },
      });
    });
  }

  async approveVendor(actor: Actor, vendorProfileId: string) {
    const profile = await this.prisma.vendorProfile.findFirst({
      where: { publicId: vendorProfileId, tenantId: actor.tenantId },
      include: { documents: true },
    });
    if (!profile) throw new NotFoundException("Vendor profile not found");

    // Any ONE verified document is sufficient
    const hasVerifiedDoc = profile.documents.some((d) => d.status === "VERIFIED");
    if (!hasVerifiedDoc) {
      throw new BadRequestException("At least one business document must be accepted and verified before approving.");
    }

    const hasRejectedDoc = profile.documents.some((d) => d.status === "REJECTED");
    if (hasRejectedDoc) {
      throw new BadRequestException("Cannot approve vendor while one or more documents are marked REJECTED.");
    }

    return this.prisma.vendorProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: actor.userId,
        rejectionReason: null,
      },
    });
  }

  async rejectVendor(actor: Actor, vendorProfileId: string, input: VendorRejectDto) {
    const profile = await this.prisma.vendorProfile.findFirst({
      where: { publicId: vendorProfileId, tenantId: actor.tenantId },
    });
    if (!profile) throw new NotFoundException("Vendor profile not found");

    return this.prisma.vendorProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: actor.userId,
        rejectionReason: input.rejectionReason.trim(),
      },
    });
  }
}
