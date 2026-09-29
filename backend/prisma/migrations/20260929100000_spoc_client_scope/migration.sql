BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[SpocClientScope] (
    [userId] BIGINT NOT NULL,
    [clientId] BIGINT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SpocClientScope_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [SpocClientScope_pkey] PRIMARY KEY CLUSTERED ([userId],[clientId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SpocClientScope_clientId_userId_idx] ON [dbo].[SpocClientScope]([clientId], [userId]);

-- AddForeignKey
ALTER TABLE [dbo].[SpocClientScope] ADD CONSTRAINT [SpocClientScope_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SpocClientScope] ADD CONSTRAINT [SpocClientScope_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Existing SPOC-RM users keep exactly their current client: copy User.clientId into
-- the new scope table, then clear it so SpocClientScope is the only SPOC-RM scope.
-- Rollback (old code): UPDATE u SET clientId = (SELECT MIN(s.clientId) FROM SpocClientScope s
-- WHERE s.userId = u.id) FROM [dbo].[User] u WHERE u.clientId IS NULL AND EXISTS (SELECT 1
-- FROM [dbo].[SpocClientScope] s WHERE s.userId = u.id);
INSERT INTO [dbo].[SpocClientScope] ([userId], [clientId])
SELECT DISTINCT [u].[id], [u].[clientId]
FROM [dbo].[User] AS [u]
INNER JOIN [dbo].[UserRole] AS [ur] ON [ur].[userId] = [u].[id]
INNER JOIN [dbo].[Role] AS [r] ON [r].[id] = [ur].[roleId] AND [r].[code] = 'SPOC_RM'
WHERE [u].[clientId] IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM [dbo].[SpocClientScope] AS [s]
    WHERE [s].[userId] = [u].[id] AND [s].[clientId] = [u].[clientId]
  );

UPDATE [u]
SET [u].[clientId] = NULL
FROM [dbo].[User] AS [u]
WHERE [u].[clientId] IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM [dbo].[UserRole] AS [ur]
    INNER JOIN [dbo].[Role] AS [r] ON [r].[id] = [ur].[roleId] AND [r].[code] = 'SPOC_RM'
    WHERE [ur].[userId] = [u].[id]
  );

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

