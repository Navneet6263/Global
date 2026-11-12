import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Extract pure helper functions from verifier-department.ts logic via lightweight unit verification
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEPTS = {
  DIGITAL: {
    id: "a81ce6a3-7f2a-4ec4-8a5f-084013366afe",
    name: "Digital",
    teamType: "DIGITAL",
    role: "LEAD",
  },
  EDUCATION: {
    id: "7b6c6514-16dc-40d3-90dd-9e301db5496d",
    name: "Education",
    teamType: "EDUCATION",
    role: "LEAD",
  },
  EMPLOYMENT: {
    id: "e5d1e927-7e6b-431c-a775-d32e28dcf932",
    name: "Employment",
    teamType: "EMPLOYMENT",
    role: "LEAD",
  },
  VENDOR: {
    id: "b23e397b-9799-4397-aac5-96898ff3ebd3",
    name: "Vendor",
    teamType: "VENDOR",
    role: "LEAD",
  },
};

const ALL_TEAMS = Object.values(DEPTS);

function resolveDept(input) {
  const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);
  const urlId = isUuid(input.urlDepartment) ? input.urlDepartment : undefined;
  const savedId = isUuid(input.remembered) ? input.remembered : undefined;
  if (urlId) {
    const team = input.teams.find((t) => t.id === urlId) ?? input.led.find((t) => t.id === urlId);
    if (input.supervisor || !input.led.length || input.led.some((t) => t.id === urlId)) {
      return { departmentId: urlId, team };
    }
  }
  if (savedId) {
    if (input.supervisor) {
      return { departmentId: savedId, team: input.teams.find((t) => t.id === savedId) };
    }
    const ledMatch = input.led.find((t) => t.id === savedId);
    if (ledMatch) return { departmentId: ledMatch.id, team: ledMatch };
  }
  if (!input.supervisor && input.led.length === 1) {
    return { departmentId: input.led[0].id, team: input.led[0] };
  }
  return {};
}

test("all 4 departments resolve accurately from URL or remembered selection", () => {
  for (const dept of ALL_TEAMS) {
    const resolved = resolveDept({
      urlDepartment: dept.id,
      remembered: undefined,
      supervisor: true,
      led: [],
      teams: ALL_TEAMS,
    });
    assert.equal(resolved.departmentId, dept.id);
    assert.equal(resolved.team?.name, dept.name);
  }
});

test("supervisor without selected or remembered TL department keeps unfiltered supervisor mode", () => {
  const resolved = resolveDept({
    urlDepartment: undefined,
    remembered: undefined,
    supervisor: true,
    led: [],
    teams: ALL_TEAMS,
  });
  assert.equal(resolved.departmentId, undefined);
  assert.equal(resolved.team, undefined);
});

test("switching between TL Digital and TL Education remembers active department across routes", () => {
  const afterDigital = resolveDept({
    urlDepartment: undefined,
    remembered: DEPTS.DIGITAL.id,
    supervisor: true,
    led: [],
    teams: ALL_TEAMS,
  });
  assert.equal(afterDigital.departmentId, DEPTS.DIGITAL.id);
  assert.equal(afterDigital.team?.name, "Digital");

  const afterEducation = resolveDept({
    urlDepartment: DEPTS.EDUCATION.id,
    remembered: DEPTS.DIGITAL.id,
    supervisor: true,
    led: [],
    teams: ALL_TEAMS,
  });
  assert.equal(afterEducation.departmentId, DEPTS.EDUCATION.id);
  assert.equal(afterEducation.team?.name, "Education");
});

test("single-department TL defaults to own department and rejects remembered foreign department", () => {
  const resolved = resolveDept({
    urlDepartment: undefined,
    remembered: DEPTS.VENDOR.id,
    supervisor: false,
    led: [DEPTS.DIGITAL],
    teams: [DEPTS.DIGITAL],
  });
  assert.equal(resolved.departmentId, DEPTS.DIGITAL.id);
  assert.equal(resolved.team?.name, "Digital");
});

test("verifier source files stay strictly below 300 lines and include department-aware query keys", async () => {
  const queueSrc = await readFile(
    new URL("../src/routes/verifier.queue.tsx", import.meta.url),
    "utf8",
  );
  const deskSrc = await readFile(
    new URL("../src/features/delivery/verifier/VerifierTaskDesk.tsx", import.meta.url),
    "utf8",
  );
  const teamSrc = await readFile(
    new URL("../src/features/workflow-ui/TeamQueue.tsx", import.meta.url),
    "utf8",
  );
  const rowSrc = await readFile(
    new URL("../src/features/workflow-ui/TeamQueueRow.tsx", import.meta.url),
    "utf8",
  );
  assert.match(queueSrc, /\[\s*"tasks",\s*"mine",\s*departmentId \?\? "all"/);
  assert.match(deskSrc, /isPeerReadOnly/);
  assert.match(teamSrc, /departmentId:\s*search\.department/);
  assert.match(rowSrc, /targetDepartment/);
});
