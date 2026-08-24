import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const allowedAdvisory = "https://github.com/advisories/GHSA-ggr8-5vv4-36mx";
const allowedPackages = new Set(["deepmerge-ts", "@prisma/config", "prisma"]);
const npmCli = process.env.npm_execpath;
if (!npmCli)
  throw new Error("Run this guard through the audit:development npm script");
const result = spawnSync(process.execPath, [npmCli, "audit", "--json"], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  encoding: "utf8",
  shell: false,
});

if (result.error) throw result.error;

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  process.stderr.write(result.stderr || result.stdout);
  throw new Error("npm audit did not return valid JSON");
}

const findings = Object.entries(report.vulnerabilities ?? {});
const unexpectedPackages = findings.filter(
  ([name]) => !allowedPackages.has(name),
);
const advisoryUrls = findings.flatMap(([, finding]) =>
  (finding.via ?? [])
    .filter((via) => typeof via === "object" && via !== null)
    .map((via) => via.url),
);
const unexpectedAdvisories = advisoryUrls.filter(
  (url) => url !== allowedAdvisory,
);
const allowedFindingPresent = advisoryUrls.includes(allowedAdvisory);

if (unexpectedPackages.length || unexpectedAdvisories.length) {
  console.error(
    "Development dependency audit contains findings outside the reviewed allowlist.",
  );
  for (const [name, finding] of unexpectedPackages) {
    console.error(`- ${name}: ${finding.severity}`);
  }
  for (const url of unexpectedAdvisories) console.error(`- ${url}`);
  process.exitCode = 1;
} else if (findings.length && !allowedFindingPresent) {
  console.error(
    "Development dependency findings could not be matched to the reviewed advisory.",
  );
  process.exitCode = 1;
} else if (findings.length) {
  console.warn(
    `Development audit contains only the reviewed Prisma CLI advisory: ${allowedAdvisory}`,
  );
} else {
  console.log("Development dependency audit is clean.");
}
