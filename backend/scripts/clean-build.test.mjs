import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { cleanBuildOutput } from "./clean-build.mjs";

const directory = { isSymbolicLink: () => false, isDirectory: () => true };
const failure = (code) => Object.assign(new Error(code), { code });

test("cleanup targets only backend/dist and requests bounded lock retries", async () => {
  const expected = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
  let removed = false;
  await cleanBuildOutput({
    lstat: async (path) => {
      assert.equal(path, expected);
      return directory;
    },
    rm: async (path, options) => {
      assert.equal(path, expected);
      assert.deepEqual(options, {
        recursive: true,
        force: true,
        maxRetries: 6,
        retryDelay: 200,
      });
      removed = true;
    },
  });
  assert.equal(removed, true);
});

test("missing output is safe on a first build", async () => {
  await cleanBuildOutput({
    lstat: async () => {
      throw failure("ENOENT");
    },
    rm: async () => assert.fail("There is no output to remove"),
  });
});

test("a redirected output folder is never recursively removed", async () => {
  await assert.rejects(
    cleanBuildOutput({
      lstat: async () => ({ ...directory, isSymbolicLink: () => true }),
      rm: async () => assert.fail("A directory link must not be followed"),
    }),
    /normal generated directory/,
  );
});

test("persistent Windows locks fail clearly instead of starting an incomplete build", async () => {
  await assert.rejects(
    cleanBuildOutput({
      lstat: async () => directory,
      rm: async () => {
        throw failure("EPERM");
      },
    }),
    /Close any other Sapling backend watch\/build/,
  );
});

test("all compiling npm entrypoints use one cleanup and colocate the incremental cache", async () => {
  const readJson = async (name) =>
    JSON.parse(await readFile(new URL(`../${name}`, import.meta.url), "utf8"));
  const { scripts } = await readJson("package.json");
  for (const entry of ["build", "dev", "start:dev", "start:e2e"]) {
    assert.equal(scripts[`pre${entry}`], "node scripts/clean-build.mjs");
  }
  assert.equal(
    (await readJson("nest-cli.json")).compilerOptions.deleteOutDir,
    false,
  );
  assert.equal(
    (await readJson("tsconfig.build.json")).compilerOptions.tsBuildInfoFile,
    "./dist/tsconfig.build.tsbuildinfo",
  );
});
