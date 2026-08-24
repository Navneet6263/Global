import { z } from "zod";

const booleanString = (fallback: "true" | "false") =>
  z
    .enum(["true", "false"])
    .default(fallback)
    .transform((value) => value === "true");

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),
    WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
    TRUST_PROXY: booleanString("false"),
    DATABASE_URL: z.string().min(1).optional(),
    DB_HOST: z.string().default("localhost"),
    DB_PORT: z.coerce.number().int().positive().default(1433),
    DB_NAME: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(8),
    DB_ENCRYPT: booleanString("true"),
    DB_TRUST_SERVER_CERTIFICATE: booleanString("false"),
    DB_POOL_MIN: z.coerce.number().int().min(0).max(20).default(2),
    DB_POOL_MAX: z.coerce.number().int().min(2).max(100).default(20),
    DB_CONNECTION_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(5000)
      .max(120_000)
      .default(30_000),
    DB_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(5000)
      .max(300_000)
      .default(30_000),
    DB_TRANSACTION_MAX_WAIT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(60_000)
      .default(10_000),
    DB_TRANSACTION_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(5000)
      .max(120_000)
      .default(30_000),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    DATA_ENCRYPTION_KEY: z.string().min(32).optional(),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL: z.string().default("7d"),
    COOKIE_SECURE: booleanString("false"),
    OBJECT_STORAGE_DRIVER: z.enum(["local", "s3", "azure"]).default("local"),
    OBJECT_STORAGE_BUCKET: z.string().default("sapling-global-private"),
    OBJECT_STORAGE_PATH: z.string().default(".data/objects"),
    S3_REGION: z.string().optional(),
    S3_ENDPOINT: z.string().url().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: booleanString("false"),
    AZURE_STORAGE_CONNECTION_STRING: z.string().optional(),
    UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10_485_760),
    NOTIFICATION_WEBHOOK_URL: z.string().url().optional(),
    OUTBOX_WORKER_ENABLED: booleanString("true"),
    OUTBOX_POLL_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(60_000)
      .default(5000),
    RETENTION_WORKER_ENABLED: booleanString("true"),
    RETENTION_POLL_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(60_000)
      .max(604_800_000)
      .default(86_400_000),
    CLAMAV_HOST: z.string().optional(),
    CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
    MALWARE_SCAN_REQUIRED: booleanString("false"),
  })
  .superRefine((value, context) => {
    if (value.DB_POOL_MIN > value.DB_POOL_MAX) {
      context.addIssue({
        code: "custom",
        path: ["DB_POOL_MIN"],
        message: "DB_POOL_MIN cannot exceed DB_POOL_MAX",
      });
    }
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "JWT access and refresh secrets must be different",
      });
    }
    if (value.NODE_ENV === "production" && !value.DATA_ENCRYPTION_KEY) {
      context.addIssue({
        code: "custom",
        path: ["DATA_ENCRYPTION_KEY"],
        message: "DATA_ENCRYPTION_KEY is required in production",
      });
    }
    if (
      value.DATA_ENCRYPTION_KEY &&
      [value.JWT_ACCESS_SECRET, value.JWT_REFRESH_SECRET].includes(
        value.DATA_ENCRYPTION_KEY,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["DATA_ENCRYPTION_KEY"],
        message: "The data-encryption key must be independent from JWT secrets",
      });
    }
    if (value.NODE_ENV === "production") {
      const requirements: Array<[boolean, keyof typeof value, string]> = [
        [
          value.COOKIE_SECURE,
          "COOKIE_SECURE",
          "Secure cookies are required in production",
        ],
        [
          new URL(value.WEB_ORIGIN).protocol === "https:",
          "WEB_ORIGIN",
          "WEB_ORIGIN must use HTTPS in production",
        ],
        [
          value.OBJECT_STORAGE_DRIVER !== "local",
          "OBJECT_STORAGE_DRIVER",
          "Private S3 or Azure object storage is required in production",
        ],
        [
          value.MALWARE_SCAN_REQUIRED,
          "MALWARE_SCAN_REQUIRED",
          "Malware scanning must be mandatory in production",
        ],
        [
          !value.DB_TRUST_SERVER_CERTIFICATE,
          "DB_TRUST_SERVER_CERTIFICATE",
          "SQL Server certificate verification must be enabled in production",
        ],
        [
          Boolean(value.NOTIFICATION_WEBHOOK_URL),
          "NOTIFICATION_WEBHOOK_URL",
          "A notification provider webhook is required in production",
        ],
      ];
      for (const [valid, path, message] of requirements) {
        if (!valid) context.addIssue({ code: "custom", path: [path], message });
      }
    }
    if (value.OBJECT_STORAGE_DRIVER === "s3") {
      for (const key of [
        "S3_REGION",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
      ] as const) {
        if (!value[key])
          context.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required for S3 storage`,
          });
      }
    }
    if (
      value.OBJECT_STORAGE_DRIVER === "azure" &&
      !value.AZURE_STORAGE_CONNECTION_STRING
    ) {
      context.addIssue({
        code: "custom",
        path: ["AZURE_STORAGE_CONNECTION_STRING"],
        message:
          "AZURE_STORAGE_CONNECTION_STRING is required for Azure storage",
      });
    }
    if (value.MALWARE_SCAN_REQUIRED && !value.CLAMAV_HOST) {
      context.addIssue({
        code: "custom",
        path: ["CLAMAV_HOST"],
        message: "CLAMAV_HOST is required when malware scanning is mandatory",
      });
    }
  });

export type Environment = z.infer<typeof envSchema>;

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid environment: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}
