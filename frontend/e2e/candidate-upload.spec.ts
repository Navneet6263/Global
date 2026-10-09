import { expect as baseExpect, test } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20_000 });

const ACCESS = "00000000-0000-4000-8000-000000000077";

async function candidateFixture(page: import("@playwright/test").Page, consentStatus = "ACCEPTED") {
  const state = {
    consentStatus,
    uploaded: new Set<string>(["PAN"]),
    completedAt: null as string | null,
    requests: [] as Array<{ method: string; path: string; type?: string }>,
  };
  const items = () =>
    ["PAN", "ADDRESS_PROOF", "EDUCATION_CERTIFICATE"].map((type) => ({
      type,
      required: true,
      state:
        type === "EDUCATION_CERTIFICATE" && !state.uploaded.has(type)
          ? "REUPLOAD"
          : state.uploaded.has(type)
            ? "UPLOADED"
            : "NEEDED",
      reviewNote:
        type === "EDUCATION_CERTIFICATE" && !state.uploaded.has(type)
          ? "The certificate is cut off at the bottom. Please upload the full page."
          : null,
      version: state.uploaded.has(type) ? 1 : 0,
    }));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    state.requests.push({
      method: request.method(),
      path,
      type: request.headers()["x-document-type"],
    });
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (path === `/public/candidate-access/${ACCESS}` && request.method() === "GET") {
      const list = items();
      return reply({
        id: ACCESS,
        expiresAt: new Date(Date.now() + 10 * 86_400_000).toISOString(),
        completedAt: state.completedAt,
        privacyNotice: {
          version: "2026-09",
          title: "How we use your documents",
          paragraphs: ["We use your documents only to verify the details you shared."],
        },
        case: {
          caseNumber: "SG-20261007-4F2A",
          status: "DOCUMENT_PENDING",
          candidateName: "Aarav Sharma",
          clientName: "Horizon Tech",
          dueAt: null,
          requiredDocumentTypes: ["PAN", "ADDRESS_PROOF", "EDUCATION_CERTIFICATE"],
          uploadItems: list,
          readyToComplete: list.every((item) => item.state === "UPLOADED"),
          checks: [],
          documents: [],
          clarifications: [],
          consentStatus: state.consentStatus,
          reportAvailable: false,
          supportRequests: [],
        },
      });
    }
    if (path === `/public/candidate-access/${ACCESS}/documents`) {
      state.uploaded.add(request.headers()["x-document-type"] ?? "");
      return reply({ id: "d", type: "X", version: 1, sha256: "x" });
    }
    if (path === `/public/candidate-access/${ACCESS}/consent/otp`)
      return reply({
        sent: true,
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        destination: "aa***@example.com",
      });
    if (path === `/public/candidate-access/${ACCESS}/consent/confirm`) {
      if ((request.postDataJSON() as { otp?: string })?.otp !== "123456")
        return reply({ detail: "OTP is invalid or expired" }, 401);
      state.consentStatus = "ACCEPTED";
      return reply({ accepted: true, acceptedAt: new Date().toISOString() });
    }
    if (path === `/public/candidate-access/${ACCESS}/complete`) {
      state.completedAt = new Date().toISOString();
      return reply({ completed: true, completedAt: state.completedAt });
    }
    return reply({});
  });
  return state;
}

const pdf = (name: string) => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n%synthetic\n"),
});

test("a candidate uploads only what was asked, completes, and the link closes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const state = await candidateFixture(page);
  await page.goto(`/candidate/${ACCESS}#token=candidate-token`);
  await expect(page.getByRole("heading", { name: "Hi Aarav," })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Your steps" }).getByText("Consent recorded"),
  ).toBeVisible();
  const docs = page.getByRole("list", { name: "Documents to upload" });
  await expect(docs.getByRole("listitem")).toHaveCount(3);
  await expect(docs.getByText(/cut off at the bottom/)).toBeVisible();
  const complete = page.getByRole("button", { name: /Complete — I've uploaded all documents/ });
  await expect(complete).toBeDisabled();
  await expect(docs.getByRole("button", { name: "Upload" }).first()).toBeEnabled();
  await page.screenshot({ path: "test-results/candidate-upload.png", fullPage: true });

  await page.getByLabel("Upload Address proof").setInputFiles(pdf("address.pdf"));
  await expect(docs.getByRole("listitem").filter({ hasText: "Address proof" })).toContainText(
    "Uploaded",
  );
  await page.getByLabel("Upload Education certificate").setInputFiles(pdf("degree.pdf"));
  await expect(complete).toBeEnabled();
  expect(
    state.requests.filter((entry) => entry.path.endsWith("/documents")).map((entry) => entry.type),
  ).toEqual(["ADDRESS_PROOF", "EDUCATION_CERTIFICATE"]);

  await complete.click();
  await page.getByRole("button", { name: /Yes, I'm done/ }).click();
  await expect(page.getByRole("heading", { name: "You're all set, Aarav" })).toBeVisible();
  await expect(page.getByText(/This link is now closed/)).toBeVisible();
  await expect(page.getByText(/Your consent is already recorded/)).toBeVisible();
  await page.screenshot({ path: "test-results/candidate-done.png", fullPage: true });
});

test("one link: the candidate confirms consent with an emailed code, then uploads open", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const state = await candidateFixture(page, "REQUESTED");
  await page.goto(`/candidate/${ACCESS}#token=candidate-token`);
  await expect(page.getByRole("heading", { name: "Give your consent" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Documents to upload" })).toHaveCount(0);
  await expect(page.getByText(/Upload opens right after you confirm/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Complete — I've uploaded/ })).toHaveCount(0);
  const send = page.getByRole("button", { name: /Email me a 6-digit code/ });
  await expect(send).toBeDisabled();
  await page.getByRole("checkbox").check();
  await send.click();
  await expect(page.getByText("aa***@example.com")).toBeVisible();
  await expect(page.getByRole("button", { name: /Resend code in/ })).toBeDisabled();
  await page.screenshot({ path: "test-results/candidate-consent.png", fullPage: true });

  const code = page.getByRole("textbox", { name: "6-digit consent code" });
  await code.fill("111111");
  await expect(page.getByRole("alert")).toContainText("OTP is invalid or expired");
  await code.fill("123456");
  await expect(
    page.getByRole("list", { name: "Your steps" }).getByText("Consent recorded"),
  ).toBeVisible();
  const docs = page.getByRole("list", { name: "Documents to upload" });
  await expect(docs.getByRole("listitem")).toHaveCount(3);
  await expect(docs.getByRole("button", { name: "Upload" }).first()).toBeEnabled();
  expect(state.requests.some((entry) => entry.path.includes("/consents/"))).toBe(false);
});

test("the candidate page fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await candidateFixture(page);
  await page.goto(`/candidate/${ACCESS}#token=candidate-token`);
  await expect(page.getByRole("heading", { name: "Hi Aarav," })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/candidate-upload-mobile.png", fullPage: true });
});
