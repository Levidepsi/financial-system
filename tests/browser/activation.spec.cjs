const { test, expect } = require("@playwright/test");
const { readFile } = require("node:fs/promises");

async function setup(context, pageName = "home", state = "ready") {
  const html = (await readFile("access.html", "utf8")).replace('data-page="home"', `data-page="${pageName}" data-activation-state="${state}"`);
  const route = pageName === "home" ? "/" : `/${pageName}`;
  await context.route(`http://127.0.0.1:5510${route}`, handler => handler.fulfill({ contentType: "text/html", body: html }));
  await context.route("**/api/config", handler => handler.fulfill({ json: {
    configured: true, accessEnabled: true, supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "public", productUrl: "https://www.raket.ph/perfi-test",
  } }));
  await context.route("**/api/activation/session", handler => handler.fulfill({ json: { state } }));
  await context.route("**/api/auth/session", handler => handler.fulfill({ json: { access: "lifetime", redirect: "/dashboard" } }));
  await context.route("**/api/auth/login-notification", handler => handler.fulfill({ json: { notification: "sent" } }));
  await context.route("**/dashboard", handler => handler.fulfill({ contentType: "text/html", body: "<h1>Your financial dashboard</h1>" }));
  const user = { id: "11111111-1111-4111-8111-111111111111", email: "member@example.com", aud: "authenticated" };
  await context.route("https://example.supabase.co/auth/v1/**", handler => handler.fulfill({ json: {
    user, access_token: "test-token", refresh_token: "refresh", expires_in: 3600, token_type: "bearer",
  } }));
}

test("new customer sees purchase price, demo, and existing-account login on mobile", async ({ page, context }) => {
  await setup(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Unlock Your Financial Dashboard" })).toBeVisible();
  await expect(page.locator(".access-price")).toContainText("₱299");
  await expect(page.getByRole("link", { name: "Purchase on Raket PH" })).toHaveAttribute("href", "https://www.raket.ph/perfi-test");
  await expect(page.getByRole("link", { name: "Watch Demo" })).toHaveAttribute("href", "/about.html");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("activation validates confirmation, registers once and logs in to the dashboard", async ({ page, context }) => {
  await setup(context, "activate");
  let registrations = 0;
  await context.route("**/api/activation/register", handler => {
    registrations++;
    const body = handler.request().postDataJSON();
    expect(body.password).toBe(body.confirmPassword);
    return handler.fulfill({ status: 201, json: { activated: true } });
  });
  await page.goto("/activate");
  await page.locator("#access-email").fill("member@example.com");
  await page.locator("#access-password").fill("password-123");
  await page.locator("#access-confirm").fill("different-password");
  await page.getByRole("button", { name: "Activate lifetime access" }).click();
  await expect(page.locator("#auth-status")).toHaveText("Passwords do not match.");
  expect(registrations).toBe(0);
  await page.locator("#access-confirm").fill("password-123");
  await page.getByRole("button", { name: "Activate lifetime access" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(registrations).toBe(1);
});

for (const [state, title] of [["used", "Already Used"], ["expired", "Activation session expired"]]) {
  test(`${state} activation session shows login instead of a new registration form`, async ({ page, context }) => {
    await setup(context, "activate", state);
    await page.goto("/activate");
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.locator("#access-form")).toBeHidden();
    await expect(page.getByRole("link", { name: "Already activated? Log in" })).toBeVisible();
    await page.reload();
    await expect(page.locator("#access-form")).toBeHidden();
  });
}

test("returning user logs in without activation", async ({ page, context }) => {
  await setup(context, "login");
  await page.goto("/login");
  await page.locator("#access-email").fill("member@example.com");
  await page.locator("#access-password").fill("password-123");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
