import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Actor } from "../common/auth/actor";
import type { UploadedBinary } from "../common/http/uploaded-binary";
import { emailDomain, isFreeEmail } from "../common/mail/free-email";
import { queueEmail } from "../common/mail/queue-email";
import { SecretBoxService } from "../common/security/secret-box.service";
import { assertClientActivation } from "../clients/client-activation.policy";
import { ClientAgreementFilesService } from "../clients/client-agreement-files.service";
import { ClientCommercialService } from "../clients/client-commercial.service";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { companyActivity, type ActivityKind } from "./onboarding-activity";
import type {
  OnboardingCommercialDto,
  OnboardingCompanyDto,
  OnboardingDecisionDto,
  OnboardingMessageDto,
  OnboardingQueryDto,
  OnboardingRejectDto,
  OnboardingReviewDto,
  OnboardingSubmitDto,
} from "./dto/onboarding.dto";
import {
  ONBOARDING_DOCUMENTS,
  ONBOARDING_DOCUMENT_TYPES,
  SELF_SIGNUP_KYC_TYPES,
  checklistProgress,
  documentState,
} from "./onboarding-checklist";

const companySelect = {
  id: true,
  publicId: true,
  code: true,
  legalName: true,
  displayName: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  status: true,
  gstin: true,
  pan: true,
  billingAddress: true,
  billingTerms: true,
  version: true,
  selfSignupAt: true,
  onboardingSubmittedAt: true,
  onboardingNote: true,
  primaryRmUserId: true,
  primaryRmAssignedAt: true,
  primaryRm: {
    select: { publicId: true, displayName: true, email: true, phone: true },
  },
  packageRates: {
    where: { servicePackage: { isActive: true } },
    select: {
      active: true,
      unitPrice: true,
      taxRate: true,
      tatHours: true,
      servicePackage: { select: { publicId: true, name: true } },
    },
  },
  agreements: {
    where: { type: { in: [...ONBOARDING_DOCUMENT_TYPES] } },
    orderBy: { createdAt: "desc" as const },
    select: {
      publicId: true,
      type: true,
      signedAt: true,
      expiresAt: true,
      files: {
        orderBy: { revision: "desc" as const },
        take: 1,
        select: {
          publicId: true,
          revision: true,
          status: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          reviewNotes: true,
          reviewedAt: true,
          version: true,
          uploadedBy: { select: { displayName: true } },
        },
      },
    },
  },
} satisfies Prisma.ClientSelect;

type CompanyRow = Prisma.ClientGetPayload<{ select: typeof companySelect }>;

const MANAGER_ROLES = ["OPS_MANAGER"];

