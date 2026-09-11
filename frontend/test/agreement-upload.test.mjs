import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Run the actual upload client, HTTP wrapper and hashing helper; only fetch is replaced.
function loadClient() {
  const modules = new Map();
  function load(url) {
    if (modules.has(url.href)) return modules.get(url.href);
    const exports = {};
    modules.set(url.href, exports);
    const code = ts.transpileModule(readFileSync(url, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const require = (id) => {
      if (id === "@/config/api") return { API_BASE_URL: "https://test.invalid/api/v1" };
      assert.ok(id.startsWith("./"), `Unexpected dependency: ${id}`);
      return load(new URL(`${id}.ts`, url));
    };
    new Function("require", "exports", code)(require, exports);
    return exports;
  }
  return load(new URL("../src/lib/backend-api/agreement-files.ts", import.meta.url));
}

test("agreement upload sends the exact file digest with authenticated multipart headers", async (t) => {
  const bytes = Buffer.from("Synthetic contract fixture; not a real client document.");
  const file = new File([bytes], "service-agreement.pdf", { type: "application/pdf" });
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    requests++;
    assert.equal(url, "https://test.invalid/api/v1/clients/client-1/agreements/agreement-1/files");
    assert.equal(init.method, "POST");
    assert.equal(init.credentials, "include");
    assert.match(init.headers.get("idempotency-key"), /^[a-f0-9-]{36}$/);
    assert.equal(
      init.headers.has("content-type"),
      false,
      "browser supplies the multipart boundary",
    );
    assert.equal(
      init.headers.get("x-content-sha256"),
      createHash("sha256").update(bytes).digest("hex"),
    );
    const uploaded = init.body.get("file");
    assert.equal(uploaded.name, file.name);
    assert.equal(uploaded.type, file.type);
    assert.deepEqual(Buffer.from(await uploaded.arrayBuffer()), bytes);
    return Response.json({ id: "file-1", revision: 1 }, { status: 201 });
  });
  assert.deepEqual(await loadClient().uploadAgreementFile("client-1", "agreement-1", file), {
    id: "file-1",
    revision: 1,
  });
  assert.equal(requests, 1);
});

test("agreement inspection errors reach the caller without silently retrying the upload", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return Response.json(
      { status: 400, detail: "PDF appears blank and has no usable content" },
      { status: 400 },
    );
  });
  await assert.rejects(
    loadClient().uploadAgreementFile("client-1", "agreement-1", new File(["blank"], "blank.pdf")),
    /PDF appears blank and has no usable content/,
  );
  assert.equal(requests, 1);
});

test("an unreadable file is rejected before any upload request", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return Response.json({});
  });
  const file = new File(["contract"], "contract.pdf", { type: "application/pdf" });
  t.mock.method(file, "arrayBuffer", async () => {
    throw new Error("Unable to read selected file");
  });
  await assert.rejects(
    loadClient().uploadAgreementFile("client-1", "agreement-1", file),
    /Unable to read selected file/,
  );
  assert.equal(requests, 0);
});
