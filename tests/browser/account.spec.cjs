const { test, expect } = require("@playwright/test");
const CategoryPolicy = require("../../category-policy.js");
const KEY = "monea-transactions-php-v3";
const today = new Date().toISOString().slice(0, 10);
const entry = (id, type = "expense") => ({ id, name: id, note: "", category: type === "income" ? "Income" : "Debt Repayment", type, amount: 50, date: today, paid: false });

async function guest(context, transactions = [], categories = null) {
  await context.route("**/api/config", (route) => route.fulfill({ json: { configured: false, billingConfigured: false } }));
  await context.addInitScript(({ key, transactions, categories }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(categories ? { transactions, categories } : transactions));
  }, { key: KEY, transactions, categories });
}

async function signedIn(context, transactions = [], plan = "normal", categories = []) {
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
  const account = { user, plan, revision: 0, transactions, hasCustomer: true,
    categories: CategoryPolicy.merge(categories, CategoryPolicy.fromTransactions(transactions)),
    subscription: { plan, status: "active", amount: plan === "premium" ? 500 : 100, currency: "usd", interval: "month", periodEnd: "2099-01-01T00:00:00Z", cancelAtPeriodEnd: false } };
  await context.route("**/api/account", (route) => route.fulfill({ json: account }));
  await context.route("**/api/transactions", async (route) => {
    const body = route.request().postDataJSON();
    if (body.revision !== account.revision) return route.fulfill({ status: 409, json: { error: "Another session changed your data. Please try again." } });
    account.transactions = body.transactions;
    account.categories = CategoryPolicy.merge(account.categories, CategoryPolicy.fromTransactions(body.transactions));
    account.revision += 1;
    return route.fulfill({ json: account });
  });
  await context.route("**/api/categories", async (route) => {
    const body = route.request().postDataJSON();
    if (body.revision !== account.revision) return route.fulfill({ status: 409, json: { error: "Another session changed your data." } });
    const proposed = CategoryPolicy.merge(account.categories, [body]);
    account.categories = proposed;
    account.revision += 1;
    return route.fulfill({ json: account });
  });
  return account;
}

test("free account screen contains no pricing or upgrade controls", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await guest(context);
  await page.goto("/");
  await expect(page.locator("#account-status")).toContainText("Saved on this device");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.locator("#account-dialog")).toBeVisible();
  await expect(page.locator(".plan-price, [data-subscribe], #manage-subscription")).toHaveCount(0);
  await expect(page.locator("#account-dialog")).toContainText("No subscription or payment required");
  await expect(page.locator("#sign-in-form")).toBeHidden();
  expect(errors).toEqual([]);
});

test("loan paid state updates in another open tab and survives reload", async ({ page, context }) => {
  await guest(context, [entry("Loan")]);
  await page.goto("/");
  await expect(page.locator("#account-status")).toContainText("Saved on this device");
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.locator("#account-status")).toContainText("Saved on this device");
  await second.getByRole("button", { name: "Paid loans", exact: true }).click();
  await page.getByRole("button", { name: "Mark paid: Loan", exact: true }).click();
  await expect(second.locator("#transaction-list")).toContainText("Loan");
  await second.reload();
  await expect(second.getByRole("button", { name: "Mark unpaid: Loan", exact: true })).toBeVisible();
});

test("unsubscribed users can add more than five transactions within an existing category", async ({ page, context }) => {
  await guest(context, Array.from({ length: 5 }, (_, i) => entry(`Income${i}`, "income")));
  await page.goto("/");
  await expect(page.locator("#account-status")).toContainText("Saved on this device");
  await page.locator("[data-open-dialog]").first().click();
  await page.locator('input[name="type"][value="income"]').check();
  await page.locator("#amount").fill("100");
  await page.locator('#transaction-form input[name="name"]').fill("Sixth salary");
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.locator("#toast")).toContainText("Transaction added");
  await expect(page.locator("#transaction-dialog")).toBeHidden();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).transactions.length, KEY)).toBe(6);
});

test("cloud saves update other sessions without copying account data to guest storage", async ({ page, context }) => {
  const account = await signedIn(context, [entry("PrivateLoan")]);
  await page.goto("/");
  await expect(page.locator("#account-status")).toContainText("Synced to your account");
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.locator("#account-status")).toContainText("Synced to your account");
  await second.getByRole("button", { name: "Paid loans", exact: true }).click();
  await page.getByRole("button", { name: "Mark paid: PrivateLoan", exact: true }).click();
  await expect(second.locator("#transaction-list")).toContainText("PrivateLoan");
  expect(account.transactions[0].paid).toBe(true);
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe("[]");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator("#account-status")).toContainText("Saved on this device");
  await expect(page.locator("#transaction-list")).not.toContainText("PrivateLoan");
});

