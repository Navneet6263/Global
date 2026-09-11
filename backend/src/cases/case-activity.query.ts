import { Prisma } from "../generated/prisma/client";

export function caseActivityScope(
  tenantId: bigint,
  caseId: bigint,
  casePublicId: string,
) {
  // Link metadata inside SQL instead of loading all evidence/task IDs into memory.
  return Prisma.sql`a.[tenantId] = ${tenantId} AND (
    (a.[resourceType] = 'case' AND a.[resourcePublicId] = ${casePublicId})
    OR (a.[resourceType] = 'document' AND EXISTS (
      SELECT 1 FROM [dbo].[Document] d WHERE d.[caseId] = ${caseId}
      AND CONVERT(varchar(36), d.[publicId]) = a.[resourcePublicId]))
    OR (a.[resourceType] = 'report' AND EXISTS (
      SELECT 1 FROM [dbo].[Report] r WHERE r.[caseId] = ${caseId}
      AND CONVERT(varchar(36), r.[publicId]) = a.[resourcePublicId]))
    OR (a.[resourceType] = 'check' AND EXISTS (
      SELECT 1 FROM [dbo].[CaseCheck] c WHERE c.[caseId] = ${caseId}
      AND CONVERT(varchar(36), c.[publicId]) = a.[resourcePublicId]))
    OR (a.[resourceType] = 'task' AND EXISTS (
      SELECT 1 FROM [dbo].[CheckTask] t JOIN [dbo].[CaseCheck] c ON c.[id] = t.[checkId]
      WHERE c.[caseId] = ${caseId} AND CONVERT(varchar(36), t.[publicId]) = a.[resourcePublicId]))
    OR (a.[resourceType] = 'consent' AND EXISTS (
      SELECT 1 FROM [dbo].[Consent] c WHERE c.[caseId] = ${caseId}
      AND CONVERT(varchar(36), c.[publicId]) = a.[resourcePublicId]))
    OR (a.[resourceType] = 'clarification' AND EXISTS (
      SELECT 1 FROM [dbo].[Clarification] c WHERE c.[caseId] = ${caseId}
      AND CONVERT(varchar(36), c.[publicId]) = a.[resourcePublicId]))
    OR (a.[resourceType] = 'field_visit' AND EXISTS (
      SELECT 1 FROM [dbo].[FieldVisit] v WHERE v.[caseId] = ${caseId}
      AND CONVERT(varchar(36), v.[publicId]) = a.[resourcePublicId]))
    OR (a.[resourceType] = 'field_evidence' AND EXISTS (
      SELECT 1 FROM [dbo].[EvidenceItem] e JOIN [dbo].[FieldVisit] v ON v.[id] = e.[fieldVisitId]
      WHERE v.[caseId] = ${caseId} AND CONVERT(varchar(36), e.[publicId]) = a.[resourcePublicId]))
    OR (a.[resourceType] = 'invoice' AND EXISTS (
      SELECT 1 FROM [dbo].[InvoiceLine] l JOIN [dbo].[Invoice] i ON i.[id] = l.[invoiceId]
      WHERE l.[caseId] = ${caseId} AND CONVERT(varchar(36), i.[publicId]) = a.[resourcePublicId]))
  )`;
}

export const activityMetadata = Prisma.sql`
  CONVERT(varchar(36), a.[publicId]) AS [id], a.[action], a.[resourceType], a.[createdAt],
  COALESCE(u.[displayName], 'System') AS [actorName]`;

export const activitySource = Prisma.sql`[dbo].[AuditEvent] a
  LEFT JOIN [dbo].[User] u ON u.[id] = a.[actorUserId] AND u.[tenantId] = a.[tenantId]`;
