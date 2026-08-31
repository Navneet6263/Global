import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import {
  CRM_LEAD_SOURCES,
  type CrmLeadSource,
  type CrmStageProbabilities,
  DEFAULT_CRM_STAGE_PROBABILITIES,
} from "./crm-settings.constants";
import type { UpdateCrmSettingsDto } from "./dto/update-crm-settings.dto";

const settingsSelect = {
  publicId: true,
  newProbability: true,
  qualifiedProbability: true,
  proposalProbability: true,
  negotiationProbability: true,
  wonProbability: true,
  lostProbability: true,
  leadSourcesJson: true,
  version: true,
  updatedAt: true,
} as const;

type SettingsRow = {
  publicId: string;
  newProbability: number;
  qualifiedProbability: number;
  proposalProbability: number;
  negotiationProbability: number;
  wonProbability: number;
  lostProbability: number;
  leadSourcesJson: string;
  version: number;
  updatedAt: Date;
};

@Injectable()
export class CrmSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(actor: Actor) {
    const row = await this.prisma.tenantCrmSettings.findUnique({
      where: { tenantId: actor.tenantId },
      select: settingsSelect,
    });
    return this.present(row, actor.roles.includes("SALES_MANAGER"));
  }

  async resolve(actor: Actor) {
    const settings = await this.get(actor);
    return {
      stageProbabilities: settings.stageProbabilities,
      leadSources: settings.leadSources,
    };
  }

  async update(actor: Actor, input: UpdateCrmSettingsDto) {
    if (!actor.roles.includes("SALES_MANAGER")) {
      throw new ForbiddenException(
        "CRM settings are managed by Sales Managers",
      );
    }
    this.assertProbabilities(input.stageProbabilities);
    const existing = await this.prisma.tenantCrmSettings.findUnique({
      where: { tenantId: actor.tenantId },
      select: { id: true, ...settingsSelect },
    });
    if ((existing?.version ?? 0) !== input.version) {
      throw new ConflictException(
        "CRM settings changed; refresh and try again",
      );
    }
    const data = this.toPersistence(input);
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const saved = existing
          ? await this.updateExisting(tx, existing.id, input.version, data)
          : await tx.tenantCrmSettings.create({
              data: { tenantId: actor.tenantId, ...data },
              select: settingsSelect,
            });
        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: "crm.settings.updated",
            resourceType: "tenant-crm-settings",
            resourcePublicId: saved.publicId,
            beforeJson: existing
              ? JSON.stringify(this.present(existing, true))
              : undefined,
            afterJson: JSON.stringify(this.present(saved, true)),
          },
        });
        return saved;
      });
      return this.present(row, true);
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException(
          "CRM settings changed; refresh and try again",
        );
      }
      throw error;
    }
  }

  private async updateExisting(
    tx: Prisma.TransactionClient,
    id: bigint,
    version: number,
    data: ReturnType<CrmSettingsService["toPersistence"]>,
  ) {
    const updated = await tx.tenantCrmSettings.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count !== 1) {
      throw new ConflictException("CRM settings were updated concurrently");
    }
    return tx.tenantCrmSettings.findUniqueOrThrow({
      where: { id },
      select: settingsSelect,
    });
  }

  private present(row: SettingsRow | null, canEdit: boolean) {
    return {
      id: row?.publicId ?? null,
      stageProbabilities: row
        ? this.probabilities(row)
        : DEFAULT_CRM_STAGE_PROBABILITIES,
      leadSources: row
        ? this.parseLeadSources(row.leadSourcesJson)
        : [...CRM_LEAD_SOURCES],
      version: row?.version ?? 0,
      updatedAt: row?.updatedAt ?? null,
      canEdit,
    };
  }

  private probabilities(row: SettingsRow): CrmStageProbabilities {
    return {
      NEW: row.newProbability,
      QUALIFIED: row.qualifiedProbability,
      PROPOSAL: row.proposalProbability,
      NEGOTIATION: row.negotiationProbability,
      WON: row.wonProbability,
      LOST: row.lostProbability,
    };
  }

  private parseLeadSources(value: string): CrmLeadSource[] {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) return [...CRM_LEAD_SOURCES];
      const allowed = new Set<string>(CRM_LEAD_SOURCES);
      const sources = parsed.filter(
        (item): item is CrmLeadSource =>
          typeof item === "string" && allowed.has(item),
      );
      return sources.length ? [...new Set(sources)] : [...CRM_LEAD_SOURCES];
    } catch {
      return [...CRM_LEAD_SOURCES];
    }
  }

  private assertProbabilities(values: CrmStageProbabilities) {
    if (
      values.QUALIFIED < values.NEW ||
      values.PROPOSAL < values.QUALIFIED ||
      values.NEGOTIATION < values.PROPOSAL
    ) {
      throw new BadRequestException(
        "Open-stage probabilities must increase with pipeline progress",
      );
    }
    if (values.WON !== 100 || values.LOST !== 0) {
      throw new BadRequestException(
        "Won must remain 100% and Lost must remain 0%",
      );
    }
  }

  private toPersistence(input: UpdateCrmSettingsDto) {
    return {
      newProbability: input.stageProbabilities.NEW,
      qualifiedProbability: input.stageProbabilities.QUALIFIED,
      proposalProbability: input.stageProbabilities.PROPOSAL,
      negotiationProbability: input.stageProbabilities.NEGOTIATION,
      wonProbability: 100,
      lostProbability: 0,
      leadSourcesJson: JSON.stringify(input.leadSources),
    };
  }

  private isUniqueConflict(error: unknown) {
    return Boolean(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002",
    );
  }
}
