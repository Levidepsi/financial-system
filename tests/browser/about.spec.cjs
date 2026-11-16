const { test, expect } = require("@playwright/test");

test("about page loads the supplied video and reveals lifetime offer at the end", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/about.html");
  await expect(page.locator("#video-placeholder")).toBeHidden();
  await expect(page.locator("#about-video")).toBeVisible();
  await page.waitForFunction(() => document.querySelector("#about-video").readyState >= 1);
  await expect(page.locator("#about-product")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("#about-video").dispatchEvent("ended");
  await expect(page.locator("#about-product")).toContainText("Lifetime access");
  await expect(page.locator("#raket-link")).toBeHidden();
  await expect(page.locator("#product-pending")).toBeVisible();
});

test("product link is revealed only after the configured video ends", async ({ page }) => {
  await page.route("**/about.html", async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace('data-product-url=""',
      'data-product-url="https://www.raket.ph/test-product"');
    await route.fulfill({ response, body: html });
  });
  await page.route("**/test-video.mp4", route => route.fulfill({ status: 204 }));
  await page.goto("/about.html");
  await expect(page.locator("#about-video")).toBeVisible();
  await expect(page.locator("#about-product")).toBeHidden();
  await page.locator("#about-video").dispatchEvent("ended");
  await expect(page.locator("#about-product")).toBeVisible();
  await expect(page.locator("#raket-link")).toHaveAttribute("href", "https://www.raket.ph/test-product");
});
