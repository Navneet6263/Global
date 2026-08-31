ALTER TABLE [IdempotencyKey]
ADD [responseCiphertext] NVARCHAR(MAX) NULL,
    [responseKeyVersion] INT NULL,
    [completedAt] DATETIME2 NULL;

-- Legacy responses may contain credentials or personal data. They cannot be
-- safely migrated because they were stored in plaintext, so purge them.
UPDATE [IdempotencyKey] SET [responseJson] = NULL;
