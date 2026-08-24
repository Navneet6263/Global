import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ConfigService } from "@nestjs/config";
import { LocalObjectStorageService } from "../src/documents/local-object-storage.service";

void test("local object storage uses immutable keys", async () => {
  const root = await mkdtemp(join(tmpdir(), "sapling-object-test-"));
  const storage = new LocalObjectStorageService(
    new ConfigService({
      OBJECT_STORAGE_DRIVER: "local",
      OBJECT_STORAGE_PATH: root,
    }),
  );
  try {
    await storage.put("tenant/case/document/v1-unique", Buffer.from("first"));
    await assert.rejects(
      storage.put("tenant/case/document/v1-unique", Buffer.from("second")),
      (error: unknown) =>
        Boolean(
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "EEXIST",
        ),
    );
    assert.equal(
      (await storage.get("tenant/case/document/v1-unique")).toString(),
      "first",
    );
    await assert.rejects(
      storage.put("../escape", Buffer.from("unsafe")),
      /Invalid object key/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
