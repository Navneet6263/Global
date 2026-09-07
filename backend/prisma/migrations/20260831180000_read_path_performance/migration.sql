CREATE NONCLUSTERED INDEX [User_tenantId_displayName_publicId_idx]
ON [dbo].[User]([tenantId], [displayName], [publicId]);

CREATE NONCLUSTERED INDEX [UserRole_roleId_userId_idx]
ON [dbo].[UserRole]([roleId], [userId]);

CREATE NONCLUSTERED INDEX [VerificationCase_tenantId_updatedAt_publicId_idx]
ON [dbo].[VerificationCase]([tenantId], [updatedAt], [publicId]);

CREATE NONCLUSTERED INDEX [VerificationCase_tenantId_createdAt_idx]
ON [dbo].[VerificationCase]([tenantId], [createdAt]);

CREATE NONCLUSTERED INDEX [VerificationCase_tenantId_completedAt_idx]
ON [dbo].[VerificationCase]([tenantId], [completedAt]);

CREATE NONCLUSTERED INDEX [Notification_tenantId_userId_createdAt_idx]
ON [dbo].[Notification]([tenantId], [userId], [createdAt]);
