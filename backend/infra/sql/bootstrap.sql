IF DB_ID(N'Sapling Global') IS NULL
BEGIN
  CREATE DATABASE [Sapling Global];
END;
GO

USE [Sapling Global];
GO

-- The DBA or secret-management pipeline creates SQL logins outside source
-- control. This script intentionally contains no password.
--   sapling_global_migrator: temporary schema privileges for deployment only
--   sapling_global_app:      runtime data identity, never db_owner
IF SUSER_ID(N'sapling_global_app') IS NULL
  THROW 51000, 'Create login sapling_global_app through the secret-management pipeline first.', 1;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'sapling_global_app')
BEGIN
  CREATE USER [sapling_global_app] FOR LOGIN [sapling_global_app];
END;
GO

IF DATABASE_PRINCIPAL_ID(N'sapling_global_runtime') IS NULL
  CREATE ROLE [sapling_global_runtime];
GO

IF IS_ROLEMEMBER(N'db_datareader', N'sapling_global_app') = 1
  ALTER ROLE [db_datareader] DROP MEMBER [sapling_global_app];
IF IS_ROLEMEMBER(N'db_datawriter', N'sapling_global_app') = 1
  ALTER ROLE [db_datawriter] DROP MEMBER [sapling_global_app];
GO

ALTER ROLE [sapling_global_runtime] ADD MEMBER [sapling_global_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[dbo] TO [sapling_global_runtime];
GRANT EXECUTE ON SCHEMA::[dbo] TO [sapling_global_runtime];

-- The runtime identity may append and read audit events, but can never rewrite
-- or delete them. Controlled retention/redaction runs under the separate
-- migration identity, not the application login.
DENY UPDATE, DELETE ON OBJECT::[dbo].[AuditEvent] TO [sapling_global_runtime];
DENY ALTER TO [sapling_global_app];
DENY CONTROL TO [sapling_global_app];
GO
