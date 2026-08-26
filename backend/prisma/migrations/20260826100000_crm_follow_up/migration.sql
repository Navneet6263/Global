ALTER TABLE [SalesOpportunity]
ADD [nextFollowUpAt] DATETIME2 NULL,
    [lostReason] NVARCHAR(500) NULL;

CREATE INDEX [SalesOpportunity_tenantId_ownerId_nextFollowUpAt_idx]
ON [SalesOpportunity]([tenantId], [ownerId], [nextFollowUpAt]);
