import assert from "node:assert/strict";
import test from "node:test";
import { validate } from "class-validator";
import { ChangePasswordDto } from "../src/auth/dto/change-password.dto";
import { LoginDto } from "../src/auth/dto/login.dto";
import { CreateUserDto } from "../src/users/dto/create-user.dto";
import { ResetUserPasswordDto } from "../src/users/dto/reset-user-password.dto";

const validPassword = "Ab1!xyz";

void test("seven-character password is accepted across user access flows", async () => {
  const login = Object.assign(new LoginDto(), {
    tenantCode: "SAPLING",
    email: "user@example.com",
    password: validPassword,
  });
  const change = Object.assign(new ChangePasswordDto(), {
    currentPassword: validPassword,
    newPassword: validPassword,
  });
  const create = Object.assign(new CreateUserDto(), {
    email: "user@example.com",
    displayName: "Example User",
    roleCodes: ["VERIFIER"],
    temporaryPassword: validPassword,
  });
  const reset = Object.assign(new ResetUserPasswordDto(), {
    temporaryPassword: validPassword,
  });

  const results = await Promise.all([
    validate(login),
    validate(change),
    validate(create),
    validate(reset),
  ]);

  assert.deepEqual(
    results.map((errors) => errors.length),
    [0, 0, 0, 0],
  );
});

void test("short or incomplete passwords are rejected", async () => {
  const tooShort = Object.assign(new ResetUserPasswordDto(), {
    temporaryPassword: "Aa1!xy",
  });
  const noSpecialCharacter = Object.assign(new ResetUserPasswordDto(), {
    temporaryPassword: "Aa1xyzz",
  });

  assert.notEqual((await validate(tooShort)).length, 0);
  assert.notEqual((await validate(noSpecialCharacter)).length, 0);
});
