import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import type { Prisma } from "../generated/prisma/client";
import type {
  VendorDocumentReviewDto,
  VendorOnboardingQueryDto,
  VendorRejectDto,
} from "./dto/vendor-onboarding.dto";
import { safeFileName, vendorAudit } from "./vendor-onboarding.service";

const VENDOR_STATUSES = [
  "PENDING_UPLOAD",
  "PENDING_REVIEW",
  "REJECTED",
  "APPROVED",
];

/** What the Ops review screen shows: no internal ids, storage paths or IP addresses. */
const detailSelect = {
  publicId: true,
  businessName: true,
  businessType: true,
  registrationNumber: true,
  taxId: true,
  websiteUrl: true,
  operatingAddress: true,
  verificationStatus: true,
  rejectionReason: true,
  reviewedAt: true,
  submittedAt: true,
  authorisedSignatory: true,
  termsAcceptedAt: true,
  termsVersion: true,
  privacyVersion: true,
  createdAt: true,
  vendorUser: {
    select: { displayName: true, email: true, phone: true, createdAt: true },
  },
  reviewedBy: { select: { displayName: true, email: true } },
  documents: {
    select: {
      publicId: true,
      documentType: true,
      status: true,
      rejectionReason: true,
      verifiedAt: true,
      verifiedBy: { select: { displayName: true } },
      revisions: {
        orderBy: { revisionNumber: "desc" },
        select: {
          publicId: true,
          revisionNumber: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          uploadedAt: true,
          status: true,
          decisionReason: true,
          decidedAt: true,
        },
      },
    },
  },
} satisfies Prisma.VendorProfileSelect;

