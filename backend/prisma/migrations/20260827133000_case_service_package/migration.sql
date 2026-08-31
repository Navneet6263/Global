ALTER TABLE [dbo].[VerificationCase]
ADD [servicePackageId] BIGINT NULL;

CREATE NONCLUSTERED INDEX [VerificationCase_tenantId_servicePackageId_idx]
ON [dbo].[VerificationCase]([tenantId], [servicePackageId]);

ALTER TABLE [dbo].[VerificationCase]
ADD CONSTRAINT [VerificationCase_servicePackageId_fkey]
FOREIGN KEY ([servicePackageId]) REFERENCES [dbo].[ServicePackage]([id])
ON DELETE NO ACTION ON UPDATE NO ACTION;
