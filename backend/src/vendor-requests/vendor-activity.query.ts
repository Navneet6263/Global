import type { Actor } from "../common/auth/actor";
import { Prisma } from "../generated/prisma/client";

/** Owner = the Main Vendor account; member = the team user when a team user asks. */
function parties(actor: Actor) {
  const member = actor.vendorOwnerId !== undefined ? actor.userId : null;
  return { owner: actor.vendorOwnerId ?? actor.userId, member };
}

/** The action was done by this vendor login (team user) or anyone in the account (Main Vendor). */
function byVendorTeam(actor: Actor) {
  const { owner, member } = parties(actor);
  return member
    ? Prisma.sql`a.[actorUserId] = ${member}`
    : Prisma.sql`(a.[actorUserId] = ${owner} OR EXISTS (
        SELECT 1 FROM [dbo].[User] tm WHERE tm.[id] = a.[actorUserId] AND tm.[vendorOwnerId] = ${owner}))`;
}

/** Assignments the caller may see: the account's, or only those delegated to the team user. */
function ownAssignment(actor: Actor) {
  const { owner, member } = parties(actor);
  return member
    ? Prisma.sql`va.[vendorUserId] = ${owner} AND va.[handlerUserId] = ${member}`
    : Prisma.sql`va.[vendorUserId] = ${owner}`;
}

/**
 * Vendor Logs scope over AuditEvent `a`, reusing the existing audit trail:
 * - request events (assigned, delegated, reminded, decided, report uploaded and
 *   downloaded); SPOC-RM report *previews* are left out, a SPOC-RM download is kept;
 * - document previews by the vendor team and re-upload requests on its documents;
 * - Main Vendor only: management of its own team users.
 * A team user sees only requests delegated to it and its own previews.
 */
export function vendorActivityScope(actor: Actor, requestId?: string) {
  const { owner, member } = parties(actor);
  const team = byVendorTeam(actor);
  const request = requestId
    ? Prisma.sql`AND CONVERT(varchar(36), va.[publicId]) = ${requestId}`
    : Prisma.empty;
  const teamUsers =
    member || requestId
      ? Prisma.empty
      : Prisma.sql`OR (a.[resourceType] = 'user' AND a.[actorUserId] = ${owner} AND EXISTS (
          SELECT 1 FROM [dbo].[User] tu WHERE tu.[vendorOwnerId] = ${owner}
          AND CONVERT(varchar(36), tu.[publicId]) = a.[resourcePublicId]))`;
  return Prisma.sql`a.[tenantId] = ${actor.tenantId} AND (
    (a.[resourceType] = 'vendor_assignment'
      AND (a.[action] <> 'vendor_assignment.report-previewed' OR ${team})
      AND EXISTS (SELECT 1 FROM [dbo].[VendorAssignment] va
        WHERE ${ownAssignment(actor)} ${request}
        AND CONVERT(varchar(36), va.[publicId]) = a.[resourcePublicId]))
    OR (a.[resourceType] = 'document'
      AND ((a.[action] = 'document.previewed' AND ${team}) OR a.[action] = 'document.reupload-requested')
      AND EXISTS (SELECT 1 FROM [dbo].[VendorAssignment] va
        JOIN [dbo].[Document] d ON d.[id] = va.[documentId]
        WHERE ${ownAssignment(actor)} ${request}
        AND CONVERT(varchar(36), d.[publicId]) = a.[resourcePublicId]))
    ${teamUsers}
  )`;
}

/** Allowlisted columns plus request / team-user context; never audit JSON, IPs or keys. */
export function vendorActivityMetadata(actor: Actor) {
  return Prisma.sql`
    CONVERT(varchar(36), a.[publicId]) AS [id], a.[action], a.[resourceType], a.[createdAt],
    COALESCE(u.[displayName], 'System') AS [actorName],
    CAST(CASE WHEN ${byVendorTeam(actor)} THEN 1 ELSE 0 END AS bit) AS [byVendorTeam],
    ctx.[requestId], ctx.[caseNumber], ctx.[documentType], tuser.[displayName] AS [teamUserName]`;
}

export function vendorActivitySource(actor: Actor) {
  const { owner } = parties(actor);
  return Prisma.sql`[dbo].[AuditEvent] a
    LEFT JOIN [dbo].[User] u ON u.[id] = a.[actorUserId] AND u.[tenantId] = a.[tenantId]
    OUTER APPLY (
      SELECT TOP 1 CONVERT(varchar(36), va.[publicId]) AS [requestId],
        vc.[caseNumber] AS [caseNumber], d.[type] AS [documentType]
      FROM [dbo].[VendorAssignment] va
      JOIN [dbo].[VerificationCase] vc ON vc.[id] = va.[caseId]
      JOIN [dbo].[Document] d ON d.[id] = va.[documentId]
      WHERE va.[vendorUserId] = ${owner} AND (
        (a.[resourceType] = 'vendor_assignment' AND CONVERT(varchar(36), va.[publicId]) = a.[resourcePublicId])
        OR (a.[resourceType] = 'document' AND CONVERT(varchar(36), d.[publicId]) = a.[resourcePublicId]))
      ORDER BY va.[attempt] DESC
    ) ctx
    OUTER APPLY (
      SELECT TOP 1 tu.[displayName] FROM [dbo].[User] tu
      WHERE a.[resourceType] = 'user' AND tu.[vendorOwnerId] = ${owner}
        AND CONVERT(varchar(36), tu.[publicId]) = a.[resourcePublicId]
    ) tuser`;
}