/**
 * Self sign-up onboarding. The company admin fills details and uploads documents; the
 * Operations Manager, or the company's assigned RM, reviews documents, sets the contracted
 * packages and activates (or rejects). An RM uses the package list prices and gives a
 * discount only within the package limit Operations set (Client pricing). Platform Admin
 * can see everything but changes nothing. Every step is audited.
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: ClientAgreementFilesService,
    private readonly commercial: ClientCommercialService,
    private readonly secretBox: SecretBoxService,
    private readonly config: ConfigService,
  ) {}

  // ---- Company admin -------------------------------------------------------------

  async mine(actor: Actor) {
    const row = await this.ownCompany(actor);
    return this.present(row, false);
  }

  async updateCompany(actor: Actor, input: OnboardingCompanyDto) {
    const row = await this.ownCompany(actor);
    this.assertOnboarding(row);
    const data = {
      legalName: input.legalName,
      displayName: input.displayName,
      gstin: input.gstin || null,
      pan: input.pan || null,
      billingAddress: input.billingAddress || null,
      contactName: input.contactName || row.contactName,
      contactPhone: input.contactPhone || null,
    };
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.client.updateMany({
        where: { id: row.id, version: input.version, status: "ONBOARDING" },
        data: { ...data, version: { increment: 1 } },
      });
      if (!changed.count)
        throw new ConflictException(
          "Company details changed; refresh and try again",
        );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "client.onboarding.details-updated",
          resourceType: "client",
          resourcePublicId: row.publicId,
          beforeJson: JSON.stringify({
            legalName: row.legalName,
            gstin: row.gstin,
            pan: row.pan,
            billingAddress: row.billingAddress,
          }),
          afterJson: JSON.stringify(data),
        },
      });
    });
    return this.mine(actor);
  }

  async uploadDocument(
    actor: Actor,
    type: string,
    signedOn: string | undefined,
    file: UploadedBinary,
  ) {
    const definition = ONBOARDING_DOCUMENTS.find((row) => row.type === type);
    if (!definition) throw new BadRequestException("Unknown document type");
    const row = await this.ownCompany(actor);
    this.assertOnboarding(row);
    if (documentState(row, type) === "APPROVED")
      throw new ConflictException(
        `${definition.label} is already approved. Ask your RM if it must be replaced.`,
      );
    const signedAt =
      definition.signed && signedOn
        ? new Date(`${signedOn}T00:00:00.000Z`)
        : new Date();
    if (Number.isNaN(signedAt.getTime()) || signedAt > new Date())
      throw new BadRequestException("The signing date cannot be in the future");
    let agreement = row.agreements.find((item) => item.type === type);
    if (!agreement) {
      const created = await this.prisma.clientAgreement.create({
        data: {
          clientId: row.id,
          type,
          reference: `${definition.label} (uploaded by the company)`,
          signedAt,
        },
        select: { publicId: true },
      });
      agreement = {
        publicId: created.publicId,
      } as (typeof row.agreements)[number];
    } else {
      await this.prisma.clientAgreement.updateMany({
        where: { publicId: agreement.publicId, clientId: row.id },
        data: { signedAt },
      });
    }
    const uploaded = await this.files.upload(
      actor,
      row.publicId,
      agreement.publicId,
      file,
    );
    if (row.onboardingSubmittedAt) {
      // A re-upload after review goes straight back to Operations and the RM.
      await this.notifyTeam(actor.tenantId, row, {
        type: "ONBOARDING_DOCUMENT",
        title: "Onboarding document re-uploaded",
        body: `${row.displayName} uploaded ${definition.label} for review.`,
      });
    }
    return { ...uploaded, company: await this.mine(actor) };
  }

  async submit(actor: Actor, input: OnboardingSubmitDto) {
    const row = await this.ownCompany(actor);
    this.assertOnboarding(row);
    const progress = checklistProgress(row);
    if (!progress.clientDone)
      throw new BadRequestException(
        `Complete before submitting: ${progress.missing.join(", ")}`,
      );
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.client.updateMany({
        where: { id: row.id, version: input.version, status: "ONBOARDING" },
        data: { onboardingSubmittedAt: now, version: { increment: 1 } },
      });
      if (!changed.count)
        throw new ConflictException(
          "Company details changed; refresh and try again",
        );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "client.onboarding.submitted",
          resourceType: "client",
          resourcePublicId: row.publicId,
          afterJson: JSON.stringify({
            submittedAt: now,
            note: input.note || null,
          }),
        },
      });
    });
    await this.notifyTeam(actor.tenantId, row, {
      type: "ONBOARDING_SUBMITTED",
      title: "Onboarding ready for review",
      body: `${row.displayName} submitted onboarding documents${input.note ? `: ${input.note}` : "."}`,
    });
    return this.mine(actor);
  }

  async downloadOwn(actor: Actor, agreementId: string, fileId: string) {
    const row = await this.ownCompany(actor);
    return this.files.download(actor, row.publicId, agreementId, fileId);
  }

  // ---- Operations / RM / Platform Admin ------------------------------------------

  async list(actor: Actor, query: OnboardingQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const status = query.status ?? "ONBOARDING";
    const search = query.search?.trim();
    const base: Prisma.ClientWhereInput = {
      ...this.scope(actor),
      selfSignupAt: { not: null },
      ...(status === "ALL" ? {} : { status }),
      ...(search
        ? {
            OR: [
              { displayName: { contains: search } },
              { legalName: { contains: search } },
              { code: { contains: search } },
              { contactEmail: { contains: search } },
              { contactName: { contains: search } },
            ],
          }
        : {}),
    };
    const views: Record<string, Prisma.ClientWhereInput> = {
      ALL: {},
      NEEDS_RM: { primaryRmUserId: null },
      SUBMITTED: { onboardingSubmittedAt: { not: null } },
      IN_PROGRESS: { onboardingSubmittedAt: null },
    };
    const where = { ...base, ...views[query.view ?? "ALL"] };
    const [rows, total, needsRm, submitted, inProgress] = await Promise.all([
      this.prisma.client.findMany({
        where,
        select: companySelect,
        orderBy: [{ onboardingSubmittedAt: "desc" }, { selfSignupAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.count({ where }),
      this.prisma.client.count({ where: { ...base, ...views.NEEDS_RM } }),
      this.prisma.client.count({ where: { ...base, ...views.SUBMITTED } }),
      this.prisma.client.count({ where: { ...base, ...views.IN_PROGRESS } }),
    ]);
    const duplicates = await this.duplicates(actor, rows);
    return {
      items: rows.map((row) => ({
        ...this.summary(row),
        flags: this.flags(row, duplicates.get(row.publicId) ?? []),
      })),
      total,
      page,
      pageSize,
      counts: { all: submitted + inProgress, needsRm, submitted, inProgress },
    };
  }

  /** Paged activity, with the same company scope as the detail view. */
  async activity(
    actor: Actor,
    clientId: string,
    query: { page?: number; pageSize?: number; kind?: ActivityKind },
  ) {
    const row = await this.company(actor, clientId);
    return companyActivity(this.prisma, {
      tenantId: actor.tenantId,
      clientPublicId: row.publicId,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      kind: query.kind,
    });
  }

  async detail(actor: Actor, clientId: string) {
    const row = await this.company(actor, clientId);
    const [duplicates, catalog, timeline] = await Promise.all([
      this.duplicates(actor, [row]),
      this.prisma.servicePackage.findMany({
        where: { tenantId: actor.tenantId, isActive: true },
        select: { publicId: true, name: true, price: true, tatHours: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.auditEvent.findMany({
        where: {
          tenantId: actor.tenantId,
          resourceType: "client",
          resourcePublicId: row.publicId,
        },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          action: true,
          createdAt: true,
          actor: { select: { displayName: true } },
        },
      }),
    ]);
    return {
      ...this.present(row, true),
      flags: this.flags(row, duplicates.get(row.publicId) ?? []),
      rates: row.packageRates.map((rate) => ({
        servicePackageId: rate.servicePackage.publicId,
        name: rate.servicePackage.name,
        unitPrice: Number(rate.unitPrice),
        taxRate: Number(rate.taxRate),
        tatHours: rate.tatHours,
        active: rate.active,
      })),
      catalog: catalog.map((item) => ({
        id: item.publicId,
        name: item.name,
        price: item.price === null ? null : Number(item.price),
        tatHours: item.tatHours,
      })),
      timeline: timeline.map((event) => ({
        action: event.action,
        at: event.createdAt,
        by: event.actor?.displayName ?? "System",
      })),
      canManage: this.isApprover(actor, row),
      /** Operations sets any price; the RM uses list prices plus a limited discount. */
      canSetPrice: this.isManager(actor),
      canMessage: this.isManager(actor) || actor.roles.includes("SPOC_RM"),
    };
  }

  async download(
    actor: Actor,
    clientId: string,
    agreementId: string,
    fileId: string,
  ) {
    const row = await this.company(actor, clientId);
    return this.files.download(actor, row.publicId, agreementId, fileId);
  }

  async review(
    actor: Actor,
    clientId: string,
    agreementId: string,
    fileId: string,
    input: OnboardingReviewDto,
  ) {
    const row = await this.company(actor, clientId);
    this.assertApprover(actor, row);
    this.assertOnboarding(row);
    const agreement = row.agreements.find(
      (item) => item.publicId === agreementId,
    );
    if (!agreement)
      throw new NotFoundException("Onboarding document not found");
    await this.files.review(actor, row.publicId, agreementId, fileId, input);
    if (input.status === "REJECTED") {
      const label =
        ONBOARDING_DOCUMENTS.find((item) => item.type === agreement.type)
          ?.label ?? "A document";
      await this.messageClient(
        actor,
        row,
        `${label} needs to be uploaded again: ${input.notes}`,
      );
    }
    return this.detail(actor, clientId);
  }

  async updateCommercial(
    actor: Actor,
    clientId: string,
    input: OnboardingCommercialDto,
  ) {
    const row = await this.company(actor, clientId);
    this.assertApprover(actor, row);
    this.assertOnboarding(row);
    await this.commercial.update(actor, row.publicId, {
      version: input.version,
      gstin: row.gstin ?? undefined,
      billingAddress: row.billingAddress ?? undefined,
      billingTerms: input.billingTerms,
      packages: this.isManager(actor)
        ? input.packages
        : await this.listPriced(actor, row, input.packages),
      agreements: [],
    });
    return this.detail(actor, clientId);
  }

  async message(actor: Actor, clientId: string, input: OnboardingMessageDto) {
    if (!this.isManager(actor) && !actor.roles.includes("SPOC_RM"))
      throw new ForbiddenException(
        "Only Operations or the company RM can message the client",
      );
    const row = await this.company(actor, clientId);
    this.assertOnboarding(row);
    await this.messageClient(actor, row, input.message);
    return this.detail(actor, clientId);
  }

  async activate(actor: Actor, clientId: string, input: OnboardingDecisionDto) {
    const row = await this.company(actor, clientId);
    this.assertApprover(actor, row);
    this.assertOnboarding(row);
    const now = new Date();
    const admins = await this.clientAdmins(row.id);
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.client.findUniqueOrThrow({
        where: { id: row.id },
        select: {
          billingTerms: true,
          billingAddress: true,
          packageRates: {
            where: { servicePackage: { isActive: true } },
            select: { active: true },
          },
          agreements: {
            select: {
              type: true,
              signedAt: true,
              expiresAt: true,
              files: {
                orderBy: { revision: "desc" },
                take: 1,
                select: { status: true },
              },
            },
          },
        },
      });
      assertClientActivation(current, now, SELF_SIGNUP_KYC_TYPES);
      const changed = await tx.client.updateMany({
        where: { id: row.id, version: input.version, status: "ONBOARDING" },
        data: {
          status: "ACTIVE",
          onboardingNote:
            input.note || "Onboarding approved. You can now create cases.",
          version: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new ConflictException(
          "Company changed; refresh before approving",
        );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "client.onboarding.activated",
          resourceType: "client",
          resourcePublicId: row.publicId,
          beforeJson: JSON.stringify({
            status: "ONBOARDING",
            version: row.version,
          }),
          afterJson: JSON.stringify({
            status: "ACTIVE",
            note: input.note || null,
          }),
        },
      });
      await this.notifyUsers(
        tx,
        actor.tenantId,
        admins.map((user) => user.id),
        {
          type: "ONBOARDING_ACTIVATED",
          title: "Your company is active",
          body: "Onboarding is approved. You can now create verification cases.",
          href: "/client-portal",
        },
      );
      if (row.primaryRmUserId)
        await this.notifyUsers(tx, actor.tenantId, [row.primaryRmUserId], {
          type: "ONBOARDING_ACTIVATED",
          title: "Company activated",
          body: `${row.displayName} is now active. New cases will come to you.`,
          href: "/spoc-rm/onboarding",
        });
      for (const admin of admins)
        await queueEmail(tx, this.secretBox, {
          tenantId: actor.tenantId,
          aggregateType: "client",
          aggregateId: row.publicId,
          to: admin.email,
          template: "onboarding-activated",
          variables: {
            companyName: row.displayName,
            url: `${this.webOrigin()}/client-portal`,
          },
        });
    });
    return this.detail(actor, clientId);
  }

  async reject(actor: Actor, clientId: string, input: OnboardingRejectDto) {
    const row = await this.company(actor, clientId);
    this.assertApprover(actor, row);
    this.assertOnboarding(row);
    const admins = await this.clientAdmins(row.id);
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.client.updateMany({
        where: { id: row.id, version: input.version, status: "ONBOARDING" },
        data: {
          status: "SUSPENDED",
          onboardingNote: input.reason,
          version: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new ConflictException(
          "Company changed; refresh before rejecting",
        );
      // A rejected sign-up cannot keep using the workspace.
      await tx.user.updateMany({
        where: { clientId: row.id, tenantId: actor.tenantId },
        data: { status: "SUSPENDED", version: { increment: 1 } },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "client.onboarding.rejected",
          resourceType: "client",
          resourcePublicId: row.publicId,
          beforeJson: JSON.stringify({
            status: "ONBOARDING",
            version: row.version,
          }),
          afterJson: JSON.stringify({
            status: "SUSPENDED",
            reason: input.reason,
            usersSuspended: admins.length,
          }),
        },
      });
      for (const admin of admins)
        await queueEmail(tx, this.secretBox, {
          tenantId: actor.tenantId,
          aggregateType: "client",
          aggregateId: row.publicId,
          to: admin.email,
          template: "onboarding-update",
          variables: {
            companyName: row.displayName,
            message: `Your sign-up could not be approved: ${input.reason}`,
          },
        });
    });
    return this.detail(actor, clientId);
  }

  // ---- helpers -------------------------------------------------------------------

  private present(row: CompanyRow, internal: boolean) {
    return {
      ...this.summary(row),
      contactPhone: row.contactPhone,
      gstin: row.gstin,
      pan: row.pan,
      billingAddress: row.billingAddress,
      billingTerms: row.billingTerms,
      note: row.onboardingNote,
      packages: row.packageRates
        .filter((rate) => rate.active)
        .map((rate) => ({
          name: rate.servicePackage.name,
          tatHours: rate.tatHours,
        })),
      documents: ONBOARDING_DOCUMENTS.map((definition) => {
        const agreement = row.agreements.find(
          (item) => item.type === definition.type,
        );
        const file = agreement?.files[0];
        return {
          ...definition,
          agreementId: agreement?.publicId ?? null,
          signedAt: agreement?.signedAt ?? null,
          state: documentState(row, definition.type),
          file: file
            ? {
                id: file.publicId,
                revision: file.revision,
                status: file.status,
                name: file.originalName,
                mimeType: file.mimeType,
                sizeBytes: file.sizeBytes,
                uploadedAt: file.createdAt,
                reviewNotes: file.reviewNotes,
                reviewedAt: file.reviewedAt,
                version: file.version,
                ...(internal
                  ? { uploadedBy: file.uploadedBy.displayName }
                  : {}),
              }
            : null,
        };
      }),
    };
  }

  private summary(row: CompanyRow) {
    return {
      id: row.publicId,
      code: row.code,
      legalName: row.legalName,
      displayName: row.displayName,
      contactName: row.contactName,
      contactEmail: row.contactEmail,
      status: row.status,
      version: row.version,
      signedUpAt: row.selfSignupAt,
      submittedAt: row.onboardingSubmittedAt,
      rm: row.primaryRm
        ? {
            id: row.primaryRm.publicId,
            name: row.primaryRm.displayName,
            email: row.primaryRm.email,
            phone: row.primaryRm.phone,
          }
        : null,
      rmAssignedAt: row.primaryRmAssignedAt,
      progress: checklistProgress(row),
    };
  }

  private flags(row: CompanyRow, duplicates: string[]) {
    return {
      personalEmail: isFreeEmail(row.contactEmail),
      possibleDuplicates: duplicates,
    };
  }

  /** Other companies sharing the business email domain or GSTIN. */
  private async duplicates(actor: Actor, rows: CompanyRow[]) {
    const result = new Map<string, string[]>();
    const domains = [
      ...new Set(
        rows
          .filter((row) => !isFreeEmail(row.contactEmail))
          .map((row) => emailDomain(row.contactEmail))
          .filter((domain): domain is string => Boolean(domain)),
      ),
    ];
    const gstins = rows
      .map((row) => row.gstin)
      .filter((value): value is string => Boolean(value));
    if (!domains.length && !gstins.length) return result;
    const others = await this.prisma.client.findMany({
      where: {
        tenantId: actor.tenantId,
        id: { notIn: rows.map((row) => row.id) },
        OR: [
          ...domains.map((domain) => ({
            contactEmail: { endsWith: `@${domain}` },
          })),
          ...(gstins.length ? [{ gstin: { in: gstins } }] : []),
        ],
      },
      select: { displayName: true, contactEmail: true, gstin: true },
      take: 50,
    });
    for (const row of rows) {
      const domain = isFreeEmail(row.contactEmail)
        ? null
        : emailDomain(row.contactEmail);
      const matches = others
        .filter(
          (other) =>
            (domain && emailDomain(other.contactEmail) === domain) ||
            (row.gstin && other.gstin === row.gstin),
        )
        .map((other) => other.displayName);
      if (matches.length)
        result.set(row.publicId, [...new Set(matches)].slice(0, 5));
    }
    return result;
  }

  private async ownCompany(actor: Actor) {
    if (!actor.clientId || !actor.roles.includes("CLIENT_ADMIN"))
      throw new ForbiddenException(
        "Only the company admin can manage onboarding",
      );
    const row = await this.prisma.client.findFirst({
      where: { id: actor.clientId, tenantId: actor.tenantId },
      select: companySelect,
    });
    if (!row) throw new NotFoundException("Company not found");
    return row;
  }

  private scope(actor: Actor): Prisma.ClientWhereInput {
    if (
      actor.roles.some((role) =>
        ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role),
      )
    )
      return { tenantId: actor.tenantId };
    if (actor.roles.includes("SPOC_RM"))
      return {
        tenantId: actor.tenantId,
        OR: [
          { primaryRmUserId: actor.userId },
          { id: { in: (actor.spocClients ?? []).map((client) => client.id) } },
        ],
      };
    throw new ForbiddenException("This role cannot view company onboarding");
  }

  private async company(actor: Actor, clientId: string) {
    const row = await this.prisma.client.findFirst({
      where: {
        AND: [
          this.scope(actor),
          { publicId: clientId, selfSignupAt: { not: null } },
        ],
      },
      select: companySelect,
    });
    if (!row) throw new NotFoundException("Company not found");
    return row;
  }

  private assertOnboarding(row: { status: string }) {
    if (row.status !== "ONBOARDING")
      throw new ConflictException(
        "Onboarding is already closed for this company",
      );
  }

  private isManager(actor: Actor) {
    return actor.roles.some((role) => MANAGER_ROLES.includes(role));
  }

  /** Operations, or the RM assigned to this company, approves its onboarding. */
  private isApprover(actor: Actor, row: { primaryRmUserId: bigint | null }) {
    return (
      this.isManager(actor) ||
      (actor.roles.includes("SPOC_RM") &&
        row.primaryRmUserId !== null &&
        row.primaryRmUserId === actor.userId)
    );
  }

  private assertApprover(
    actor: Actor,
    row: { primaryRmUserId: bigint | null },
  ) {
    if (!this.isApprover(actor, row))
      throw new ForbiddenException(
        "Only Operations or the company's assigned RM can approve onboarding",
      );
  }

  /**
   * The RM chooses packages but not prices: each package keeps its list price and
   * turnaround (and the company's current GST rate). Discounts go through Client pricing,
   * within the limit Operations set per package.
   */
  private async listPriced(
    actor: Actor,
    row: CompanyRow,
    packages: OnboardingCommercialDto["packages"],
  ) {
    const catalog = await this.prisma.servicePackage.findMany({
      where: {
        tenantId: actor.tenantId,
        publicId: { in: packages.map((item) => item.servicePackageId) },
      },
      select: { publicId: true, price: true, tatHours: true },
    });
    return packages.map((item) => {
      const pkg = catalog.find(
        (entry) => entry.publicId === item.servicePackageId,
      );
      if (!pkg || pkg.price === null)
        throw new BadRequestException(
          "This package has no list price yet; ask Operations to price it",
        );
      const current = row.packageRates.find(
        (rate) => rate.servicePackage.publicId === item.servicePackageId,
      );
      return {
        servicePackageId: item.servicePackageId,
        unitPrice: Number(pkg.price),
        taxRate: current ? Number(current.taxRate) : item.taxRate,
        ...(pkg.tatHours ? { tatHours: pkg.tatHours } : {}),
        active: item.active,
      };
    });
  }

  private clientAdmins(clientId: bigint) {
    return this.prisma.user.findMany({
      where: {
        clientId,
        status: "ACTIVE",
        userRoles: { some: { role: { code: "CLIENT_ADMIN" } } },
      },
      select: { id: true, email: true },
    });
  }

  private async messageClient(actor: Actor, row: CompanyRow, message: string) {
    const admins = await this.clientAdmins(row.id);
    await this.prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id: row.id },
        data: { onboardingNote: message.slice(0, 500) },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "client.onboarding.message",
          resourceType: "client",
          resourcePublicId: row.publicId,
          afterJson: JSON.stringify({ message }),
        },
      });
      await this.notifyUsers(
        tx,
        actor.tenantId,
        admins.map((user) => user.id),
        {
          type: "ONBOARDING_UPDATE",
          title: "Onboarding needs your attention",
          body: message.slice(0, 1000),
          href: "/client-portal/onboarding",
        },
      );
      for (const admin of admins)
        await queueEmail(tx, this.secretBox, {
          tenantId: actor.tenantId,
          aggregateType: "client",
          aggregateId: row.publicId,
          to: admin.email,
          template: "onboarding-update",
          variables: {
            companyName: row.displayName,
            message,
            url: `${this.webOrigin()}/client-portal/onboarding`,
          },
        });
    });
  }

  /** Operations Managers plus the company RM. */
  private async notifyTeam(
    tenantId: bigint,
    row: CompanyRow,
    notice: { type: string; title: string; body: string },
  ) {
    const managers = await this.prisma.user.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        OR: [
          { userRoles: { some: { role: { code: "OPS_MANAGER" } } } },
          ...(row.primaryRmUserId ? [{ id: row.primaryRmUserId }] : []),
        ],
      },
      select: {
        id: true,
        userRoles: { select: { role: { select: { code: true } } } },
      },
    });
    if (!managers.length) return;
    await this.prisma.notification.createMany({
      data: managers.map((user) => ({
        tenantId,
        userId: user.id,
        type: notice.type,
        title: notice.title,
        body: notice.body.slice(0, 1000),
        href: user.userRoles.some(({ role }) => role.code === "OPS_MANAGER")
          ? `/operations/onboarding?company=${row.publicId}`
          : `/spoc-rm/onboarding?company=${row.publicId}`,
      })),
    });
  }

  private notifyUsers(
    tx: Prisma.TransactionClient,
    tenantId: bigint,
    userIds: bigint[],
    notice: { type: string; title: string; body: string; href: string },
  ) {
    if (!userIds.length) return Promise.resolve();
    return tx.notification.createMany({
      data: userIds.map((userId) => ({ tenantId, userId, ...notice })),
    });
  }

  private webOrigin() {
    return this.config
      .get<string>("WEB_ORIGIN", "http://localhost:3000")
      .replace(/\/$/, "");
  }
}
