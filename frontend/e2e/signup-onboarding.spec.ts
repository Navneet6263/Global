import { expect as baseExpect, test } from "@playwright/test";
import { onboardingFixture } from "./fixtures/onboarding-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

test("visitors see the landing page with services, FAQ, footer and a way to sign up", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await onboardingFixture(page, "ANON");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Hire with confidence/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Every check your hiring needs" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText("Sapling Global. All rights reserved.");
  await page.screenshot({ path: "test-results/landing-hero.png" });
  await page.screenshot({ path: "test-results/landing.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/landing-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole("link", { name: /Create company account/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/signup$/);
});

test("sign-in page shows the Sapling wordmark and a way to create a company account", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await onboardingFixture(page, "ANON");
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByAltText("Sapling Global").first()).toHaveAttribute(
    "src",
    "/brand/sapling-wordmark.png",
  );
  await expect(page.locator('img[src*="sapling-global-mark"]')).toHaveCount(0);
  await page.screenshot({ path: "test-results/auth-signin.png", fullPage: true });
  await page.getByRole("link", { name: /Create a company account/ }).click();
  await expect(page).toHaveURL(/\/signup$/);
});

test("a company signs up, confirms the email code and lands on onboarding", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const fixture = await onboardingFixture(page, "ANON");
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Create your company account" })).toBeVisible();
  await page.getByLabel("Company name").fill("Acme Technologies Pvt Ltd");
  await page.getByLabel("Your full name").fill("Riya Mehta");
  await page.getByLabel("Work email").fill("riya@acmetech.in");
  await page.getByLabel("Password", { exact: true }).fill("weak");
  const submit = page.getByRole("button", { name: /email me a code/ });
  await expect(submit).toBeDisabled();
  await page.getByLabel("Password", { exact: true }).fill("Strong#Pass1");
  await page.getByRole("checkbox", { name: "I accept the terms" }).click();
  await page.screenshot({ path: "test-results/auth-signup.png", fullPage: true });
  await submit.click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.locator(".auth-otp-mail").getByText("ri**@acmetech.in")).toBeVisible();
  await page.screenshot({ path: "test-results/auth-signup-code.png", fullPage: true });
  const start = fixture.requests.find((entry) => entry.path === "/auth/signup");
  expect(start?.body).toMatchObject({
    companyName: "Acme Technologies Pvt Ltd",
    email: "riya@acmetech.in",
    acceptTerms: true,
  });
  await page.getByRole("textbox", { name: "6-digit email code" }).fill("482913");
  await expect(page).toHaveURL(/\/client-portal\/onboarding/);
  const verify = fixture.requests.find((entry) => entry.path === "/auth/signup/verify");
  expect(verify?.body).toEqual({
    signupId: "00000000-0000-4000-8000-000000000099",
    otp: "482913",
  });
});

