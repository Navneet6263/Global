import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Explicit smoke command, not part of test:unit: requires a built Node artifact.
// Only this script's own child process is stopped; no backend or workers run.
const directory = fileURLToPath(new URL("../", import.meta.url));
const metadata = JSON.parse(
  await readFile(new URL("../.output/nitro.json", import.meta.url), "utf8"),
);
assert.equal(metadata.preset, "node-server", "Build must target the Node/PM2 server");

const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
const port = reservation.address().port;
await new Promise((resolve, reject) =>
  reservation.close((error) => (error ? reject(error) : resolve())),
);

const child = spawn(process.execPath, [".output/server/index.mjs"], {
  cwd: directory,
  windowsHide: true,
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    NITRO_HOST: "127.0.0.1",
    NITRO_PORT: String(port),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (chunk) => {
  output = (output + chunk).slice(-4000);
});
child.stderr.on("data", (chunk) => {
  output = (output + chunk).slice(-4000);
});
let spawnError;
child.on("error", (error) => {
  spawnError = error;
});

try {
  let response;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Production entry exited: ${output}`);
    try {
      response = await fetch(`http://127.0.0.1:${port}/auth`, {
        signal: AbortSignal.timeout(3000),
      });
      break;
    } catch {
      await delay(100);
    }
  }
  assert.ok(response, `Production entry did not answer on its test port: ${output}`);
  assert.equal(response.status, 200, `Production request failed. Server log: ${output}`);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(await response.text(), /Sign in to your workspace/);
  console.log("PASS: built Node frontend serves /auth with security headers; no backend required.");
} finally {
  if (child.exitCode === null && !spawnError) {
    const stopped = once(child, "close");
    child.kill();
    await stopped;
  }
  console.log("Temporary frontend process stopped.");
}
