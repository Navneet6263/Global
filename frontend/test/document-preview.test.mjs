import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function fixture({ blocked = false } = {}) {
  const calls = [];
  const timers = new Map();
  const listeners = new Map();
  const tab = {
    closed: false,
    opener: {},
    document: { title: "", body: { textContent: "" } },
    location: { replace: (url) => calls.push(["navigate", url]) },
    close() {
      this.closed = true;
      calls.push(["close"]);
    },
  };
  const window = {
    open: (...args) => {
      calls.push(["open", ...args]);
      return blocked ? null : tab;
    },
    setInterval: (fn) => {
      timers.set(1, fn);
      return 1;
    },
    clearInterval: (id) => timers.delete(id),
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const URL = {
    createObjectURL: () => {
      calls.push(["create"]);
      return "blob:private-preview";
    },
    revokeObjectURL: (url) => calls.push(["revoke", url]),
  };
  const exports = {};
  const source = readFileSync(
    new URLConstructor("../src/lib/backend-api/document-preview.ts", import.meta.url),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("exports", "window", "URL", code)(exports, window, URL);
  return { ...exports, calls, timers, listeners, tab };
}
const URLConstructor = URL;

test("preview opens during the click, severs opener and waits for authenticated content", async () => {
  const f = fixture();
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  const pending = f.openDocumentPreview(() => {
    f.calls.push(["fetch"]);
    return promise;
  });
  assert.deepEqual(f.calls, [["open", "about:blank", "_blank"], ["fetch"]]);
  assert.equal(f.tab.opener, null);
  assert.match(f.tab.document.body.textContent, /Opening secure document/);
  release(new Blob(["test"], { type: "application/pdf" }));
  await pending;
  assert.deepEqual(f.calls.at(-1), ["navigate", "blob:private-preview"]);
  f.timers.get(1)();
  assert.equal(
    f.calls.some(([action]) => action === "revoke"),
    false,
  );
  f.tab.closed = true;
  f.timers.get(1)();
  assert.deepEqual(f.calls.at(-1), ["revoke", "blob:private-preview"]);
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
});

test("blocked popups do not fetch document content", async () => {
  const f = fixture({ blocked: true });
  await assert.rejects(
    f.openDocumentPreview(() => {
      throw new Error("Should not fetch");
    }),
    /Allow pop-ups/,
  );
  assert.equal(f.calls.length, 1);
});

test("access failures close the blank tab and propagate the real error", async () => {
  const f = fixture();
  await assert.rejects(
    f.openDocumentPreview(() => Promise.reject(new Error("Access denied"))),
    /Access denied/,
  );
  assert.equal(f.tab.closed, true);
  assert.equal(
    f.calls.some(([action]) => action === "navigate"),
    false,
  );
});

test("HTML and SVG cannot be navigated as an authenticated document preview", async () => {
  for (const type of ["text/html", "image/svg+xml"]) {
    const f = fixture();
    await assert.rejects(
      f.openDocumentPreview(() => Promise.resolve(new Blob(["test"], { type }))),
      /cannot be previewed/,
    );
    assert.equal(f.tab.closed, true);
    assert.equal(
      f.calls.some(([action]) => action === "create"),
      false,
    );
  }
});

test("closing the loading tab does not retain document bytes or reopen it", async () => {
  const f = fixture();
  await f.openDocumentPreview(async () => {
    f.tab.closed = true;
    return new Blob(["test"], { type: "image/png" });
  });
  assert.equal(
    f.calls.some(([action]) => action === "create"),
    false,
  );
  assert.equal(f.timers.size, 0);
});

test("leaving the source page releases the object URL and timer", async () => {
  const f = fixture();
  await f.openDocumentPreview(() => Promise.resolve(new Blob(["test"], { type: "image/jpeg" })));
  f.listeners.get("pagehide")();
  assert.deepEqual(f.calls.at(-1), ["revoke", "blob:private-preview"]);
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
});
