import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConfigService } from "@nestjs/config";
import { MailerService, smtpSettings } from "../src/common/mail/mailer.service";

const config = (values: Record<string, unknown>) =>
  ({
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
    getOrThrow: (key: string) => values[key],
  }) as unknown as ConfigService;

const RESET_MAIL = {
  RESET_MAIL_HOST: "smtp.office365.com",
  RESET_MAIL_PORT: 587,
  RESET_MAIL_USER: "crm@example.in",
  RESET_MAIL_PASS: "reset-secret",
};

void test("RESET_MAIL_* settings work when SMTP_HOST is not set", () => {
  const values = config(RESET_MAIL);
  assert.deepEqual(smtpSettings(values), {
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    user: "crm@example.in",
    pass: "reset-secret",
  });
  assert.equal(new MailerService(values).configured(), true);
});

void test("SMTP_* wins and the two sets never mix", () => {
  const settings = smtpSettings(
    config({
      ...RESET_MAIL,
      SMTP_HOST: "mail.example.in",
      SMTP_PORT: 2525,
      SMTP_USER: "smtp@example.in",
      SMTP_PASSWORD: "smtp-secret",
    }),
  );
  assert.deepEqual(settings, {
    host: "mail.example.in",
    port: 2525,
    secure: false,
    user: "smtp@example.in",
    pass: "smtp-secret",
  });
});

void test("without SMTP_FROM, mail goes from the RESET_MAIL_USER login", async () => {
  const mailer = new MailerService(config(RESET_MAIL));
  let from: unknown;
  (mailer as unknown as { transport: unknown }).transport = {
    sendMail: (message: { from: unknown }) => {
      from = message.from;
      return Promise.resolve({});
    },
  };
  await mailer.sendTemplate("someone@example.in", "onboarding-update", {
    companyName: "Acme",
    message: "Hello",
  });
  assert.equal(from, "crm@example.in");
});

void test("no mail host means email is not configured", () => {
  assert.equal(new MailerService(config({})).configured(), false);
});
