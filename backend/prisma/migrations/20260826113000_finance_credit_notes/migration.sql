ALTER TABLE [dbo].[Invoice]
ADD [creditedAmount] DECIMAL(18,2) NOT NULL
CONSTRAINT [Invoice_creditedAmount_df] DEFAULT 0;

CREATE TABLE [dbo].[CreditNote] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [invoiceId] BIGINT NOT NULL,
    [createdById] BIGINT NOT NULL,
    [noteNumber] VARCHAR(40) NOT NULL,
    [amount] DECIMAL(18,2) NOT NULL,
    [reason] NVARCHAR(500) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CreditNote_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CreditNote_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CreditNote_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [CreditNote_tenantId_noteNumber_key] UNIQUE NONCLUSTERED ([tenantId], [noteNumber])
);

CREATE NONCLUSTERED INDEX [CreditNote_invoiceId_createdAt_idx]
ON [dbo].[CreditNote]([invoiceId], [createdAt]);

CREATE NONCLUSTERED INDEX [CreditNote_tenantId_createdAt_idx]
ON [dbo].[CreditNote]([tenantId], [createdAt]);

ALTER TABLE [dbo].[CreditNote] ADD CONSTRAINT [CreditNote_tenantId_fkey]
FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[CreditNote] ADD CONSTRAINT [CreditNote_invoiceId_fkey]
FOREIGN KEY ([invoiceId]) REFERENCES [dbo].[Invoice]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[CreditNote] ADD CONSTRAINT [CreditNote_createdById_fkey]
FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
