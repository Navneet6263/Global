import type { Actor } from "../common/auth/actor";
import { Prisma } from "../generated/prisma/client";
import {
  currentDocument,
  intakeReadySql,
} from "./operations-action-readiness.sql";

/** Mirrors caseAccessScope for the Ops/Admin-only controller; all values parameterized. */
export function operationsActionScope(actor: Actor) {
  const admin = actor.roles.includes("PLATFORM_ADMIN");
  return Prisma.sql`c.[tenantId] = ${actor.tenantId}
    ${!admin && actor.branchId ? Prisma.sql`AND (c.[branchId] = ${actor.branchId} OR c.[branchId] IS NULL)` : Prisma.empty}
    ${!admin && actor.clientId ? Prisma.sql`AND c.[clientId] = ${actor.clientId}` : Prisma.empty}`;
}

/** Aggregates metadata in SQL; no document files or whole-case collections loaded by the API. */
export function operationsWorkItems(actor: Actor, now: Date) {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return Prisma.sql`WITH ScopedCases AS (
    SELECT c.[id], c.[publicId], c.[caseNumber], c.[status], c.[priority], c.[version],
      c.[updatedAt], c.[dueAt], c.[subjectId], c.[clientId]
    FROM [dbo].[VerificationCase] c WHERE ${operationsActionScope(actor)}
      AND c.[status] IN ('DRAFT','CONSENT_PENDING','DOCUMENT_PENDING','IN_PROGRESS','CLARIFICATION_PENDING','QA_REVIEW')
  ), Facts AS (
    SELECT c.*, docs.[quantity] documentCount, docs.[activityAt] documentAt,
      checks.[quantity] checkCount, checks.[activityAt] checkAt,
      visits.[quantity] reviewCount, visits.[activityAt] reviewAt,
      replies.[quantity] replyCount, replies.[activityAt] replyAt,
      CASE WHEN c.[status] = 'DOCUMENT_PENDING' AND ${intakeReadySql(today)} THEN 1 ELSE 0 END startReady,
      CASE WHEN c.[status] IN ('IN_PROGRESS','CLARIFICATION_PENDING','QA_REVIEW')
        AND EXISTS (SELECT 1 FROM [dbo].[CaseCheck] k WHERE k.[caseId] = c.[id] AND k.[type] = 'ADDRESS')
        AND NOT EXISTS (SELECT 1 FROM [dbo].[FieldVisit] v WHERE v.[caseId] = c.[id] AND v.[status] <> 'CANCELLED')
        THEN 1 ELSE 0 END fieldRequired,
      CASE WHEN EXISTS (SELECT 1 FROM [dbo].[CaseCheck] k WHERE k.[caseId] = c.[id])
        AND NOT EXISTS (SELECT 1 FROM [dbo].[CaseCheck] k WHERE k.[caseId] = c.[id] AND k.[status] <> 'COMPLETED')
        THEN 1 ELSE 0 END checksComplete
    FROM ScopedCases c
    OUTER APPLY (SELECT COUNT(*) quantity, MAX(v.[createdAt]) activityAt
      FROM [dbo].[Document] d JOIN [dbo].[DocumentVersion] v
        ON v.[documentId] = d.[id] AND v.[version] = d.[currentVersion]
      WHERE d.[caseId] = c.[id] AND ${currentDocument}
        AND d.[status] = 'AVAILABLE' AND v.[malwareState] = 'CLEAN') docs
    OUTER APPLY (SELECT COUNT(*) quantity, MIN(k.[updatedAt]) activityAt FROM [dbo].[CaseCheck] k
      OUTER APPLY (SELECT COUNT(*) activeCount,
        SUM(CASE WHEN t.[assigneeId] IS NULL AND t.[status] IN ('UNASSIGNED','OPEN','BLOCKED') THEN 1 ELSE 0 END) movable
        FROM [dbo].[CheckTask] t WHERE t.[checkId] = k.[id]
          AND t.[status] IN ('UNASSIGNED','OPEN','IN_PROGRESS','BLOCKED')) tasks
      WHERE k.[caseId] = c.[id] AND k.[status] <> 'COMPLETED'
        AND ((tasks.activeCount = 0 AND k.[status] = 'PENDING') OR (tasks.activeCount = 1 AND tasks.movable = 1))) checks
    OUTER APPLY (SELECT COUNT(*) quantity, MIN(v.[updatedAt]) activityAt FROM [dbo].[FieldVisit] v
      WHERE v.[caseId] = c.[id] AND v.[status] IN ('REVIEW_PENDING','EXCEPTION_REVIEW')) visits
    OUTER APPLY (SELECT COUNT(*) quantity, MIN(r.[updatedAt]) activityAt FROM [dbo].[Clarification] r
      WHERE r.[caseId] = c.[id] AND r.[status] = 'RESPONDED') replies
  ), WorkItems AS (
    SELECT f.*, w.[action], w.[quantity], w.[activityAt] FROM Facts f CROSS APPLY (VALUES
      ('documents', CASE WHEN f.[status] <> 'QA_REVIEW' THEN f.documentCount ELSE 0 END, f.documentAt),
      ('start', f.startReady, f.[updatedAt]),
      ('checks', CASE WHEN f.[status] IN ('IN_PROGRESS','CLARIFICATION_PENDING') THEN f.checkCount ELSE 0 END, f.checkAt),
      ('field_assignment', f.fieldRequired, f.[updatedAt]),
      ('field_review', CASE WHEN f.[status] IN ('IN_PROGRESS','CLARIFICATION_PENDING') THEN f.reviewCount ELSE 0 END, f.reviewAt),
      ('clarifications', f.replyCount, f.replyAt)
    ) w([action], [quantity], [activityAt]) WHERE w.[quantity] > 0
  )`;
}
