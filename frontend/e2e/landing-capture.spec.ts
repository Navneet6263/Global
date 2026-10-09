import { test } from "@playwright/test";
import { clientWorkspaceFixture } from "./fixtures/client-workspace-fixture";
import { onboardingFixture } from "./fixtures/onboarding-fixture";
import { operationsOverviewFixture } from "./fixtures/operations-overview-fixture";
import { workflowFixture } from "./fixtures/workflow-fixture";

// Captures real product screens (synthetic fixture data) for the landing page.
// Run on demand: npx playwright test --config playwright.capture.config.ts
const OUT = "public/landing";

const NAMES: Array<[string, string]> = [
  ["Ops Candidate 10", "Rohit Bansal"],
  ["Ops Candidate 1", "Aarav Sharma"],
  ["Ops Candidate 2", "Ishita Verma"],
  ["Ops Candidate 3", "Kunal Mehra"],
  ["Ops Candidate 4", "Sneha Iyer"],
  ["Ops Candidate 5", "Vikram Rao"],
  ["Ops Candidate 6", "Pooja Nair"],
  ["Candidate 1", "Aditi Kapoor"],
  ["Candidate 2", "Rahul Desai"],
  ["Candidate 3", "Neha Gupta"],
  ["Candidate 4", "Arjun Malhotra"],
  ["Candidate 5", "Simran Kaur"],
  ["Candidate 6", "Karan Joshi"],
  ["Test Client", "Horizon Tech"],
  ["Client Tester", "Priya Sharma"],
  ["Neeraj Verifier", "Neeraj Gupta"],
  ["SG-TEST-", "SG-24"],
  ["SG-OPS-0", "SG-31"],
];

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });

async function settle(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({
    content:
      "[data-sonner-toaster],.client-learning-control{visibility:hidden!important}*{caret-color:transparent!important}",
  });
  await page.waitForTimeout(600);
  // Replace test-looking fixture labels with realistic sample names for marketing shots.
  await page.evaluate((pairs) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      let text = node.nodeValue ?? "";
      for (const [from, to] of pairs) text = text.split(from).join(to);
      node.nodeValue = text;
    }
  }, NAMES);
}

test("operations dashboard", async ({ page }) => {
  await operationsOverviewFixture(page);
  await page.goto("/operations");
  await settle(page);
  await page.screenshot({ path: `${OUT}/shot-operations.jpg`, type: "jpeg", quality: 82 });
});

test("client portal", async ({ page }) => {
  await clientWorkspaceFixture(page);
  await page.goto("/client-portal");
  await settle(page);
  await page.screenshot({ path: `${OUT}/shot-client.jpg`, type: "jpeg", quality: 82 });
});

test("rm work queue", async ({ page }) => {
  await workflowFixture(page, "RM");
  await page.goto("/spoc-rm/work");
  await settle(page);
  await page.screenshot({ path: `${OUT}/shot-rm.jpg`, type: "jpeg", quality: 82 });
});

test("client onboarding", async ({ page }) => {
  await onboardingFixture(page, "CLIENT");
  await page.goto("/client-portal/onboarding");
  await settle(page);
  await page.screenshot({ path: `${OUT}/shot-onboarding.jpg`, type: "jpeg", quality: 82 });
});
