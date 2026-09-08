import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, test } from "node:test";
import ts from "typescript";

const originalWindow = globalThis.window;
const originalIndexedDB = globalThis.indexedDB;
afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalIndexedDB === undefined) delete globalThis.indexedDB;
  else globalThis.indexedDB = originalIndexedDB;
  delete globalThis.sessionTabTest;
});

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  ).toString("base64")}`;
const sourceFile = (name) =>
  readFile(new URL(`../src/lib/auth/${name}.ts`, import.meta.url), "utf8");

async function createTab() {
  const scopeUrl = moduleUrl(
    (await sourceFile("device-data-scope")) + `\n// ${crypto.randomUUID()}`,
  );
  const queueUrl = moduleUrl(await sourceFile("device-operation-queue"));
  const stubsUrl = moduleUrl(`
    export async function clearFieldDrafts() { globalThis.sessionTabTest.clears++; }
    export async function clearVerifierDrafts() { globalThis.sessionTabTest.clears++; }
    export async function retainOnlyFieldDraftScope(scope) {
      globalThis.sessionTabTest.retained.push(scope);
    }
    export async function retainOnlyVerifierDraftScope(scope) {
      globalThis.sessionTabTest.retained.push(scope);
    }
    export async function purgePrivateAppShell() { globalThis.sessionTabTest.purges++; }
  `);
  const offlineSource = (await sourceFile("device-offline-data"))
    .replace('from "./device-data-scope"', `from "${scopeUrl}"`)
    .replace('from "./device-operation-queue"', `from "${queueUrl}"`)
    .replace(/from "@\/[^\"]+"/g, `from "${stubsUrl}"`);
  return { ...(await import(scopeUrl)), ...(await import(moduleUrl(offlineSource))) };
}

function browser() {
  const values = new Map();
  const events = [];
  globalThis.sessionTabTest = { clears: 0, purges: 0, retained: [] };
  globalThis.indexedDB = {};
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem(key, value) {
        const oldValue = values.get(key) ?? null;
        values.set(key, value);
        // Browsers send storage events only when the persisted value changes.
        if (oldValue !== value) events.push({ key, oldValue, newValue: value });
      },
      removeItem(key) {
        const oldValue = values.get(key) ?? null;
        values.delete(key);
        if (oldValue !== null) events.push({ key, oldValue, newValue: null });
      },
    },
  };
  return events;
}

test("opening and reloading the same account in several tabs never broadcasts logout", async () => {
  const events = browser();
  const first = await createTab();
  const scope = first.createDeviceDataScope("tenant", "admin");
  await first.prepareDeviceOfflineData(scope);
  events.length = 0;
  const purges = globalThis.sessionTabTest.purges;
  const retained = globalThis.sessionTabTest.retained.length;

  for (let index = 0; index < 5; index++) {
    const tab = await createTab();
    await tab.prepareDeviceOfflineData(scope);
    tab.assertActiveDeviceDataScope(scope);
    first.assertActiveDeviceDataScope(scope);
  }

  assert.deepEqual(events, []);
  assert.equal(globalThis.sessionTabTest.purges, purges);
  assert.equal(globalThis.sessionTabTest.retained.length, retained);
});

test("switching accounts still invalidates the previous scope and isolates drafts", async () => {
  const events = browser();
  const first = await createTab();
  const second = await createTab();
  const oldScope = first.createDeviceDataScope("tenant", "admin");
  const newScope = second.createDeviceDataScope("tenant", "verifier");
  await first.prepareDeviceOfflineData(oldScope);
  events.length = 0;
  await second.prepareDeviceOfflineData(newScope);

  assert.deepEqual(
    events.map((event) => event.newValue),
    [null, newScope],
  );
  assert.throws(() => first.assertActiveDeviceDataScope(oldScope), /another session/);
  second.assertActiveDeviceDataScope(newScope);
  assert.deepEqual(globalThis.sessionTabTest.retained.slice(-2), [newScope, newScope]);
});

test("explicit session cleanup still broadcasts logout to other tabs and clears drafts", async () => {
  const events = browser();
  const first = await createTab();
  const second = await createTab();
  const scope = first.createDeviceDataScope("tenant", "admin");
  await first.prepareDeviceOfflineData(scope);
  await second.prepareDeviceOfflineData(scope);
  events.length = 0;
  await first.clearDeviceOfflineData();

  assert.deepEqual(
    events.map((event) => event.newValue),
    [null],
  );
  assert.equal(globalThis.sessionTabTest.clears, 2);
  assert.throws(() => second.assertActiveDeviceDataScope(scope), /another session/);
});

test("blocked local storage retains the in-tab scope and permits repeated session loading", async () => {
  browser();
  globalThis.window.localStorage = {
    getItem() {
      throw new Error("Storage blocked");
    },
    setItem() {
      throw new Error("Storage blocked");
    },
    removeItem() {
      throw new Error("Storage blocked");
    },
  };
  const tab = await createTab();
  const scope = tab.createDeviceDataScope("tenant", "admin");
  await tab.prepareDeviceOfflineData(scope);
  await tab.prepareDeviceOfflineData(scope);
  tab.assertActiveDeviceDataScope(scope);
  assert.equal(globalThis.sessionTabTest.purges, 1);
  await tab.clearDeviceOfflineData();
  assert.throws(() => tab.assertActiveDeviceDataScope(scope), /another session/);
});
