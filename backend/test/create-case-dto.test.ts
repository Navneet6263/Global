import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateCaseDto } from "../src/cases/dto/create-case.dto";

function caseInput(phone: string) {
  return plainToInstance(CreateCaseDto, {
    clientId: "6fa75d80-a4a7-40d7-93a2-805934321300",
    fullName: "Example Candidate",
    email: "candidate@example.com",
    phone,
    priority: "NORMAL",
    checks: ["IDENTITY"],
  });
}

void test("case intake accepts an Indian national mobile number", async () => {
  const input = caseInput("7004023078");
  assert.equal((await validate(input)).length, 0);
  assert.equal(input.phone, "+917004023078");
});

void test("case intake accepts and preserves a canonical Indian mobile number", async () => {
  const input = caseInput("+917004023078");
  assert.equal((await validate(input)).length, 0);
  assert.equal(input.phone, "+917004023078");
});

void test("case intake rejects an invalid mobile number", async () => {
  const errors = await validate(caseInput("12345"));
  assert.equal(
    errors.some((error) => error.property === "phone"),
    true,
  );
});

void test("case intake rejects a 10-digit number starting below 6", async () => {
  const errors = await validate(caseInput("5004023078"));
  assert.equal(
    errors.some((error) => error.property === "phone"),
    true,
  );
});

void test("case intake rejects non-digit characters", async () => {
  const errors = await validate(caseInput("call7004023078"));
  assert.equal(
    errors.some((error) => error.property === "phone"),
    true,
  );
});