test("a stale cloud save loads newer data and preserves the user's form", async ({ page, context }) => {
  const account = await signedIn(context);
  await page.goto("/");
  await expect(page.locator("#account-status")).toContainText("Synced to your account");
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
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.locator("#account-dialog")).toBeVisible();
  expect(await page.locator("#account-dialog").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
});

test("categories remain available through Add Transaction", async ({ page, context }) => {
  await guest(context);
  await page.goto("/");
  await expect(page.locator("#account-status")).toContainText("Saved on this device");
  await expect(page.locator(".category-manager")).toHaveCount(0);
  await page.locator("[data-open-dialog]").first().click();
  await page.locator('input[name="type"][value="income"]').check();
  await page.locator("#amount").fill("100");
  await page.locator('#transaction-form input[name="name"]').fill("Freelance work");
  await page.locator('#transaction-category').selectOption('__custom__');
  await page.locator('#custom-category').fill('Freelance');
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.locator("#toast")).toContainText("Transaction added");
  await page.reload();
  await page.locator("[data-open-dialog]").first().click();
  await page.locator('input[name="type"][value="income"]').check();
  await expect(page.locator('#transaction-category option[value="Freelance"]')).toHaveCount(1);
});

test("accounts can create categories beyond old limits without any billing interface", async ({ page, context }) => {
  const categories = Array.from({ length: 7 }, (_, i) => ({ type: "income", name: `Income ${i}` }));
  const account = await signedIn(context, [], "premium", categories);
  await page.goto("/");
  await expect(page.locator("#account-status")).toContainText("Synced to your account");
  await page.locator("[data-open-dialog]").first().click();
  await page.locator('input[name="type"][value="income"]').check();
  await page.locator("#amount").fill("100");
  await page.locator('#transaction-form input[name="name"]').fill("Extra work");
  await page.locator('#transaction-category').selectOption('__custom__');
  await page.locator('#custom-category').fill('More income');
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.locator("#toast")).toContainText("Transaction added");
  expect(account.categories).toHaveLength(8);
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.locator("#profile-plan")).toHaveText("Free access");
  await expect(page.locator(".billing-summary, [data-subscribe]")).toHaveCount(0);
});

test("simultaneous local saves cannot silently overwrite the first transaction", async ({ page, context }) => {
  await guest(context);
  await page.goto("/");
  await expect(page.locator("#account-status")).toContainText("Saved on this device");
  const saved = await page.evaluate(async ({ first, second }) => {
    const outcomes = await Promise.all([saveTransactions([first]), saveTransactions([second])]);
    return outcomes;
  }, { first: entry("first"), second: entry("second") });
  expect(saved.filter(Boolean)).toHaveLength(1);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).transactions.length, KEY)).toBe(1);
});

test("guests can download the full-history report for free", async ({ page, context }) => {
  await guest(context, [entry("My loan")]);
  await page.goto("/");
  await expect(page.locator("#account-status")).toContainText("Saved on this device");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Full-history CSV", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toContain("perfi-full-history-");
  await expect(page.locator("#account-dialog")).toBeHidden();
});

test("old pricing URL explains free access without paid plans", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pricing.html");
  await expect(page.getByRole("heading", { name: "Your finances. All features. Free." })).toBeVisible();
  await expect(page.getByText("No subscription or payment required.")).toBeVisible();
  await expect(page.locator('[href*="plan="], .plan-price')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("email sign-in remains available without Stripe configuration", async ({ page, context }) => {
  await context.route("**/api/config", route => route.fulfill({ json: {
    configured: true, billingConfigured: false, supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "public",
  } }));
  let requestedEmail;
  await context.route("https://example.supabase.co/auth/v1/otp**", route => {
    requestedEmail = route.request().postDataJSON().email;
    return route.fulfill({ json: {} });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.locator("#sign-in-form")).toBeVisible();
  await page.locator("#account-email").fill("member@example.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.locator("#account-message")).toContainText("Check your email");
  expect(requestedEmail).toBe("member@example.com");
});
