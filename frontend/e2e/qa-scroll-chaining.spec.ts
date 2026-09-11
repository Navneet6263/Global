import { expect as baseExpect, test } from "@playwright/test";
import { qaBrowserFixture } from "./fixtures/qa-browser-fixture";

const expect = baseExpect.configure({ timeout: 20_000 });
for (const target of ["evidence", "queue"] as const) {
  test(`QA ${target} scroll continues into the page at its boundary`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 400 });
    const fixture = await qaBrowserFixture(page, {
      documents: Array.from({ length: 16 }, (_, index) => ({
        publicId: `document-${index}`,
        type: "ADDRESS_PROOF",
        status: "VERIFIED",
        currentVersion: 1,
        versions: [
          {
            originalName: `proof-${index}.pdf`,
            contentType: "application/pdf",
            sha256: "abc123456789",
            malwareState: "CLEAN",
            createdAt: new Date().toISOString(),
          },
        ],
      })),
    });
    await page.goto("/qa-review");
    await page
      .getByRole("navigation", { name: "Case review sections" })
      .getByRole("button", { name: "Documents" })
      .click();
    const scroller =
      target === "evidence"
        ? page.getByRole("region", { name: "Review section content" })
        : page
            .getByRole("region", { name: "QA case list", exact: true })
            .locator("div.overflow-y-auto");
    await expect(scroller).toBeVisible();
    expect(
      await scroller.evaluate((element) => getComputedStyle(element).overscrollBehaviorY),
    ).toBe("auto");
    expect(await scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
      true,
    );
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await page.evaluate(() => window.scrollTo(0, 100));
    const bounds = (await scroller.boundingBox())!;
    const pointerY = Math.max(80, Math.min(360, bounds.y + 50));
    await page.mouse.move(bounds.x + bounds.width / 2, pointerY);
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
    await scroller.evaluate((element) => {
      element.scrollTop = 0;
    });
    const nextBounds = (await scroller.boundingBox())!;
    await page.mouse.move(
      nextBounds.x + nextBounds.width / 2,
      Math.max(80, Math.min(360, nextBounds.y + 50)),
    );
    const after = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, -300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(after);
    expect(fixture.unexpected).toEqual([]);
  });
}
