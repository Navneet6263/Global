import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ArrayMaxSize, IsArray, IsDateString, IsIn } from "class-validator";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { RequiredDocumentTypes } from "../cases/case-service-plan";

export class UpdatePackageRequirementsDto {
  @IsDateString()
  updatedAt!: string;
  @IsArray()
  @ArrayMaxSize(8)
  @IsIn(RequiredDocumentTypes, { each: true })
  requiredDocuments!: string[];
}

@Injectable()
export class ServicePackagePolicyService {
  constructor(private readonly prisma: PrismaService) {}
  async update(
    actor: Actor,
    publicId: string,
    input: UpdatePackageRequirementsDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.servicePackage.findFirst({
        where: { tenantId: actor.tenantId, publicId },
      });
      if (!row) throw new NotFoundException("Service package not found");
      const result = await tx.servicePackage.updateMany({
        where: { id: row.id, updatedAt: new Date(input.updatedAt) },
        data: {
          requiredDocumentsJson: JSON.stringify([
            ...new Set(input.requiredDocuments),
          ]),
        },
      });
      if (!result.count)
        throw new ConflictException("Package changed; refresh and try again");
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "settings.service-package.requirements-updated",
          resourceType: "service-package",
          resourcePublicId: publicId,
          beforeJson: row.requiredDocumentsJson,
          afterJson: JSON.stringify(input.requiredDocuments),
        },
      });
      return { id: publicId, requiredDocuments: input.requiredDocuments };
    });
  }
}
