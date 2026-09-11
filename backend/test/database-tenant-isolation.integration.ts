import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import type { Actor } from "../src/common/auth/actor";
import { SecretBoxService } from "../src/common/security/secret-box.service";
import { SubjectPiiService } from "../src/common/security/subject-pii.service";
import { PrismaService } from "../src/database/prisma.service";
import { PrismaClient } from "../src/generated/prisma/client";
import { CaseReaderService } from "../src/cases/case-reader.service";
import { CaseQueryDto } from "../src/cases/dto/case-query.dto";
import { ClientsService } from "../src/clients/clients.service";
import { PageQueryDto } from "../src/common/dto/page-query.dto";
import { CandidatePortalService } from "../src/candidate-portal/candidate-portal.service";
import type { DocumentsService } from "../src/documents/documents.service";
import { ClarificationsService } from "../src/clarifications/clarifications.service";
import { ClarificationTokenService } from "../src/clarifications/clarification-token.service";
import { QaReadinessService } from "../src/verification/qa-readiness.service";
import { NavigationCountsService } from "../src/dashboards/navigation-counts.service";
import { verifyQaSql } from "./qa-sql-checks";

const databaseConfigured = [
  "DB_HOST",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
].every((name) => Boolean(process.env[name]?.trim()));

const rollback = new Error("rollback integration fixtures");

