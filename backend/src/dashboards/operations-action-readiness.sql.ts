import { Prisma } from "../generated/prisma/client";
import { DOCUMENT_TYPES } from "../documents/evidence-readiness";

/** c = scoped case. Latest document of each type, as in documentReadiness(). */
export const currentDocument = Prisma.sql`NOT EXISTS (
  SELECT 1 FROM [dbo].[Document] newer WHERE newer.[caseId] = d.[caseId]
  AND newer.[type] = d.[type] AND (newer.[createdAt] > d.[createdAt]
    OR (newer.[createdAt] = d.[createdAt] AND newer.[id] > d.[id])))`;

export function intakeReadySql(today: Date) {
  return Prisma.sql`
    EXISTS (SELECT 1 FROM [dbo].[Consent] co WHERE co.[caseId] = c.[id] AND co.[status] = 'ACCEPTED')
    AND NOT EXISTS (SELECT 1 FROM [dbo].[Document] d WHERE d.[caseId] = c.[id]
      AND ${currentDocument} AND d.[status] IN ('REJECTED', 'REUPLOAD_REQUIRED', 'AVAILABLE'))
    AND NOT EXISTS (
      SELECT 1 FROM [dbo].[CaseService] s WHERE s.[caseId] = c.[id] AND (
        ISJSON(s.[requiredDocumentsJson]) <> 1 OR LEFT(LTRIM(s.[requiredDocumentsJson]), 1) <> '['
        OR EXISTS (
          SELECT 1 FROM OPENJSON(CASE WHEN ISJSON(s.[requiredDocumentsJson]) = 1
            THEN s.[requiredDocumentsJson] ELSE '[]' END) requirement
          WHERE requirement.[type] <> 1 OR requirement.[value] NOT IN (${Prisma.join([...DOCUMENT_TYPES])})
          OR NOT EXISTS (SELECT 1 FROM [dbo].[Document] d
            WHERE d.[caseId] = c.[id] AND d.[type] = requirement.[value]
            AND ${currentDocument} AND d.[status] = 'VERIFIED' AND d.[currentVersion] > 0
            AND (d.[expiresAt] IS NULL OR d.[expiresAt] >= ${today}))
        )
      )
    )`;
}
