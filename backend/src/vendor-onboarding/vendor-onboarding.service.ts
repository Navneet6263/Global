import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import type { UploadedBinary } from "../common/http/uploaded-binary";
import { PrismaService } from "../database/prisma.service";
import { ContentInspectionService } from "../documents/content-inspection.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import { assertMainVendor, isMainVendor } from "../vendor-requests/services/vendor-scope";
import type {
  VendorDocumentType,
  VendorProfileUpdateDto,
} from "./dto/vendor-onboarding.dto";

const ALLOWED_DOC_TYPES: VendorDocumentType[] = [
  "COMPANY_PAN",
  "GST_CERTIFICATE",
  "BUSINESS_REGISTRATION",
];

@Injectable()
export class VendorOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inspection: ContentInspectionService,
    private readonly storage: LocalObjectStorageService,
  ) {}

  async mine(actor: Actor) {
    const profile = await this.getActorProfile(actor);
    const documents = await this.prisma.vendorDocument.findMany({
      where: { vendorProfileId: profile.id },
      include: {
        revisions: { orderBy: { revisionNumber: "desc" }, take: 5 },
      },
    });

    const isMain = isMainVendor(actor);

    return {
      profile: {
        publicId: profile.publicId,
        businessName: profile.businessName,
        businessType: profile.businessType,
        registrationNumber: profile.registrationNumber,
        taxId: profile.taxId,
        websiteUrl: profile.websiteUrl,
        operatingAddress: profile.operatingAddress,
        verificationStatus: profile.verificationStatus,
        rejectionReason: profile.rejectionReason,
        reviewedAt: profile.reviewedAt,
        submittedAt: profile.submittedAt,
        termsVersion: profile.termsVersion,
        termsAcceptedAt: profile.termsAcceptedAt,
      },
      isMainVendor: isMain,
      documents: documents.map((doc) => ({
        publicId: doc.publicId,
        documentType: doc.documentType,
        status: doc.status,
        rejectionReason: doc.rejectionReason,
        verifiedAt: doc.verifiedAt,
        latestRevision: doc.revisions[0]
          ? {
              publicId: doc.revisions[0].publicId,
              revisionNumber: doc.revisions[0].revisionNumber,
              fileName: doc.revisions[0].fileName,
              fileSize: doc.revisions[0].fileSize,
              uploadedAt: doc.revisions[0].uploadedAt,
              status: doc.revisions[0].status,
              decisionReason: doc.revisions[0].decisionReason,
            }
          : null,
      })),
      canSubmit:
        isMain &&
        ["PENDING_UPLOAD", "REJECTED"].includes(profile.verificationStatus) &&
        documents.some((d) => d.revisions.length > 0),
    };
  }

  async uploadDocument(actor: Actor, documentType: VendorDocumentType, file: UploadedBinary) {
    assertMainVendor(actor);
    if (!ALLOWED_DOC_TYPES.includes(documentType)) {
      throw new BadRequestException("Invalid document type. Must be Company PAN, GSTIN, or Business Registration.");
    }

    const profile = await this.getActorProfile(actor);
    if (!["PENDING_UPLOAD", "REJECTED"].includes(profile.verificationStatus)) {
      throw new ConflictException("Documents cannot be uploaded while under review or already approved.");
    }

    await this.inspection.inspect(file, 10_485_760, { documentType: "OTHER" });

    const key = `${actor.tenantPublicId}/vendor-onboarding/${profile.publicId}/${documentType}/${randomUUID()}`;
    await this.storage.put(key, file.buffer);

    return this.prisma.$transaction(async (tx) => {
      let doc = await tx.vendorDocument.findUnique({
        where: {
          vendorProfileId_documentType: {
            vendorProfileId: profile.id,
            documentType,
          },
        },
      });

      if (!doc) {
        doc = await tx.vendorDocument.create({
          data: {
            tenantId: actor.tenantId,
            vendorProfileId: profile.id,
            documentType,
            status: "PENDING",
          },
        });
      } else {
        await tx.vendorDocument.update({
          where: { id: doc.id },
          data: { status: "PENDING", rejectionReason: null },
        });
      }

      const latestRev = await tx.vendorDocumentRevision.findFirst({
        where: { vendorDocumentId: doc.id },
        orderBy: { revisionNumber: "desc" },
      });

      await tx.vendorDocumentRevision.updateMany({
        where: { vendorDocumentId: doc.id, status: "PENDING" },
        data: { status: "SUPERSEDED" },
      });

      const revisionNumber = (latestRev?.revisionNumber ?? 0) + 1;

      const createdRev = await tx.vendorDocumentRevision.create({
        data: {
          vendorDocumentId: doc.id,
          revisionNumber,
          storageKey: key,
          fileName: file.originalName.slice(0, 255),
          fileSize: file.size,
          mimeType: file.mimetype,
          status: "PENDING",
        },
      });

      return {
        documentPublicId: doc.publicId,
        revisionNumber: createdRev.revisionNumber,
        fileName: createdRev.fileName,
      };
    });
  }

  async downloadOwnDocument(actor: Actor, docId: string) {
    if (!isMainVendor(actor)) {
      throw new ForbiddenException("Only the primary vendor business owner can download sensitive business documents");
    }

    const profile = await this.getActorProfile(actor);
    const doc = await this.prisma.vendorDocument.findFirst({
      where: { publicId: docId, vendorProfileId: profile.id },
      include: {
        revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
      },
    });

    if (!doc || !doc.revisions[0]) {
      throw new NotFoundException("Document not found");
    }

    const rev = doc.revisions[0];
    const stored = await this.storage.get(rev.storageKey);
    return new StreamableFile(stored, {
      type: rev.mimeType,
      disposition: `inline; filename="${rev.fileName}"`,
    });
  }

  async submit(actor: Actor) {
    assertMainVendor(actor);
    const profile = await this.getActorProfile(actor);

    const uploadedDocsCount = await this.prisma.vendorDocument.count({
      where: {
        vendorProfileId: profile.id,
        revisions: { some: {} },
      },
    });

    if (uploadedDocsCount < 1) {
      throw new BadRequestException(
        "Please upload at least one legal business document (Company PAN, GSTIN, or Business Registration) to submit.",
      );
    }

    await this.prisma.vendorProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: "PENDING_REVIEW",
        submittedAt: new Date(),
        rejectionReason: null,
      },
    });

    return { success: true, message: "Onboarding application submitted for review" };
  }

  async updateProfile(actor: Actor, input: VendorProfileUpdateDto) {
    assertMainVendor(actor);
    const profile = await this.getActorProfile(actor);
    return this.prisma.vendorProfile.update({
      where: { id: profile.id },
      data: {
        registrationNumber: input.registrationNumber?.trim() || null,
        taxId: input.taxId?.trim() || null,
        websiteUrl: input.websiteUrl?.trim() || null,
        operatingAddress: input.operatingAddress?.trim() || null,
      },
    });
  }

  private async getActorProfile(actor: Actor) {
    const effectiveVendorUserId = actor.vendorOwnerId ?? actor.userId;
    const profile = await this.prisma.vendorProfile.findUnique({
      where: { vendorUserId: effectiveVendorUserId },
    });
    if (!profile) {
      throw new NotFoundException("Vendor onboarding profile not found");
    }
    return profile;
  }
}