void test(
  "SQL-backed readers isolate tenants and client-bound users",
  { skip: !databaseConfigured },
  async () => {
    const prisma = createPrismaClient();
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
    const tenantCodes = [`ITA${suffix}`, `ITB${suffix}`];

    try {
      await assert.rejects(
        prisma.$transaction(
          async (tx) => {
            const tenantA = await tx.tenant.create({
              data: { code: tenantCodes[0]!, name: "Integration tenant A" },
            });
            const tenantB = await tx.tenant.create({
              data: { code: tenantCodes[1]!, name: "Integration tenant B" },
            });

            const [clientA1, clientA2, clientB] = await Promise.all([
              tx.client.create({
                data: {
                  tenantId: tenantA.id,
                  code: "CLIENT-A1",
                  legalName: "Client A One",
                  displayName: "Client A One",
                },
              }),
              tx.client.create({
                data: {
                  tenantId: tenantA.id,
                  code: "CLIENT-A2",
                  legalName: "Client A Two",
                  displayName: "Client A Two",
                },
              }),
              tx.client.create({
                data: {
                  tenantId: tenantB.id,
                  code: "CLIENT-B",
                  legalName: "Client B",
                  displayName: "Client B",
                },
              }),
            ]);

            const [caseA1, caseA2, caseB] = await Promise.all([
              createCase(tx, tenantA.id, clientA1.id, `ITA1-${suffix}`),
              createCase(tx, tenantA.id, clientA2.id, `ITA2-${suffix}`),
              createCase(tx, tenantB.id, clientB.id, `ITB-${suffix}`),
            ]);

            const config = new ConfigService({
              DATA_ENCRYPTION_KEY:
                "integration-data-key-0123456789abcdef0123456789",
              JWT_REFRESH_SECRET:
                "integration-refresh-key-0123456789abcdef012345",
              WEB_ORIGIN: "https://integration.example.invalid",
            });
            const secrets = new SecretBoxService(config);
            const pii = new SubjectPiiService(secrets);
            const scopedPrisma = tx as unknown as PrismaService;
            const caseReader = new CaseReaderService(scopedPrisma, pii);
            const clientReader = new ClientsService(scopedPrisma);
            const candidatePortal = new CandidatePortalService(
              scopedPrisma,
              null as unknown as DocumentsService,
              config,
              secrets,
              pii,
            );
            const clarifications = new ClarificationsService(
              scopedPrisma,
              new ClarificationTokenService(scopedPrisma),
              new QaReadinessService(),
            );
            const tenantActor = actorFor(tenantA, undefined, "PLATFORM_ADMIN");
            const clientActor = actorFor(tenantA, clientA1, "CLIENT_ADMIN");

            const tenantCases = await caseReader.list(
              tenantActor,
              new CaseQueryDto(),
            );
            assert.deepEqual(
              new Set(tenantCases.items.map((item) => item.id)),
              new Set([caseA1.publicId, caseA2.publicId]),
            );
            assert.equal(
              tenantCases.items.some((item) => item.id === caseB.publicId),
              false,
            );

            const rankedQuery = Object.assign(new CaseQueryDto(), {
              page: 1,
              pageSize: 1,
              sortBy: "priority" as const,
            });
            const firstRankedPage = await caseReader.list(
              tenantActor,
              rankedQuery,
            );
            const secondRankedPage = await caseReader.list(tenantActor, {
              ...rankedQuery,
              page: 2,
            } as CaseQueryDto);
            assert.equal(firstRankedPage.total, 2);
            assert.equal(firstRankedPage.items.length, 1);
            assert.equal(secondRankedPage.items.length, 1);
            assert.notEqual(
              firstRankedPage.items[0]!.id,
              secondRankedPage.items[0]!.id,
            );
            const badges = await new NavigationCountsService(scopedPrisma).get(
              tenantActor,
            );
            assert.equal(badges.counts.activeCases, 2);

            const clientCases = await caseReader.list(
              clientActor,
              new CaseQueryDto(),
            );
            assert.deepEqual(
              clientCases.items.map((item) => item.id),
              [caseA1.publicId],
            );

            await assert.rejects(
              caseReader.get(tenantActor, caseB.publicId),
              NotFoundException,
            );
            await assert.rejects(
              caseReader.get(clientActor, caseA2.publicId),
              NotFoundException,
            );

            const tenantClients = await clientReader.list(
              tenantActor,
              new PageQueryDto(),
            );
            assert.deepEqual(
              new Set(tenantClients.items.map((item) => item.publicId)),
              new Set([clientA1.publicId, clientA2.publicId]),
            );

            const clientClients = await clientReader.list(
              clientActor,
              new PageQueryDto(),
            );
            assert.deepEqual(
              clientClients.items.map((item) => item.publicId),
              [clientA1.publicId],
            );

            const tokenA = `candidate-a-${suffix}`;
            const tokenB = `candidate-b-${suffix}`;
            const [accessA, accessB] = await Promise.all([
              tx.candidatePortalAccess.create({
                data: {
                  tenantId: tenantA.id,
                  caseId: caseA1.id,
                  tokenHash: digest(tokenA),
                  expiresAt: new Date(Date.now() + 60_000),
                },
              }),
              tx.candidatePortalAccess.create({
                data: {
                  tenantId: tenantB.id,
                  caseId: caseB.id,
                  tokenHash: digest(tokenB),
                  expiresAt: new Date(Date.now() + 60_000),
                },
              }),
            ]);

            const candidateView = await candidatePortal.get(
              accessA.publicId,
              tokenA,
            );
            assert.equal(candidateView.case.caseNumber, caseA1.caseNumber);
            await assert.rejects(
              candidatePortal.get(accessA.publicId, tokenB),
              UnauthorizedException,
            );
            await assert.rejects(
              candidatePortal.get(accessB.publicId, tokenA),
              UnauthorizedException,
            );

            const clarificationToken = `clarification-${suffix}`;
            const clarification = await tx.clarification.create({
              data: {
                tenantId: tenantA.id,
                caseId: caseA1.id,
                subject: "Integration clarification",
                responseTokenHash: digest(clarificationToken),
                responseTokenExpiresAt: new Date(Date.now() + 60_000),
                messages: {
                  create: { senderType: "TEAM", body: "Please confirm" },
                },
              },
            });
            const clarificationView = await clarifications.getPublic(
              clarification.publicId,
              clarificationToken,
            );
            assert.equal(clarificationView.caseNumber, caseA1.caseNumber);
            await assert.rejects(
              clarifications.getPublic(clarification.publicId, tokenB),
              UnauthorizedException,
            );

            await verifyQaSql(tx, tenantActor, clientActor, [
              caseA1,
              caseA2,
              caseB,
            ]);
            throw rollback;
          },
          { maxWait: 30_000, timeout: 120_000 },
        ),
        (error) => error === rollback,
      );

      assert.equal(
        await prisma.tenant.count({ where: { code: { in: tenantCodes } } }),
        0,
        "integration fixtures must be rolled back",
      );
    } finally {
      await prisma.$disconnect();
    }
  },
);

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaMssql({
    server: required("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 1433),
    database: required("DB_NAME"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    options: {
      encrypt: process.env.DB_ENCRYPT !== "false",
      trustServerCertificate:
        process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    },
  });
  return new PrismaClient({ adapter });
}

async function createCase(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  tenantId: bigint,
  clientId: bigint,
  caseNumber: string,
) {
  const subject = await tx.subject.create({
    data: { tenantId, fullName: `Subject ${caseNumber}` },
  });
  return tx.verificationCase.create({
    data: {
      tenantId,
      clientId,
      subjectId: subject.id,
      caseNumber,
      status: "IN_PROGRESS",
    },
  });
}

function actorFor(
  tenant: { id: bigint; publicId: string; name: string },
  client?: { id: bigint; publicId: string; displayName: string },
  role = "PLATFORM_ADMIN",
): Actor {
  return {
    userId: 0n,
    userPublicId: randomUUID(),
    tenantId: tenant.id,
    tenantPublicId: tenant.publicId,
    tenantName: tenant.name,
    ...(client
      ? {
          clientId: client.id,
          clientPublicId: client.publicId,
          clientName: client.displayName,
        }
      : {}),
    email: "integration@example.invalid",
    displayName: "Integration actor",
    mustChangePassword: false,
    roles: [role],
    permissions: [],
  };
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
