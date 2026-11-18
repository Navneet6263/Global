import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import { hashPassword } from "../auth/password";
import {
  assertEmailAvailable,
  insertUserAccount,
  resolveRoles,
} from "../users/user-accounts";
import { joinDepartments, personalRoles } from "../users/user-setup";
import type { ParsedTeamMemberPayload } from "./team-member-documents";

const MEMBER_ROLE: Readonly<Record<string, "VERIFIER" | "DATA_ENTRY">> = {
  VERIFICATION: "VERIFIER",
  DATA_ENTRY: "DATA_ENTRY",
};

@Injectable()
export class TeamMemberDocumentsService {
  private readonly logger = new Logger(TeamMemberDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalObjectStorageService,
  ) {}

  private async ledTeams(actor: Actor) {
    const ids = (actor.departments ?? [])
      .filter((d) => d.role === "LEAD" && MEMBER_ROLE[d.kind])
      .map((d) => d.id);
    if (!ids.length) throw new ForbiddenException("This page is for Team Leaders");
    return this.prisma.department.findMany({
      where: { tenantId: actor.tenantId, id: { in: ids }, status: "ACTIVE" },
      select: { id: true, publicId: true, name: true, kind: true },
    });
  }

  async createWithDocuments(actor: Actor, payload: ParsedTeamMemberPayload) {
    const teams = await this.ledTeams(actor);
    const team = teams.find(
      (t) => t.publicId.toLowerCase() === payload.departmentId.toLowerCase(),
    );
    if (!team) {
      throw new ForbiddenException("You can add people only to a team you lead");
    }
    const roleCode = MEMBER_ROLE[team.kind]!;
    const passwordHash = await hashPassword(payload.temporaryPassword);

    // Prepare files to store
    const userScopeId = randomUUID();
    const docsToStore = [
      ...payload.identityFiles.map((file, i) => ({
        category: "IDENTITY" as const,
        slot: i + 1,
        file,
        storageKey: `${actor.tenantId}/team-members/${userScopeId}/identity/${i + 1}-${randomUUID()}`,
        sha256: createHash("sha256").update(file.buffer).digest("hex"),
      })),
      {
        category: "AGREEMENT" as const,
        slot: 1,
        file: payload.agreementFile,
        storageKey: `${actor.tenantId}/team-members/${userScopeId}/agreement/1-${randomUUID()}`,
        sha256: createHash("sha256")
          .update(payload.agreementFile.buffer)
          .digest("hex"),
      },
    ];

    const writtenKeys: string[] = [];
    try {
      for (const item of docsToStore) {
        await this.storage.put(item.storageKey, item.file.buffer);
        writtenKeys.push(item.storageKey);
      }

      return await this.prisma.$transaction(async (tx) => {
        await assertEmailAvailable(tx, actor.tenantId, payload.email);
        const base = await resolveRoles(tx, actor.tenantId, [roleCode]);
        const given = await personalRoles(tx, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          displayName: payload.displayName,
          roles: base,
          access: payload.permissions
            ? [{ role: roleCode, permissions: payload.permissions }]
            : undefined,
        });
        const row = await insertUserAccount(tx, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          email: payload.email,
          displayName: payload.displayName,
          phone: payload.phone,
          passwordHash,
          roles: given.roles,
          branchId: actor.branchId ?? undefined,
          audit: {
            createdVia: "TEAM_LEADER",
            team: team.name,
            documentsCount: docsToStore.length,
            ...(given.created.length ? { personalRoles: given.created } : {}),
          },
        });
        const user = await tx.user.findUniqueOrThrow({
          where: { publicId: row.publicId },
          select: { id: true },
        });
        await joinDepartments(tx, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          user: {
            id: user.id,
            publicId: row.publicId,
            displayName: row.displayName,
          },
          roleCodes: [roleCode],
          departments: [{ id: team.publicId }],
        });

        for (const doc of docsToStore) {
          await tx.teamMemberDocument.create({
            data: {
              tenantId: actor.tenantId,
              userId: user.id,
              category: doc.category,
              slot: doc.slot,
              storageKey: doc.storageKey,
              fileName: doc.file.originalName,
              fileSize: doc.file.size,
              mimeType: doc.file.mimetype,
              sha256: doc.sha256,
              uploadedById: actor.userId,
            },
          });
        }

        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: "team-member.created",
            resourceType: "user",
            resourcePublicId: row.publicId,
            afterJson: JSON.stringify({
              email: row.email,
              team: team.name,
              documents: docsToStore.map((d) => ({
                category: d.category,
                slot: d.slot,
                fileName: d.file.originalName,
                sizeBytes: d.file.size,
              })),
            }),
          },
        });

        const { publicId, ...account } = row;
        return {
          id: publicId,
          ...account,
          roles: [roleCode],
          customAccess: given.created.length > 0,
          team: { id: team.publicId, name: team.name },
        };
      });
    } catch (err) {
      if (writtenKeys.length > 0) {
        try {
          await Promise.allSettled(writtenKeys.map((k) => this.storage.delete(k)));
        } catch (cleanupErr) {
          this.logger.error("Failed to clean up stored files after failure", cleanupErr);
        }
      }
      throw err;
    }
  }

  async listDocuments(actor: Actor, userPublicId: string) {
    const teams = await this.ledTeams(actor);
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: userPublicId,
        departmentMemberships: {
          some: { departmentId: { in: teams.map((t) => t.id) } },
        },
      },
      select: {
        id: true,
        publicId: true,
        teamMemberDocuments: {
          select: {
            publicId: true,
            category: true,
            slot: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            createdAt: true,
          },
          orderBy: [{ category: "asc" }, { slot: "asc" }],
        },
      },
    });
    if (!user) throw new NotFoundException("Team member not found");
    return user.teamMemberDocuments.map((d) => ({
      id: d.publicId,
      category: d.category,
      slot: d.slot,
      fileName: d.fileName,
      fileSize: d.fileSize,
      mimeType: d.mimeType,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  async getDocumentForDownload(
    actor: Actor,
    userPublicId: string,
    docPublicId: string,
  ) {
    const teams = await this.ledTeams(actor);
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: userPublicId,
        departmentMemberships: {
          some: { departmentId: { in: teams.map((t) => t.id) } },
        },
      },
      select: { id: true },
    });
    if (!user) throw new NotFoundException("Team member not found");

    const doc = await this.prisma.teamMemberDocument.findFirst({
      where: {
        tenantId: actor.tenantId,
        userId: user.id,
        publicId: docPublicId,
      },
    });
    if (!doc) throw new NotFoundException("Document not found");

    const stream = await this.storage.openStream(doc.storageKey);
    return {
      stream,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
    };
  }
}
