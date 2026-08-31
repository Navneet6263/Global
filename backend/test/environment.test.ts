import assert from "node:assert/strict";
import { test } from "node:test";
import { validateEnvironment } from "../src/config/env";

const base = {
  DB_NAME: "Sapling Global",
  DB_USER: "application-user",
  DB_PASSWORD: "database-password",
  JWT_ACCESS_SECRET: "access-secret-0123456789abcdef0123456789",
  JWT_REFRESH_SECRET: "refresh-secret-0123456789abcdef01234567",
};

void test("production environment accepts only hardened infrastructure settings", () => {
  const environment = validateEnvironment({
    ...base,
    NODE_ENV: "production",
    WEB_ORIGIN: "https://verify.sapling.example",
    COOKIE_SECURE: "true",
    DATA_ENCRYPTION_KEY: "data-key-0123456789abcdef0123456789abcd",
    OBJECT_STORAGE_DRIVER: "s3",
    S3_REGION: "ap-south-1",
    S3_ACCESS_KEY_ID: "test-access-key",
    S3_SECRET_ACCESS_KEY: "test-secret-key",
    MALWARE_SCAN_REQUIRED: "true",
    CLAMAV_HOST: "clamav.internal",
    NOTIFICATION_WEBHOOK_URL: "https://notify.sapling.example/events",
    NOTIFICATION_HEALTH_URL: "https://notify.sapling.example/health",
    NOTIFICATION_WEBHOOK_SECRET: "notify-secret-0123456789abcdef012345678",
  });

  assert.equal(environment.NODE_ENV, "production");
  assert.equal(environment.COOKIE_SECURE, true);
  assert.equal(environment.DB_TRUST_SERVER_CERTIFICATE, false);
  assert.equal(environment.MALWARE_SCAN_REQUIRED, true);
});

void test("production environment rejects every insecure fallback", () => {
  assert.throws(
    () =>
      validateEnvironment({
        ...base,
        NODE_ENV: "production",
        WEB_ORIGIN: "http://localhost:3000",
        COOKIE_SECURE: "false",
        OBJECT_STORAGE_DRIVER: "local",
        MALWARE_SCAN_REQUIRED: "false",
        DB_ENCRYPT: "false",
        DB_TRUST_SERVER_CERTIFICATE: "true",
        NOTIFICATION_WEBHOOK_URL: "http://notify.internal/events",
      }),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      for (const key of [
        "DATA_ENCRYPTION_KEY",
        "COOKIE_SECURE",
        "WEB_ORIGIN",
        "OBJECT_STORAGE_DRIVER",
        "MALWARE_SCAN_REQUIRED",
        "DB_ENCRYPT",
        "DB_TRUST_SERVER_CERTIFICATE",
        "NOTIFICATION_WEBHOOK_URL",
        "NOTIFICATION_WEBHOOK_SECRET",
      ]) {
        assert.match(message, new RegExp(key));
      }
      return true;
    },
  );
});

void test("cryptographic duties require independent secrets", () => {
  assert.throws(
    () =>
      validateEnvironment({
        ...base,
        JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET,
      }),
    /JWT access and refresh secrets must be different/,
  );
  assert.throws(
    () =>
      validateEnvironment({
        ...base,
        DATA_ENCRYPTION_KEY: base.JWT_ACCESS_SECRET,
      }),
    /data-encryption key must be independent/,
  );
});

void test("database pool configuration rejects an impossible minimum", () => {
  assert.throws(
    () =>
      validateEnvironment({
        ...base,
        DB_POOL_MIN: "5",
        DB_POOL_MAX: "4",
      }),
    /DB_POOL_MIN cannot exceed DB_POOL_MAX/,
  );
});

void test("database transaction timeouts are bounded and production-safe", () => {
  const environment = validateEnvironment(base);
  assert.equal(environment.DB_TRANSACTION_MAX_WAIT_MS, 10_000);
  assert.equal(environment.DB_TRANSACTION_TIMEOUT_MS, 30_000);
  assert.throws(
    () =>
      validateEnvironment({
        ...base,
        DB_TRANSACTION_TIMEOUT_MS: "121000",
      }),
    /DB_TRANSACTION_TIMEOUT_MS/,
  );
});

void test("production object storage cannot use plaintext transport", () => {
  const production = {
    ...base,
    NODE_ENV: "production",
    WEB_ORIGIN: "https://verify.sapling.example",
    COOKIE_SECURE: "true",
    DATA_ENCRYPTION_KEY: "data-key-0123456789abcdef0123456789abcd",
    OBJECT_STORAGE_DRIVER: "s3",
    S3_REGION: "ap-south-1",
    MALWARE_SCAN_REQUIRED: "true",
    CLAMAV_HOST: "clamav.internal",
    NOTIFICATION_WEBHOOK_URL: "https://notify.sapling.example/events",
    NOTIFICATION_HEALTH_URL: "https://notify.sapling.example/health",
    NOTIFICATION_WEBHOOK_SECRET: "notify-secret-0123456789abcdef012345678",
  };
  assert.throws(
    () => validateEnvironment({ ...production, S3_ENDPOINT: "http://minio.internal" }),
    /S3_ENDPOINT/,
  );
  assert.throws(
    () =>
      validateEnvironment({
        ...production,
        OBJECT_STORAGE_DRIVER: "azure",
        S3_REGION: undefined,
        AZURE_STORAGE_ACCOUNT_URL: "http://storage.internal",
      }),
    /AZURE_STORAGE_ACCOUNT_URL/,
  );
  assert.throws(
    () =>
      validateEnvironment({
        ...production,
        PUBLIC_API_ORIGIN: "http://api.sapling.example",
      }),
    /PUBLIC_API_ORIGIN/,
  );
});

void test("JWT TTLs use one bounded grammar", () => {
  assert.throws(() => validateEnvironment({ ...base, JWT_ACCESS_TTL: "15 minutes" }), /JWT_ACCESS_TTL/);
  assert.throws(() => validateEnvironment({ ...base, JWT_REFRESH_TTL: "12h" }), /JWT_REFRESH_TTL/);
  const valid = validateEnvironment({ ...base, JWT_ACCESS_TTL: "30m", JWT_REFRESH_TTL: "14d" });
  assert.equal(valid.JWT_ACCESS_TTL, "30m");
  assert.equal(valid.JWT_REFRESH_TTL, "14d");
});

void test("production rejects trust-all forwarding", () => {
  assert.throws(
    () =>
      validateEnvironment({
        ...base,
        NODE_ENV: "production",
        TRUST_PROXY: "true",
      }),
    /TRUST_PROXY/,
  );
});

void test("public origins cannot contain credentials, paths, queries or fragments", () => {
  for (const origin of [
    "https://user:secret@verify.sapling.example",
    "https://verify.sapling.example/application",
    "https://verify.sapling.example?tenant=sapling",
    "https://verify.sapling.example#dashboard",
  ]) {
    assert.throws(() => validateEnvironment({ ...base, WEB_ORIGIN: origin }), /WEB_ORIGIN/);
  }
  assert.equal(
    validateEnvironment({ ...base, PUBLIC_API_ORIGIN: "", S3_ENDPOINT: "" })
      .PUBLIC_API_ORIGIN,
    undefined,
  );
});
