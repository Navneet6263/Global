import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Run the actual vendor API, HTTP wrapper and hashing helper; only fetch is replaced.
function loadVendorApi() {
  const modules = new Map();
  const src = new URL("../src/", import.meta.url);
  function load(url) {
    if (modules.has(url.href)) return modules.get(url.href);
    const exports = {};
    modules.set(url.href, exports);
    const code = ts.transpileModule(readFileSync(url, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const require = (id) => {
      if (id === "@/config/api") return { API_BASE_URL: "https://test.invalid/api/v1" };
      if (id.startsWith("@/")) return load(new URL(`${id.slice(2)}.ts`, src));
      assert.ok(id.startsWith("./"), `Unexpected dependency: ${id}`);
      return load(new URL(`${id}.ts`, url));
    };
    new Function("require", "exports", code)(require, exports);
    return exports;
  }
  return load(new URL("features/vendor/vendor-api.ts", src)).vendorApi;
}

test("report upload sends the exact file digest the server's multipart check requires", async (t) => {
  const bytes = Buffer.from("%PDF-1.4 synthetic vendor report fixture");
  const file = new File([bytes], "report.pdf", { type: "application/pdf" });
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    requests++;
    assert.equal(url, "https://test.invalid/api/v1/vendor/requests/req%201/report");
    assert.equal(init.method, "POST");
    assert.match(init.headers.get("idempotency-key"), /^[a-f0-9-]{36}$/);
    assert.equal(init.headers.has("content-type"), false, "browser supplies the boundary");
    assert.equal(
      init.headers.get("x-content-sha256"),
      createHash("sha256").update(bytes).digest("hex"),
    );
    const uploaded = init.body.get("file");
    assert.equal(uploaded.name, file.name);
    assert.deepEqual(Buffer.from(await uploaded.arrayBuffer()), bytes);
    return Response.json({ id: "report-1", version: 1 }, { status: 201 });
  });
  assert.deepEqual(await loadVendorApi().uploadReport("req 1", file), {
    id: "report-1",
    version: 1,
  });
  assert.equal(requests, 1);
});

test("an unreadable report file is rejected before any upload request", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return Response.json({});
  });
  const file = new File(["report"], "report.pdf", { type: "application/pdf" });
  t.mock.method(file, "arrayBuffer", async () => {
    throw new Error("Unable to read selected file");
  });
  await assert.rejects(loadVendorApi().uploadReport("req-1", file), /Unable to read selected file/);
  assert.equal(requests, 0);
});
