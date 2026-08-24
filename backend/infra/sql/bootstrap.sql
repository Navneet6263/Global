IF DB_ID(N'ethicstrack') IS NULL
BEGIN
  CREATE DATABASE [ethicstrack];
END;
GO

USE [ethicstrack];
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'ethicstrack_app')
BEGIN
  CREATE LOGIN [ethicstrack_app] WITH PASSWORD = 'ChangeThis_Strong_42', CHECK_POLICY = ON;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'ethicstrack_app')
BEGIN
  CREATE USER [ethicstrack_app] FOR LOGIN [ethicstrack_app];
END;
GO

-- Migration identity owns schema changes. Runtime identity receives data operations only.
ALTER ROLE [db_datareader] ADD MEMBER [ethicstrack_app];
ALTER ROLE [db_datawriter] ADD MEMBER [ethicstrack_app];
GRANT EXECUTE TO [ethicstrack_app];
DENY ALTER TO [ethicstrack_app];
DENY CONTROL TO [ethicstrack_app];
GO
