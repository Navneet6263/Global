import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConfigService } from "@nestjs/config";
import { renderEmail } from "../src/common/mail/email-templates";
import type { SecretBoxService } from "../src/common/security/secret-box.service";
import type { Prisma } from "../src/generated/prisma/client";
import { passwordEmailDeps, resetAccountPassword } from "../src/users/user-accounts";

/** A sealer that only marks the payload, so the test can read it back. */
const secretBox = {
  seal: (value: unknown) => `sealed:${JSON.stringify(value)}`,
} as unknown as SecretBoxService;
const config = { get: () => "https://portal.example" } as unknown as ConfigService;

function fakeTx() {
  const outbox: Array<{ topic: string; payloadJson: string }> = [];
  const audits: Array<{ action: string; afterJson?: string }> = [];
  const tx = {
    user: {
      update: () => Promise.resolve({ email: "asha@example.in", displayName: "Asha Rao" }),
    },
    refreshSession: { updateMany: () => Promise.resolve({ count: 1 }) },
    outboxEvent: {
      create: ({ data }: { data: { topic: string; payloadJson: string } }) => {
        outbox.push(data);
        return Promise.resolve({});
      },
    },
    auditEvent: {
      create: ({ data }: { data: { action: string; afterJson?: string } }) => {
        audits.push(data);
        return Promise.resolve({});
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, outbox, audits };
}

const target = {
  tenantId: 7n,
  actorUserId: 1n,
  userId: 50n,
  publicId: "user-50",
  passwordHash: "hash",
};

void test("a reset emails the temporary password, sealed, with a sign-in link", async () => {
  const { tx, outbox, audits } = fakeTx();
  const result = await resetAccountPassword(tx, {
    ...target,
    email: passwordEmailDeps(secretBox, config, "Tmp#4821xyz", "your administrator"),
  });
  assert.deepEqual(result, { emailed: true });
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0]!.topic, "email.requested");
  // Only the sealed form is stored in the outbox row.
  const sealed = (JSON.parse(outbox[0]!.payloadJson) as { secret: string }).secret;
  assert.ok(sealed.startsWith("sealed:"));
  const mail = JSON.parse(sealed.slice("sealed:".length)) as {
    to: string;
    template: string;
    variables: Record<string, string>;
  };
  assert.equal(mail.to, "asha@example.in");
  assert.equal(mail.template, "password-reset");
  assert.deepEqual(mail.variables, {
    name: "Asha Rao",
    temporaryPassword: "Tmp#4821xyz",
    resetBy: "your administrator",
    signInUrl: "https://portal.example/auth",
  });
  assert.equal(audits[0]!.action, "user.password.reset");
  // The audit records that an email went out, never the password itself.
  assert.deepEqual(JSON.parse(audits[0]!.afterJson!), { emailed: true });
});

void test("without email set up the reset still works and nothing is queued", async () => {
  const { tx, outbox, audits } = fakeTx();
  const result = await resetAccountPassword(tx, {
    ...target,
    audit: { via: "TEAM_LEADER" },
    email: passwordEmailDeps(undefined, config, "Tmp#4821xyz", "your Team Leader"),
  });
  assert.deepEqual(result, { emailed: false });
  assert.equal(outbox.length, 0);
  assert.deepEqual(JSON.parse(audits[0]!.afterJson!), { via: "TEAM_LEADER" });
});

void test("the email shows the temporary password and a Sign in button", () => {
  const email = renderEmail("password-reset", {
    name: "Asha <Rao>",
    temporaryPassword: "Tmp#4821xyz",
    resetBy: "your Team Leader",
    signInUrl: "https://portal.example/auth",
  });
  assert.equal(email.subject, "Your Sapling Global password was reset");
  assert.match(email.text, /Temporary password: Tmp#4821xyz/);
  assert.match(email.text, /https:\/\/portal\.example\/auth/);
  assert.match(email.html, /Tmp#4821xyz/);
  assert.match(email.html, /Sign in/);
  assert.match(email.html, /your Team Leader/);
  // Names are escaped in the HTML.
  assert.match(email.html, /Asha &lt;Rao&gt;/);
});
