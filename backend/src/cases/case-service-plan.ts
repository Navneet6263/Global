import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import type { PrismaService } from "../database/prisma.service";
import type { CreateCaseDto } from "./dto/create-case.dto";
import { CheckTypes } from "./case.constants";
import { Permission } from "../common/auth/permissions";

export const ServiceFamilies = [
  "HIRECHECK",
  "INTEGRITYCHECK",
  "LEADERCHECK",
  "VENDORCHECK",
] as const;
export const RequiredDocumentTypes = [
  "AADHAAR",
  "PAN",
  "PASSPORT",
  "DRIVING_LICENCE",
  "ADDRESS_PROOF",
  "EDUCATION_CERTIFICATE",
  "EMPLOYMENT_PROOF",
  "OTHER",
] as const;

export function stringList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter((item): item is string => typeof item === "string"),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

export function packageChecks(value: string): string[] {
  return stringList(value).filter((check) =>
    CheckTypes.includes(check as (typeof CheckTypes)[number]),
  );
}

export function caseTatHours(
  priority: string,
  clientSla: number,
  serviceTat: number,
) {
  const priorityCap =
    ({ URGENT: 24, HIGH: 48, NORMAL: 120, LOW: 168 } as Record<string, number>)[
      priority
    ] ?? 120;
  return Math.min(clientSla, serviceTat, priorityCap);
}

export async function loadCaseServicePlan(
  prisma: PrismaService,
  actor: Actor,
  input: CreateCaseDto,
) {
  const requested = input.services?.length
    ? input.services
    : [{ servicePackageId: input.servicePackageId }];
  const ids = requested.map((item) => item.servicePackageId);
  if (
    ids.length > 4 ||
    new Set(ids).size !== ids.length ||
    !ids.includes(input.servicePackageId)
  ) {
    throw new BadRequestException(
      "Choose up to four different packages, including the primary package",
    );
  }
  const [client, packages] = await Promise.all([
    prisma.client.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: input.clientId,
        status: "ACTIVE",
        ...(actor.clientId ? { id: actor.clientId } : {}),
      },
      include: { packageRates: true },
    }),
    prisma.servicePackage.findMany({
      where: {
        tenantId: actor.tenantId,
        publicId: { in: ids },
        isActive: true,
      },
    }),
  ]);
  if (!client) throw new NotFoundException("Active client not found");
  if (packages.length !== ids.length)
    throw new NotFoundException("An active service package was not found");
  const services = requested.map((request) => {
    const pkg = packages.find(
      (item) => item.publicId === request.servicePackageId,
    )!;
    const rate = client.packageRates.find(
      (item) => item.servicePackageId === pkg.id && item.active,
    );
    if (client.packageRates.length && !rate)
      throw new BadRequestException(
        `${pkg.name} is not enabled in this client's agreement`,
      );
    const checks = packageChecks(pkg.checksJson);
    if (!checks.length)
      throw new ConflictException(`${pkg.name} has no valid checks`);
    const details = request.details ?? {};
    if (
      pkg.serviceFamily === "VENDORCHECK" &&
      (!details.organisationName?.trim() || !details.registrationNumber?.trim())
    ) {
      throw new BadRequestException(
        "VendorCheck requires the business name and registration number",
      );
    }
    return {
      pkg,
      checks,
      details,
      unitPrice: rate?.unitPrice ?? pkg.price ?? 0,
      taxRate: rate?.taxRate ?? 0,
      tatHours: caseTatHours(
        input.priority,
        client.slaHours,
        rate?.tatHours ?? pkg.tatHours,
      ),
    };
  });
  return { client, services };
}

export async function caseServiceCatalog(
  prisma: PrismaService,
  actor: Actor,
  clientPublicId?: string,
) {
  if (actor.roles.includes("CLIENT_ADMIN") && !actor.clientId)
    throw new ForbiddenException(
      "A client workspace is required for case intake",
    );
  const scoped = Boolean(actor.clientId || clientPublicId);
  const client = scoped
    ? await prisma.client.findFirst({
        where: {
          tenantId: actor.tenantId,
          status: "ACTIVE",
          ...(actor.clientId ? { id: actor.clientId } : {}),
          ...(clientPublicId ? { publicId: clientPublicId } : {}),
        },
        select: {
          id: true,
          slaHours: true,
          packageRates: {
            select: {
              servicePackageId: true,
              active: true,
              unitPrice: true,
              tatHours: true,
            },
          },
        },
      })
    : null;
  if (scoped && !client) throw new NotFoundException("Active client not found");
  const rates = client?.packageRates ?? [];
  const commercialAccess =
    actor.roles.includes("PLATFORM_ADMIN") ||
    actor.permissions.includes("*") ||
    actor.permissions.includes(Permission.FinanceRead) ||
    (actor.roles.includes("CLIENT_ADMIN") && actor.clientId === client?.id);
  const packages = await prisma.servicePackage.findMany({
    where: {
      tenantId: actor.tenantId,
      isActive: true,
      ...(rates.length
        ? {
            id: {
              in: rates
                .filter((rate) => rate.active)
                .map((rate) => rate.servicePackageId),
            },
          }
        : {}),
    },
    orderBy: [{ name: "asc" }, { code: "asc" }],
  });
  return {
    items: packages
      .map((pkg) => {
        const rate = rates.find((item) => item.servicePackageId === pkg.id);
        return {
          id: pkg.publicId,
          code: pkg.code,
          name: pkg.name,
          serviceFamily: pkg.serviceFamily,
          checks: packageChecks(pkg.checksJson),
          requiredDocuments: stringList(pkg.requiredDocumentsJson),
          ...(!client || commercialAccess
            ? { price: rate?.unitPrice ?? pkg.price }
            : {}),
          tatHours: Math.min(
            rate?.tatHours ?? pkg.tatHours,
            client?.slaHours ?? Number.POSITIVE_INFINITY,
          ),
        };
      })
      .filter((pkg) => pkg.checks.length),
  };
}
