import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const datasourceUrl =
  process.env.DATABASE_URL ??
  `sqlserver://${env("DB_HOST")}:${env("DB_PORT")};database=${env("DB_NAME")};user=${env("DB_USER")};password=${env("DB_PASSWORD")};encrypt=${process.env.DB_ENCRYPT ?? "true"};trustServerCertificate=${process.env.DB_TRUST_SERVER_CERTIFICATE ?? "false"}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: datasourceUrl },
});