@Injectable()
export class VendorOnboardingOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalObjectStorageService,
  ) {}

  async listForOperations(actor: Actor, query: VendorOnboardingQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.VendorProfileWhereInput = {
      tenantId: actor.tenantId,
      ...(query.status && VENDOR_STATUSES.includes(query.status)
        ? { verificationStatus: query.status }
        : {}),
      ...(search ? { businessName: { contains: search } } : {}),
    };

    const [profiles, groupedCounts] = await Promise.all([
      this.prisma.vendorProfile.findMany({
        where,
        select: {
          publicId: true,
          businessName: true,
          businessType: true,
          verificationStatus: true,
          submittedAt: true,
          createdAt: true,
          reviewedAt: true,
          vendorUser: {
            select: { displayName: true, email: true, phone: true },
          },
          documents: { select: { status: true } },
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
    const pendingUpload = statusMap.get("PENDING_UPLOAD") ?? 0;

    return {
      items: profiles.map(({ vendorUser, documents, ...profile }) => ({
        ...profile,
        contact: vendorUser,
        documentsCount: documents.length,
        verifiedDocumentsCount: documents.filter((d) => d.status === "VERIFIED")
          .length,
      })),
      counts: {
        pendingReview,
        approved: statusMap.get("APPROVED") ?? 0,
        rejected: statusMap.get("REJECTED") ?? 0,
        pendingUpload,
        onboarding: pendingReview + pendingUpload,
        all: total,
      },
    };
  }

  async detailForOperations(actor: Actor, vendorProfileId: string) {
    const profile = await this.prisma.vendorProfile.findFirst({
      where: { publicId: vendorProfileId, tenantId: actor.tenantId },
      select: detailSelect,
    });
    if (!profile) throw new NotFoundException("Vendor profile not found");
    return profile;
  }

  async downloadDocForOperations(
    actor: Actor,
    vendorProfileId: string,
    docId: string,
  ) {
    const { rev } = await this.latestRevision(actor, vendorProfileId, docId);
    const stored = await this.storage.get(rev.storageKey);
    return new StreamableFile(stored, {
      type: rev.mimeType,
      disposition: `inline; filename="${safeFileName(rev.fileName)}"`,
    });
  }

  async reviewDocument(
    actor: Actor,
    vendorProfileId: string,
    docId: string,
    input: VendorDocumentReviewDto,
  ) {
    const reason = input.rejectionReason?.trim() ?? "";
    if (input.decision === "REJECT" && reason.length < 5)
      throw new BadRequestException(
        "Tell the vendor why the document is rejected",
      );
    const { profile, doc, rev } = await this.latestRevision(
      actor,
      vendorProfileId,
      docId,
    );
    if (profile.verificationStatus === "APPROVED")
      throw new ConflictException("This vendor is already approved");
    const now = new Date();
    const accepted = input.decision === "ACCEPT";

    return this.prisma.$transaction(async (tx) => {
      await tx.vendorDocumentRevision.update({
        where: { id: rev.id },
        data: {
          status: accepted ? "ACCEPTED" : "REJECTED",
          decisionReason: accepted ? null : reason,
          decidedAt: now,
          decidedById: actor.userId,
        },
      });
      const updated = await tx.vendorDocument.update({
        where: { id: doc.id },
        data: {
          status: accepted ? "VERIFIED" : "REJECTED",
          rejectionReason: accepted ? null : reason,
          verifiedAt: accepted ? now : null,
          verifiedById: accepted ? actor.userId : null,
        },
        select: {
          publicId: true,
          documentType: true,
          status: true,
          rejectionReason: true,
        },
      });
      await vendorAudit(
        tx,
        actor,
        profile.publicId,
        accepted ? "vendor.document-accepted" : "vendor.document-rejected",
        {
          documentType: doc.documentType,
          revisionNumber: rev.revisionNumber,
          ...(accepted ? {} : { reason }),
        },
      );
      return updated;
    });
  }

  /**
   * Any ONE verified business document is enough; a rejected one beside it (for example
   * an unclear PAN when the GST certificate is fine) does not block approval.
   */
  async approveVendor(actor: Actor, vendorProfileId: string) {
    const profile = await this.prisma.vendorProfile.findFirst({
      where: { publicId: vendorProfileId, tenantId: actor.tenantId },
      select: {
        id: true,
        publicId: true,
        vendorUserId: true,
        verificationStatus: true,
        documents: { select: { documentType: true, status: true } },
      },
    });
    if (!profile) throw new NotFoundException("Vendor profile not found");
    if (profile.verificationStatus === "APPROVED")
      throw new ConflictException("This vendor is already approved");
    const verified = profile.documents.filter((d) => d.status === "VERIFIED");
    if (!verified.length) {
      throw new BadRequestException(
        "Accept at least one business document before approving the vendor.",
      );
    }
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.vendorProfile.updateMany({
        where: {
          id: profile.id,
          verificationStatus: profile.verificationStatus,
        },
        data: {
          verificationStatus: "APPROVED",
          reviewedAt: now,
          reviewedById: actor.userId,
          rejectionReason: null,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          "The vendor changed meanwhile; refresh and try again",
        );
      await vendorAudit(tx, actor, profile.publicId, "vendor.approved", {
        from: profile.verificationStatus,
        verifiedDocuments: verified.map((d) => d.documentType),
      });
      await tx.notification.create({
        data: {
          tenantId: actor.tenantId,
          userId: profile.vendorUserId,
          type: "VENDOR_APPROVED",
          title: "Your vendor account is approved",
          body: "You can now see and pick verification work.",
          href: "/vendor",
        },
      });
      return {
        publicId: profile.publicId,
        verificationStatus: "APPROVED",
        reviewedAt: now,
      };
    });
  }

  async rejectVendor(
    actor: Actor,
    vendorProfileId: string,
    input: VendorRejectDto,
  ) {
    const reason = input.rejectionReason.trim();
    if (reason.length < 5)
      throw new BadRequestException("Tell the vendor what to fix");
    const profile = await this.prisma.vendorProfile.findFirst({
      where: { publicId: vendorProfileId, tenantId: actor.tenantId },
      select: {
        id: true,
        publicId: true,
        vendorUserId: true,
        verificationStatus: true,
      },
    });
    if (!profile) throw new NotFoundException("Vendor profile not found");
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.vendorProfile.update({
        where: { id: profile.id },
        data: {
          verificationStatus: "REJECTED",
          reviewedAt: now,
          reviewedById: actor.userId,
          rejectionReason: reason,
        },
      });
      await vendorAudit(tx, actor, profile.publicId, "vendor.rejected", {
        from: profile.verificationStatus,
        reason,
      });
      await tx.notification.create({
        data: {
          tenantId: actor.tenantId,
          userId: profile.vendorUserId,
          type: "VENDOR_REJECTED",
          title: "Your vendor application needs changes",
          body: reason,
          href: "/vendor/onboarding",
        },
      });
      return {
        publicId: profile.publicId,
        verificationStatus: "REJECTED",
        reviewedAt: now,
      };
    });
  }

  private async latestRevision(
    actor: Actor,
    vendorProfileId: string,
    docId: string,
  ) {
    const profile = await this.prisma.vendorProfile.findFirst({
      where: { publicId: vendorProfileId, tenantId: actor.tenantId },
      select: { id: true, publicId: true, verificationStatus: true },
    });
    if (!profile) throw new NotFoundException("Vendor profile not found");
    const doc = await this.prisma.vendorDocument.findFirst({
      where: { publicId: docId, vendorProfileId: profile.id },
      select: {
        id: true,
        documentType: true,
        revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
      },
    });
    const rev = doc?.revisions[0];
    if (!doc || !rev) throw new NotFoundException("Document not found");
    return { profile, doc, rev };
  }
}
