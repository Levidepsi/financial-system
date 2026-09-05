const { test, expect } = require("@playwright/test");
const KEY = "monea-transactions-php-v3";
const today = new Date().toISOString().slice(0, 10);
const entry = (id, type = "expense") => ({ id, name: id, note: "", category: type === "income" ? "Income" : "Debt Repayment", type, amount: 50, date: today, paid: false });

async function guest(context, transactions = []) {
  await context.route("**/api/config", (route) => route.fulfill({ json: { configured: false, billingConfigured: false } }));
  await context.addInitScript(({ key, transactions }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(transactions));
  }, { key: KEY, transactions });
}

async function signedIn(context, transactions = []) {
  const user = { id: "11111111-1111-4111-8111-111111111111", email: "member@example.com", aud: "authenticated", role: "authenticated" };
  const encode = (data) => Buffer.from(JSON.stringify(data)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })}.signature`;
  await context.addInitScript(({ user, token, key }) => {
    if (!sessionStorage.getItem("test-auth-initialized")) {
      localStorage.setItem("sb-example-auth-token", JSON.stringify({ access_token: token, refresh_token: "refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer", user }));
      localStorage.setItem(key, "[]");
      sessionStorage.setItem("test-auth-initialized", "yes");
    }
  }, { user, token, key: KEY });
  await context.route("https://example.supabase.co/**", (route) => route.fulfill({ json: user }));
  await context.route("**/api/config", (route) => route.fulfill({ json: {
    configured: true, billingConfigured: true, supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "public",
  } }));
  const account = { user, plan: "normal", revision: 0, transactions, hasCustomer: true };
  await context.route("**/api/account", (route) => route.fulfill({ json: account }));
  await context.route("**/api/transactions", async (route) => {
    const body = route.request().postDataJSON();
    if (body.revision !== account.revision) return route.fulfill({ status: 409, json: { error: "Another session changed your data. Please try again." } });
    account.transactions = body.transactions;
    account.revision += 1;
    return route.fulfill({ json: account });
  });
  return account;
}

test("shows exact plan prices and disabled checkout until configured", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await guest(context);
  await page.goto("/");
  await expect(page.locator("#account-status")).toContainText("Local demo");
  await page.getByRole("button", { name: "Account & plans", exact: true }).click();
  await expect(page.locator("#account-dialog")).toBeVisible();
  await expect(page.locator(".plan-price")).toHaveText(["$1 USD / month", "$5 USD / month"]);
  await expect(page.getByRole("button", { name: "Choose Premium" })).toBeDisabled();
  await expect(page.locator("#sign-in-form")).toBeHidden();
  expect(errors).toEqual([]);
});

test("loan paid state updates in another open tab and survives reload", async ({ page, context }) => {
  await guest(context, [entry("Loan")]);
  await page.goto("/");
  await expect(page.locator("#account-status")).toContainText("Local demo");
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.locator("#account-status")).toContainText("Local demo");
  await second.getByRole("button", { name: "Paid loans", exact: true }).click();
  await page.getByRole("button", { name: "Mark paid: Loan", exact: true }).click();
  await expect(second.locator("#transaction-list")).toContainText("Loan");
  await second.reload();
  await expect(second.getByRole("button", { name: "Mark unpaid: Loan", exact: true })).toBeVisible();
});

test("sixth local income is rejected without closing the form or losing entries", async ({ page, context }) => {
  await guest(context, Array.from({ length: 5 }, (_, i) => entry(`Income${i}`, "income")));
  await page.goto("/");
  await expect(page.locator("#account-status")).toContainText("Local demo");
  await page.locator("[data-open-dialog]").first().click();
  await page.locator('input[name="type"][value="income"]').check();
  await page.locator("#amount").fill("100");
  await page.locator('#transaction-form input[name="name"]').fill("Sixth salary");
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.locator("#toast")).toContainText("five income");
  await expect(page.locator("#transaction-dialog")).toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).length, KEY)).toBe(5);
});

test("cloud saves update other sessions without copying account data to guest storage", async ({ page, context }) => {
  const account = await signedIn(context, [entry("PrivateLoan")]);
  await page.goto("/");
  await expect(page.locator("#account-status")).toContainText("Normal");
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.locator("#account-status")).toContainText("Normal");
  await second.getByRole("button", { name: "Paid loans", exact: true }).click();
  await page.getByRole("button", { name: "Mark paid: PrivateLoan", exact: true }).click();
  await expect(second.locator("#transaction-list")).toContainText("PrivateLoan");
  expect(account.transactions[0].paid).toBe(true);
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe("[]");
  await page.getByRole("button", { name: "Account & plans", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator("#account-status")).toContainText("Local demo");
  await expect(page.locator("#transaction-list")).not.toContainText("PrivateLoan");
});

test("a stale cloud save loads newer data and preserves the user's form", async ({ page, context }) => {
  const account = await signedIn(context);
  await page.goto("/");
  await expect(page.locator("#account-status")).toContainText("Normal");
  await page.locator("[data-open-dialog]").first().click();
  await page.locator("#amount").fill("10");
  await page.locator('#transaction-form input[name="name"]').fill("My expense");
  await page.locator("#transaction-category").selectOption("Shopping");
  account.transactions = [entry("Another session's expense")];
  account.revision = 1;
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.locator("#toast")).toContainText("Another session");
  await expect(page.locator("#transaction-dialog")).toBeVisible();
  await expect(page.locator('#transaction-form input[name="name"]')).toHaveValue("My expense");
  expect(account.transactions).toHaveLength(1);
});

test("account plans fit a mobile screen", async ({ page, context }) => {
  await guest(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Account & plans", exact: true }).click();
  await expect(page.locator("#account-dialog")).toBeVisible();
  expect(await page.locator("#account-dialog").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
});