test("the company admin sees its checklist, fixes a rejected document and submits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = await onboardingFixture(page, "CLIENT");
  await page.goto("/client-portal");
  await expect(page).toHaveURL(/\/client-portal\/onboarding/);
  await expect(page.getByRole("heading", { name: "Welcome, Acme Technologies" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "client-admin navigation" });
  await expect(nav.getByRole("link", { name: "Get started" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Overview" })).toHaveCount(0);
  await expect(page.getByText("The PAN number is not readable.")).toBeVisible();
  await expect(page.getByText("Arjun Nair")).toBeVisible();
  await page.screenshot({ path: "test-results/client-onboarding.png", fullPage: true });
  await page.getByLabel("Upload Company PAN card").setInputFiles({
    name: "pan-clear.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%synthetic\n"),
  });
  await expect(page.getByText("Company PAN card uploaded")).toBeVisible();
  expect(
    fixture.requests.some(
      (entry) => entry.method === "POST" && entry.path === "/onboarding/me/documents/PAN",
    ),
  ).toBeTruthy();
});

test("Operations reviews a sign-up: flags, document approval and activation guard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = await onboardingFixture(page, "OPS");
  await page.goto("/operations/onboarding");
  await expect(page.getByRole("heading", { name: "New sign-ups", level: 1 })).toBeVisible();
  const list = page.getByRole("list", { name: "Sign-up companies" });
  await expect(list.getByText("Personal email")).toBeVisible();
  await expect(list.getByText("Possible duplicate")).toBeVisible();
  await expect(list.getByText("No RM yet")).toBeVisible();
  await page.screenshot({ path: "test-results/ops-signups.png", fullPage: true });
  await list.getByRole("button", { name: /Acme Technologies/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Check before approving")).toBeVisible();
  const dpa = sheet.getByRole("listitem").filter({ hasText: "Data processing agreement" });
  await dpa.getByRole("button", { name: "Approve" }).click();
  await dpa.getByRole("checkbox").click();
  await dpa.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Data processing agreement (DPA) approved")).toBeVisible();
  const review = fixture.requests.find((entry) => entry.path.endsWith("/review"));
  expect(review?.body).toMatchObject({ status: "APPROVED", signaturesChecked: true, version: 1 });
  await page.screenshot({ path: "test-results/ops-signup-sheet.png" });
  await sheet.getByRole("button", { name: "Approve & activate" }).click();
  const decision = page.getByRole("dialog", { name: "Approve and activate" });
  await expect(decision.getByText(/Still open/)).toBeVisible();
});

test("company activity is grouped by day, filterable and paged", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await onboardingFixture(page, "OPS");
  await page.goto("/operations/onboarding");
  await page
    .getByRole("list", { name: "Sign-up companies" })
    .getByRole("button", { name: /Acme Technologies/ })
    .click();
  const activity = page.getByRole("dialog").getByRole("region", { name: "Activity" });
  await activity.scrollIntoViewIfNeeded();
  await expect(activity.getByText("12 events")).toBeVisible();
  await expect(activity.getByText("1–8 of 12")).toBeVisible();
  // Plain words and a short detail, never the raw action code.
  await expect(activity.getByText("Company PAN card · approved").first()).toBeVisible();
  await expect(activity.getByText(/client\./)).toHaveCount(0);
  await activity.getByRole("button", { name: "Older activity" }).click();
  await expect(activity.getByText("9–12 of 12")).toBeVisible();
  await expect(activity.getByText("Client discount set")).toBeVisible();
  await expect(activity.getByText("Standard BGV · 10% discount")).toBeVisible();
  await page.screenshot({ path: "test-results/onboarding-activity.png" });
  await activity.getByRole("button", { name: "RM & messages" }).click();
  await expect(activity.getByText("2 events")).toBeVisible();
  await expect(activity.getByText("Please upload the signed DPA.")).toBeVisible();
  await expect(activity.getByRole("button", { name: "Older activity" })).toHaveCount(0);
});

test("Platform Admin sees sign-ups read-only", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await onboardingFixture(page, "ADMIN");
  await page.goto("/admin/onboarding?company=client-acme");
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("View only")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Approve & activate" })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: /Assign RM|Change RM/ })).toHaveCount(0);
});

test("the company's RM approves the sign-up itself: list prices and a discount within the limit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await onboardingFixture(page, "RM");
  await page.goto("/spoc-rm/onboarding");
  await page
    .getByRole("list", { name: "Sign-up companies" })
    .getByRole("button", { name: /Acme Technologies/ })
    .click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: "Approve & activate" })).toBeVisible();
  await expect(sheet.getByText(/You are this company's RM/)).toBeVisible();
  // The RM ticks packages; the list price cannot be typed over.
  await sheet.getByRole("checkbox", { name: "Enable Basic employee check" }).click();
  await expect(sheet.getByLabel("Basic employee check price")).toBeDisabled();
  await sheet.getByRole("button", { name: "Save packages" }).click();
  await expect(page.getByText("Packages & pricing saved")).toBeVisible();
  const discounts = sheet.getByRole("region", { name: "Discounts" });
  const percent = discounts.getByLabel("Basic employee check discount percent");
  await percent.fill("15");
  await expect(discounts.getByText(/Above your limit of 10%/)).toBeVisible();
  await percent.fill("8");
  await page.screenshot({ path: "test-results/rm-onboarding-panel.png" });
  await discounts.getByRole("button", { name: "Save" }).click();
  await expect
    .poll(
      () => fixture.requests.find((r) => r.path === "/client-pricing/client-acme/pkg-basic")?.body,
    )
    .toEqual({ discountPercent: 8 });
  const dpa = sheet.getByRole("listitem").filter({ hasText: "Data processing agreement" });
  await expect(dpa.getByRole("button", { name: "Approve" })).toBeVisible();
});
