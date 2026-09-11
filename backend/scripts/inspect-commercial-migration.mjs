import 'dotenv/config';
import sql from 'mssql';

// Read-only recovery diagnostic; never prints connection credentials or row data.
const db = await sql.connect({
  server: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
});
try {
  const result = await db.request().query(`
    SELECT migration_name,finished_at,rolled_back_at,applied_steps_count
    FROM dbo._prisma_migrations
    WHERE migration_name = '20260909120000_commercial_source_controls';
    SELECT OBJECT_NAME(object_id) AS table_name,name FROM sys.columns
    WHERE (OBJECT_NAME(object_id) = 'SalesOpportunity' AND name IN ('followUpSequenceStartedAt','followUpSequenceStep'))
       OR (OBJECT_NAME(object_id) = 'VerificationMethodRun' AND name = 'nextFollowUpAt')
       OR (OBJECT_NAME(object_id) = 'Client' AND name IN ('creditHold','creditLimit','creditControlReason'))
       OR (OBJECT_NAME(object_id) = 'VerificationCase' AND name IN ('retentionHoldAt','retentionHoldReason'));
    SELECT name FROM sys.tables
    WHERE name IN ('SourceOutreach','CrmProposal','ClientAgreementFile','VendorSharingRecord');
  `);
  console.log(JSON.stringify(result.recordsets));
} finally {
  await db.close();
}
