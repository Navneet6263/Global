ALTER TABLE [OutboxEvent]
ADD [claimedAt] DATETIME2 NULL,
    [claimToken] VARCHAR(64) NULL;

CREATE INDEX [OutboxEvent_status_claimedAt_idx]
ON [OutboxEvent]([status], [claimedAt]);
