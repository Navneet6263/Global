import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ForbiddenException } from "@nestjs/common";
import {
  DispatchCommitDto,
  DispatchPreviewDto,
} from "../src/cases/dispatch/dispatch.dto";
import {
  dispatchIssues,
  matchesVerifier,
  presentDispatchCase,
} from "../src/cases/dispatch/dispatch.policy";
import {
  dispatchActor,
  dispatchHarness,
  dispatchInput,
  dispatchRecord,
  uuid,
} from "./fixtures/dispatch.fixture";

void test("dispatch DTO bounds selection and rejects duplicate/unknown allocation fields", async () => {
  assert.equal(
    (
      await validate(
        plainToInstance(DispatchPreviewDto, {
          caseIds: `${uuid(10)},${uuid(11)}`,
        }),
      )
    ).length,
    0,
  );
  for (const caseIds of [
    [],
    [uuid(10), uuid(10)],
    Array.from({ length: 26 }, (_, index) => uuid(index)),
    ["not-a-uuid"],
  ])
    assert.ok(
      (await validate(plainToInstance(DispatchPreviewDto, { caseIds }))).length,
    );
  assert.equal(
    (
      await validate(plainToInstance(DispatchCommitDto, dispatchInput()), {
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    ).length,
    0,
  );
  const input = dispatchInput();
  input.allocations.push(input.allocations[0]!);
  assert.ok((await validate(plainToInstance(DispatchCommitDto, input))).length);
  assert.ok(
    (
      await validate(
        plainToInstance(DispatchCommitDto, {
          ...dispatchInput(),
          bypassConsent: true,
        }),
        { whitelist: true, forbidNonWhitelisted: true },
      )
    ).length,
  );
});

void test("readiness requires consent and latest reviewed, unexpired documents", () => {
  const record = dispatchRecord();
  assert.deepEqual(dispatchIssues(record), []);
  record.consents = [];
  assert.match(dispatchIssues(record).join(), /consent/);
  record.consents = [{ id: 5n }];
  record.documents.push({
    ...record.documents[0]!,
    createdAt: new Date("2026-09-10"),
    status: "REUPLOAD_REQUIRED",
  });
  assert.match(dispatchIssues(record).join(), /correction|reviewed/);
  record.documents = [
    { ...record.documents[0]!, expiresAt: new Date("2000-01-01") },
  ];
  assert.match(dispatchIssues(record).join(), /unexpired/);
  record.services = [{ requiredDocumentsJson: "not-json" }];
  assert.match(dispatchIssues(record).join(), /policy is invalid/);
});

void test("preview exposes only unassigned checks and scope eligibility", () => {
  const record = dispatchRecord();
  record.checks[0]!.status = "COMPLETED";
  assert.equal(presentDispatchCase(record).checks.length, 1);
  assert.equal(matchesVerifier(record, { branchId: 3n, clientId: 4n }), true);
  assert.equal(
    matchesVerifier(record, { branchId: null, clientId: null }),
    true,
  );
  assert.equal(
    matchesVerifier(record, { branchId: 99n, clientId: null }),
    false,
  );
  assert.equal(
    matchesVerifier(record, { branchId: null, clientId: 99n }),
    false,
  );
});

void test("start and all assignments commit in one serializable transaction with history, audit and notifications", async () => {
  const harness = dispatchHarness();
  const result = await harness.service.commit(
    dispatchActor,
    uuid(10),
    dispatchInput(),
  );
  assert.equal(result.assigned, 2);
  assert.equal(result.started, true);
  assert.equal(harness.state.record?.status, "IN_PROGRESS");
  for (const [kind, count] of [
    ["task", 2],
    ["notification", 2],
    ["history", 1],
    ["outbox", 1],
  ] as const)
    assert.equal(
      harness.state.writes.filter((entry) => entry.kind === kind).length,
      count,
    );
  assert.equal(
    (harness.isolation() as { isolationLevel: string }).isolationLevel,
    "Serializable",
  );
  assert.match(
    JSON.stringify(harness.lookup(), (_, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
    /tenantId.*2/,
  );
  assert.ok(harness.state.receipt);
});

void test("a downstream persistence failure rolls back case, every assignment and all audit writes", async () => {
  const harness = dispatchHarness();
  harness.controls.failNotification = true;
  await assert.rejects(
    harness.service.commit(dispatchActor, uuid(10), dispatchInput()),
    /persistence failure/,
  );
  assert.equal(harness.state.record?.status, "DOCUMENT_PENDING");
  assert.equal(harness.state.record?.version, 2);
  assert.equal(harness.state.writes.length, 0);
});

void test("lost-response replay returns the saved receipt without any new writes", async () => {
  const harness = dispatchHarness();
  const first = await harness.service.commit(
    dispatchActor,
    uuid(10),
    dispatchInput(),
  );
  const count = harness.state.writes.length;
  assert.deepEqual(
    await harness.service.commit(dispatchActor, uuid(10), dispatchInput()),
    first,
  );
  assert.equal(harness.state.writes.length, count);
  await assert.rejects(
    harness.service.commit(dispatchActor, uuid(10), {
      ...dispatchInput(),
      instructions: "Different plan",
    }),
    /operation ID/,
  );
});

void test("already started cases only assign; they do not generate another transition", async () => {
  const record = dispatchRecord();
  record.status = "IN_PROGRESS";
  const harness = dispatchHarness(record);
  assert.equal(
    (await harness.service.commit(dispatchActor, uuid(10), dispatchInput()))
      .started,
    false,
  );
  assert.equal(
    harness.state.writes.filter(
      (entry) => entry.kind === "history" || entry.kind === "outbox",
    ).length,
    0,
  );
});

void test("wrong role, unavailable case, stale case/check and incomplete allocation fail closed", async () => {
  await assert.rejects(
    dispatchHarness().service.commit(
      { ...dispatchActor, roles: ["CLIENT_ADMIN"] },
      uuid(10),
      dispatchInput(),
    ),
    ForbiddenException,
  );
  await assert.rejects(
    dispatchHarness(null).service.commit(
      dispatchActor,
      uuid(10),
      dispatchInput(),
    ),
    /unavailable/,
  );
  for (const change of [
    (input: DispatchCommitDto) => {
      input.version = 1;
    },
    (input: DispatchCommitDto) => {
      input.allocations[0]!.checkVersion = 9;
    },
    (input: DispatchCommitDto) => {
      input.allocations.pop();
    },
    (input: DispatchCommitDto) => {
      input.allocations[0]!.checkId = uuid(300);
    },
  ]) {
    const harness = dispatchHarness();
    const input = dispatchInput();
    change(input);
    await assert.rejects(
      harness.service.commit(dispatchActor, uuid(10), input),
    );
    assert.equal(harness.state.writes.length, 0);
  }
});

void test("inactive or wrong-scope verifier cannot start or take ownership of a case", async () => {
  for (const change of [
    (harness: ReturnType<typeof dispatchHarness>) => {
      harness.controls.activeVerifier = false;
    },
    (harness: ReturnType<typeof dispatchHarness>) => {
      harness.controls.verifierBranch = 99n;
    },
    (harness: ReturnType<typeof dispatchHarness>) => {
      harness.controls.verifierClient = 99n;
    },
    (harness: ReturnType<typeof dispatchHarness>) => {
      harness.controls.lockCount = 0;
    },
  ]) {
    const harness = dispatchHarness();
    change(harness);
    await assert.rejects(
      harness.service.commit(dispatchActor, uuid(10), dispatchInput()),
    );
    assert.equal(harness.state.writes.length, 0);
    assert.equal(harness.state.record?.status, "DOCUMENT_PENDING");
  }
});

void test("document or consent changes after preview prevent dispatch", async () => {
  for (const status of [
    "CONSENT_PENDING",
    "CLARIFICATION_PENDING",
    "QA_REVIEW",
    "COMPLETED",
  ]) {
    const record = dispatchRecord();
    record.status = status;
    await assert.rejects(
      dispatchHarness(record).service.commit(
        dispatchActor,
        uuid(10),
        dispatchInput(),
      ),
      /preparation/,
    );
  }
  const record = dispatchRecord();
  record.documents[0]!.status = "REUPLOAD_REQUIRED";
  await assert.rejects(
    dispatchHarness(record).service.commit(
      dispatchActor,
      uuid(10),
      dispatchInput(),
    ),
    /review/,
  );
  record.documents[0]!.status = "VERIFIED";
  record.consents = [];
  await assert.rejects(
    dispatchHarness(record).service.commit(
      dispatchActor,
      uuid(10),
      dispatchInput(),
    ),
    /consent/,
  );
});
