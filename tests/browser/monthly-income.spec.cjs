const { test, expect } = require("@playwright/test");

test("retains previous income across months without duplicating saved transactions", async ({ page, context }) => {
  const transactions = [
    { id: "salary", name: "Salary", category: "Income", type: "income", amount: 82000, date: "2026-09-01" },
    { id: "savings", name: "Savings", category: "Savings", type: "savings", amount: 30000, date: "2026-09-01" },
    { id: "expense", name: "Bills", category: "Housing & Bills", type: "expense", amount: 37908, date: "2026-09-01" },
    { id: "october", name: "Bills", category: "Housing & Bills", type: "expense", amount: 2000, date: "2026-10-01" },
  ];
  await page.clock.install({ time: new Date("2026-11-03T12:00:00") });
  await context.route("**/api/config", route => route.fulfill({ json: { configured: false } }));
  await context.addInitScript(transactions => {
    const key = "monea-transactions-php-v3";
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(transactions));
  }, transactions);
  await page.goto("/");
  await expect(page.locator("#income-total")).toHaveText("₱82,000.00");
  await page.locator("#month-picker").fill("2026-10");
  await expect(page.locator("#balance-value")).toHaveText("₱80,000.00");
  await expect(page.locator("#budget-remaining")).toHaveText("₱80,000");
  await expect(page.locator("#balance-formula")).toContainText("Using income from September 2026");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-month").click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream) csv += chunk.toString();
  expect(csv).toContain("82000");
  expect(csv).toContain("Income retained from");
  expect(csv).toContain("80000");
  await page.locator("#month-picker").fill("2026-09");
  await expect(page.locator("#balance-value")).toHaveText("₱14,092.00");
  await expect(page.locator("#balance-formula")).not.toContainText("Using income from");
  await page.locator("#month-picker").fill("2026-08");
  await expect(page.locator("#income-total")).toHaveText("₱0.00");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("monea-transactions-php-v3")));
  expect(Array.isArray(stored) ? stored : stored.transactions).toHaveLength(4);
  await page.evaluate(() => {
    const key = "monea-transactions-php-v3";
    const stored = JSON.parse(localStorage.getItem(key));
    const entries = Array.isArray(stored) ? stored : stored.transactions;
    entries.push({ id: "new-income", name: "Salary", category: "Income", type: "income", amount: 90000, date: "2026-10-01" });
    localStorage.setItem(key, JSON.stringify(stored));
  });
  await page.reload();
  await expect(page.locator("#income-total")).toHaveText("₱90,000.00");
  await page.locator("#month-picker").fill("2026-10");
  await expect(page.locator("#balance-value")).toHaveText("₱88,000.00");
  await expect(page.locator("#balance-formula")).not.toContainText("Using income from");
});
