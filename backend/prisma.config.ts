import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const escaped = (name: "DB_NAME" | "DB_USER" | "DB_PASSWORD") =>
  `{${env(name).replaceAll("}", "}}")}}`;
const datasourceUrl = `sqlserver://${env("DB_HOST")}:${env("DB_PORT")};database=${escaped("DB_NAME")};user=${escaped("DB_USER")};password=${escaped("DB_PASSWORD")};encrypt=${process.env.DB_ENCRYPT ?? "true"};trustServerCertificate=${process.env.DB_TRUST_SERVER_CERTIFICATE ?? "false"}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: datasourceUrl },
});
