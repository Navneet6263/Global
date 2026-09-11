import "dotenv/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "../src/generated/prisma/client";

type DomainCheck = {
  table: string;
  column: string;
  allowed: readonly string[];
};

const checks: readonly DomainCheck[] = [
  { table: "User", column: "status", allowed: ["ACTIVE", "SUSPENDED"] },
  {
    table: "Client",
    column: "status",
    allowed: ["ONBOARDING", "ACTIVE", "SUSPENDED"],
  },
  {
    table: "VerificationCase",
    column: "status",
    allowed: [
      "DRAFT",
      "CONSENT_PENDING",
      "DOCUMENT_PENDING",
      "IN_PROGRESS",
      "CLARIFICATION_PENDING",
      "QA_REVIEW",
      "MANAGER_REVIEW",
      "REPORT_PENDING",
      "PAYMENT_PENDING",
      "COMPLETED",
      "CLOSED",
      "CANCELLED",
    ],
  },
  {
    table: "VerificationCase",
    column: "priority",
    allowed: ["LOW", "NORMAL", "HIGH", "URGENT"],
  },
  {
    table: "CaseCheck",
    column: "status",
    allowed: [
      "PENDING",
      "ASSIGNED",
      "IN_PROGRESS",
      "BLOCKED",
      "COMPLETED",
      "QA_REVIEW",
    ],
  },
  {
    table: "CheckTask",
    column: "status",
    allowed: ["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED"],
  },
  {
    table: "Consent",
    column: "status",
    allowed: ["REQUESTED", "ACCEPTED", "WITHDRAWN", "EXPIRED"],
  },
  {
    table: "Document",
    column: "status",
    allowed: [
      "REQUESTED",
      "AVAILABLE",
      "VERIFIED",
      "REJECTED",
      "REUPLOAD_REQUIRED",
      "EXPIRED",
    ],
  },
  {
    table: "Clarification",
    column: "status",
    allowed: ["OPEN", "RESPONDED", "RESOLVED", "EXPIRED"],
  },
  {
    table: "FieldVisit",
    column: "status",
    allowed: [
      "ASSIGNED",
      "IN_PROGRESS",
      "EXCEPTION_REVIEW",
      "REVIEW_PENDING",
      "COMPLETED",
      "CANCELLED",
    ],
  },
  {
    table: "OutboxEvent",
    column: "status",
    allowed: ["PENDING", "PROCESSING", "RETRY", "PROCESSED", "FAILED"],
  },
  {
    table: "Invoice",
    column: "status",
    allowed: [
      "DRAFT",
      "ISSUED",
      "PARTIALLY_PAID",
      "PAID",
      "PARTIALLY_CREDITED",
      "CREDITED",
      "SETTLED",
      "CANCELLED",
      "OVERDUE",
    ],
  },
  {
    table: "Report",
    column: "status",
    allowed: ["QUEUED", "PREPARED", "PUBLISHED", "FAILED", "SUPERSEDED"],
  },
];

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const adapter = new PrismaMssql({
  server: required("DB_HOST"),
  port: Number(process.env.DB_PORT ?? 1433),
  database: required("DB_NAME"),
  user: required("DB_USER"),
  password: required("DB_PASSWORD"),
  options: {
    encrypt: process.env.DB_ENCRYPT !== "false",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
  },
});

const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const baseline = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    "SELECT COUNT(*) AS [count] FROM sys.tables WHERE [name] = 'Tenant' AND [schema_id] = SCHEMA_ID('dbo')",
  );
  if (Number(baseline[0]?.count ?? 0) === 0) {
    console.log(
      "Migration preflight skipped: fresh database has no application schema yet.",
    );
    return;
  }
  const violations: string[] = [];

  for (const check of checks) {
    // Table and column names only come from the constant list above.
    const rows = await prisma.$queryRawUnsafe<Array<{ value: string | null }>>(
      `SELECT DISTINCT [${check.column}] AS [value] FROM [dbo].[${check.table}]`,
    );
    const invalid = rows
      .map((row) => row.value)
      .filter(
        (value): value is string =>
          value === null || !check.allowed.includes(value),
      );

    if (invalid.length > 0) {
      violations.push(`${check.table}.${check.column}: ${invalid.join(", ")}`);
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Migration preflight found unsupported values:\n${violations.join("\n")}`,
    );
  }

  console.log("Migration preflight passed: persisted domain values are valid.");
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
