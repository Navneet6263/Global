import { z } from "zod";
import { ttlSeconds } from "./ttl";

const booleanString = (fallback: "true" | "false") =>
  z
    .enum(["true", "false"])
    .default(fallback)
    .transform((value) => value === "true");

const canonicalOrigin = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  }, "must contain only a scheme, host and optional port");
const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? undefined : value),
  z.string().url().optional(),
);
const optionalCanonicalOrigin = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? undefined : value),
  canonicalOrigin.optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),
    PROCESS_ROLE: z.enum(["all", "api", "worker", "migration"]).default("all"),
    WEB_ORIGIN: canonicalOrigin.default("http://localhost:3000"),
    PUBLIC_API_ORIGIN: optionalCanonicalOrigin,
    TRUST_PROXY: z.string().default("false"),
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
    DATA_ENCRYPTION_KEY_VERSION: z.coerce.number().int().positive().default(1),
    DATA_ENCRYPTION_PREVIOUS_KEYS: z.string().optional(),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL: z.string().default("7d"),
    COOKIE_SECURE: booleanString("false"),
    OBJECT_STORAGE_DRIVER: z.enum(["local", "s3", "azure"]).default("local"),
    OBJECT_STORAGE_BUCKET: z.string().default("sapling-global-private"),
    OBJECT_STORAGE_PATH: z.string().default(".data/objects"),
    S3_REGION: z.string().optional(),
    S3_ENDPOINT: optionalUrl,
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: booleanString("false"),
    AZURE_STORAGE_CONNECTION_STRING: z.string().optional(),
    AZURE_STORAGE_ACCOUNT_URL: optionalUrl,
    UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10_485_760),
    UPLOAD_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),
    UPLOAD_PER_ACTOR_CONCURRENCY: z.coerce
      .number()
      .int()
      .min(1)
      .max(8)
      .default(2),
    NOTIFICATION_WEBHOOK_URL: optionalUrl,
    NOTIFICATION_HEALTH_URL: optionalUrl,
    NOTIFICATION_WEBHOOK_SECRET: z.string().min(32).optional(),
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
    IDEMPOTENCY_CLEANUP_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(60_000)
      .max(86_400_000)
      .default(3_600_000),
    CLAMAV_HOST: z.string().optional(),
    CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
    MALWARE_SCAN_REQUIRED: booleanString("false"),
  })
  .superRefine((value, context) => {
    for (const [name, ttl, minimum, maximum] of [
      ["JWT_ACCESS_TTL", value.JWT_ACCESS_TTL, 300, 3_600],
      ["JWT_REFRESH_TTL", value.JWT_REFRESH_TTL, 86_400, 30 * 86_400],
    ] as const) {
      try {
        const seconds = ttlSeconds(ttl);
        if (seconds < minimum || seconds > maximum)
          throw new Error("out of bounds");
      } catch {
        context.addIssue({
          code: "custom",
          path: [name],
          message: `${name} has an invalid format or duration`,
        });
      }
    }
    if (value.DATA_ENCRYPTION_PREVIOUS_KEYS) {
      try {
        const previous = JSON.parse(
          value.DATA_ENCRYPTION_PREVIOUS_KEYS,
        ) as unknown;
        if (
          !previous ||
          Array.isArray(previous) ||
          typeof previous !== "object" ||
          Object.entries(previous).some(
            ([version, key]) =>
              !/^[1-9]\d*$/.test(version) ||
              typeof key !== "string" ||
              key.length < 32,
          )
        ) {
          throw new Error("invalid key ring");
        }
        if (String(value.DATA_ENCRYPTION_KEY_VERSION) in previous) {
          context.addIssue({
            code: "custom",
            path: ["DATA_ENCRYPTION_PREVIOUS_KEYS"],
            message:
              "The active data-encryption version cannot also be previous",
          });
        }
      } catch {
        context.addIssue({
          code: "custom",
          path: ["DATA_ENCRYPTION_PREVIOUS_KEYS"],
          message:
            "Previous data-encryption keys must be a JSON version-to-key object",
        });
      }
    }
    if (value.DB_POOL_MIN > value.DB_POOL_MAX) {
      context.addIssue({
        code: "custom",
        path: ["DB_POOL_MIN"],
        message: "DB_POOL_MIN cannot exceed DB_POOL_MAX",
      });
    }
    if (value.NODE_ENV === "production" && value.TRUST_PROXY === "true") {
      context.addIssue({
        code: "custom",
        path: ["TRUST_PROXY"],
        message:
          "Production must trust only an explicit proxy hop count or CIDR list",
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
          value.DB_ENCRYPT,
          "DB_ENCRYPT",
          "SQL Server transport encryption is required in production",
        ],
        [
          Boolean(
            value.NOTIFICATION_WEBHOOK_URL &&
            new URL(value.NOTIFICATION_WEBHOOK_URL).protocol === "https:",
          ),
          "NOTIFICATION_WEBHOOK_URL",
          "The production notification provider webhook must use HTTPS",
        ],
        [
          Boolean(value.NOTIFICATION_WEBHOOK_SECRET),
          "NOTIFICATION_WEBHOOK_SECRET",
          "A notification webhook signing secret is required in production",
        ],
        [
          Boolean(
            value.NOTIFICATION_HEALTH_URL &&
            new URL(value.NOTIFICATION_HEALTH_URL).protocol === "https:",
          ),
          "NOTIFICATION_HEALTH_URL",
          "A production notification health endpoint must use HTTPS",
        ],
      ];
      for (const [valid, path, message] of requirements) {
        if (!valid) context.addIssue({ code: "custom", path: [path], message });
      }
      if (["all", "worker"].includes(value.PROCESS_ROLE)) {
        if (!value.OUTBOX_WORKER_ENABLED) {
          context.addIssue({
            code: "custom",
            path: ["OUTBOX_WORKER_ENABLED"],
            message:
              "The outbox worker is required for this production process role",
          });
        }
        if (!value.RETENTION_WORKER_ENABLED) {
          context.addIssue({
            code: "custom",
            path: ["RETENTION_WORKER_ENABLED"],
            message:
              "The retention worker is required for this production process role",
          });
        }
      }
      if (
        value.S3_ENDPOINT &&
        new URL(value.S3_ENDPOINT).protocol !== "https:"
      ) {
        context.addIssue({
          code: "custom",
          path: ["S3_ENDPOINT"],
          message: "Production S3 endpoints must use HTTPS",
        });
      }
      if (
        value.PUBLIC_API_ORIGIN &&
        new URL(value.PUBLIC_API_ORIGIN).protocol !== "https:"
      ) {
        context.addIssue({
          code: "custom",
          path: ["PUBLIC_API_ORIGIN"],
          message: "The public API origin must use HTTPS in production",
        });
      }
      if (
        value.AZURE_STORAGE_ACCOUNT_URL &&
        new URL(value.AZURE_STORAGE_ACCOUNT_URL).protocol !== "https:"
      ) {
        context.addIssue({
          code: "custom",
          path: ["AZURE_STORAGE_ACCOUNT_URL"],
          message: "Production Azure storage must use HTTPS",
        });
      }
      if (
        value.AZURE_STORAGE_CONNECTION_STRING &&
        !/(?:^|;)DefaultEndpointsProtocol=https(?:;|$)/i.test(
          value.AZURE_STORAGE_CONNECTION_STRING,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["AZURE_STORAGE_CONNECTION_STRING"],
          message: "Production Azure connection strings must require HTTPS",
        });
      }
      if (
        value.NOTIFICATION_WEBHOOK_SECRET &&
        [
          value.JWT_ACCESS_SECRET,
          value.JWT_REFRESH_SECRET,
          value.DATA_ENCRYPTION_KEY,
        ].includes(value.NOTIFICATION_WEBHOOK_SECRET)
      ) {
        context.addIssue({
          code: "custom",
          path: ["NOTIFICATION_WEBHOOK_SECRET"],
          message: "The notification signing secret must be independent",
        });
      }
    }
    if (value.OBJECT_STORAGE_DRIVER === "s3") {
      if (!value.S3_REGION) {
        context.addIssue({
          code: "custom",
          path: ["S3_REGION"],
          message: "S3_REGION is required for S3 storage",
        });
      }
      if (
        Boolean(value.S3_ACCESS_KEY_ID) !== Boolean(value.S3_SECRET_ACCESS_KEY)
      ) {
        context.addIssue({
          code: "custom",
          path: ["S3_ACCESS_KEY_ID"],
          message:
            "Provide both static S3 credential fields or neither for workload identity",
        });
      }
    }
    if (
      value.OBJECT_STORAGE_DRIVER === "azure" &&
      !value.AZURE_STORAGE_CONNECTION_STRING &&
      !value.AZURE_STORAGE_ACCOUNT_URL
    ) {
      context.addIssue({
        code: "custom",
        path: ["AZURE_STORAGE_ACCOUNT_URL"],
        message:
          "Azure storage requires an account URL for managed identity or a connection string",
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
