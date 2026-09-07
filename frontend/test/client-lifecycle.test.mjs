import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, test } from "node:test";
import ts from "typescript";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});
const asModule = (source) =>
  `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const scope = asModule(
  await readFile(new URL("../src/lib/backend-api/request-scope.ts", import.meta.url), "utf8"),
);
async function client() {
  const source = (
    await readFile(new URL("../src/lib/backend-api/client.ts", import.meta.url), "utf8")
  )
    .replace(
      'import { API_BASE_URL as apiBase } from "@/config/api";',
      'const apiBase = "http://test.invalid/api/v1";',
    )
    .replace('from "./request-scope"', `from "${scope}"`);
  return import(asModule(source + `\n// isolated test ${crypto.randomUUID()}`));
}

test("duplicate reads share a request but writes invalidate pending read reuse", async () => {
  globalThis.window = { localStorage: { getItem: () => null, setItem: () => undefined } };
  let calls = 0;
  let finish;
  globalThis.fetch = (_url, init) => {
    calls++;
    if (init.method === "POST") return Promise.resolve(new Response("{}", { status: 200 }));
    if (calls === 1)
      return new Promise((resolve) => {
        finish = resolve;
      });
    return Promise.resolve(new Response('{"updated":true}'));
  };
  const api = await client();
  const first = api.apiRequest("/cases");
  assert.equal(first, api.apiRequest("/cases"));
  await api.apiRequest("/cases", { method: "POST", body: "{}" });
  const fresh = api.apiRequest("/cases");
  assert.notEqual(first, fresh);
  finish(new Response('{"updated":false}'));
  assert.deepEqual(await fresh, { updated: true });
  await first;
  assert.equal(calls, 3);
});

test("a public invitation rejection never refreshes or signs out the staff session", async () => {
  let calls = 0;
  let expired = false;
  globalThis.fetch = () => {
    calls++;
    return Promise.resolve(new Response('{"status":401,"detail":"Link expired"}', { status: 401 }));
  };
  const api = await client();
  api.registerSessionExpiryHandler(() => {
    expired = true;
  });
  await assert.rejects(api.apiRequest("/public/candidate-access/expired"), /Link expired/);
  assert.equal(calls, 1);
  assert.equal(expired, false);
});

test("a late error body from a previous session cannot expire a newly signed-in session", async () => {
  let finish;
  let expired = false;
  globalThis.fetch = () =>
    Promise.resolve({
      status: 401,
      ok: false,
      json: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
  const api = await client();
  api.registerSessionExpiryHandler(() => {
    expired = true;
  });
  const pending = api.apiRequest("/cases", {}, false);
  await new Promise((resolve) => setTimeout(resolve, 0));
  api.resetApiSession();
  finish({ status: 401, detail: "Old session expired" });
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(expired, false);
});
