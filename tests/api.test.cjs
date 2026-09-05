const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { createHandler, rawBody } = require("../server/api.cjs");
const { validateTransactions } = require("../server/validation.cjs");

const env = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "public", SUPABASE_SERVICE_ROLE_KEY: "private",
  APP_URL: "https://monea.example", STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_WEBHOOK_SECRET: "whsec_test",
  STRIPE_NORMAL_PRICE_ID: "price_normal", STRIPE_PREMIUM_PRICE_ID: "price_premium" };
async function invoke(handler, path, { method = "GET", body, headers = {} } = {}) {
  const req = Readable.from(body == null ? [] : [typeof body === "string" ? body : JSON.stringify(body)]);
  Object.assign(req, { url: `/api/${path}`, method, headers });
  const response = { status: 200, headers: {}, body: null };
  const res = { setHeader: (key, value) => { response.headers[key] = value; },
    set statusCode(value) { response.status = value; }, end: (value) => { response.body = JSON.parse(value); } };
  await handler(req, res);
  return response;
}

test("public config never exposes service or Stripe secrets", async () => {
  const response = await invoke(createHandler({ env }), "config");
  assert.equal(response.body.configured, true);
  assert.equal(response.body.billingConfigured, false);
  assert.equal(JSON.stringify(response.body).includes("private"), false);
  assert.equal(JSON.stringify(response.body).includes("sk_test"), false);
  assert.match(response.headers["Cache-Control"], /no-store/);
});

test("registration creates a confirmed password user without sending email", async () => {
  let created;
  const db = { auth: { admin: { createUser: async (value) => { created = value; return { data: { user: { id: "new-user" } } }; } } } };
  const response = await invoke(createHandler({ env, db }), "auth/register", { method: "POST",
    headers: { origin: "https://free-preview.vercel.app", host: "free-preview.vercel.app", "x-forwarded-proto": "https", "content-type": "application/json" },
    body: { email: " new@example.com ", password: "test-password-123" } });
  assert.equal(response.status, 201);
  assert.deepEqual(response.body, { created: true });
  assert.deepEqual(created, { email: "new@example.com", password: "test-password-123", email_confirm: true });
});

test("registration validates input, origin, method, and duplicate users", async () => {
  const duplicate = { auth: { admin: { createUser: async () => ({ error: { code: "email_exists", status: 422 } }) } } };
  const handler = createHandler({ env, db: duplicate });
  const headers = { origin: env.APP_URL, "content-type": "application/json" };
  assert.equal((await invoke(handler, "auth/register", { method: "GET" })).status, 405);
  assert.equal((await invoke(handler, "auth/register", { method: "POST", headers: { ...headers, origin: "https://evil.example", host: "monea.example" }, body: {} })).status, 403);
  assert.equal((await invoke(handler, "auth/register", { method: "POST", headers, body: { email: "invalid", password: "test-password-123" } })).status, 400);
  assert.equal((await invoke(handler, "auth/register", { method: "POST", headers, body: { email: "new@example.com", password: "short" } })).status, 400);
  const response = await invoke(handler, "auth/register", { method: "POST", headers,
    body: { email: "member@example.com", password: "test-password-123" } });
  assert.equal(response.status, 409);
  assert.match(response.body.error, /already exists/);
});

test("old checkout, portal, and webhook routes are disabled even with Stripe credentials", async () => {
  const handler = createHandler({ env });
  for (const path of ["billing/checkout", "billing/portal", "stripe/webhook"]) {
    const response = await invoke(handler, path, { method: "POST", body: { plan: "premium" } });
    assert.equal(response.status, 410);
    assert.match(response.body.error, /Perfi is free/);
  }
});
test("raw request reader never invokes Vercel's JSON body getter", async () => {
  const bytes = '{ "unchanged": true }';
  const req = Readable.from([bytes]);
  Object.defineProperty(req, "body", { get() { throw new Error("Must not parse the request body"); } });
  assert.equal((await rawBody(req)).toString(), bytes);
});
test("writes require auth and reject foreign origins", async () => {
  const handler = createHandler({ env });
  assert.equal((await invoke(handler, "transactions", { method: "PUT" })).status, 401);
  assert.equal((await invoke(handler, "transactions", { method: "PUT", headers: { origin: "https://evil.example" } })).status, 403);
  assert.equal((await invoke(handler, "transactions", { method: "GET" })).status, 405);
});
test("transaction writes use verified user identity, ignoring a forged user ID and plan", async () => {
  let args;
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "real-user" } } }) },
    from: () => ({ upsert: async () => ({ data: null }), select: () => ({ eq: () => ({ single: async () => ({ data: {} }) }) }) }),
    rpc: async (_name, value) => { args = value; return { data: { revision: 1 } }; },
  };
  const response = await invoke(createHandler({ env, db }), "transactions", { method: "PUT",
    headers: { authorization: "Bearer token", "content-type": "application/json" },
    body: { user_id: "victim", plan: "premium", revision: 0, transactions: [] } });
  assert.equal(response.status, 200);
  assert.equal(args.p_user_id, "real-user");
  assert.equal(args.plan, undefined);
});
test("server rejects malformed dates, duplicate IDs, and invalid transaction types", () => {
  const valid = { id: "t-1", name: "Salary", type: "income", category: "Income", amount: 50, date: "2026-01-01" };
  assert.equal(validateTransactions([valid])[0].amount, 50);
  assert.throws(() => validateTransactions([valid, valid]), /Invalid/);
  assert.throws(() => validateTransactions([{ ...valid, date: "2026-02-31" }]), /Invalid/);
  assert.throws(() => validateTransactions([{ ...valid, type: "premium" }]), /Invalid/);
  assert.throws(() => validateTransactions([{ ...valid, amount: Infinity }]), /Invalid/);
});

test("category API uses verified ownership without requiring a subscription", async () => {
  let args;
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from: () => ({ upsert: async () => ({ data: null }), select: () => ({ eq: () => ({ single: async () => ({ data: {} }) }) }) }),
    rpc: async (_name, value) => { args = value; return { data: { plan: "free", revision: 1 } }; },
  };
  const response = await invoke(createHandler({ env, db }), "categories", { method: "POST", headers: {
    authorization: "Bearer token", "content-type": "application/json",
  }, body: { revision: 0, type: "income", name: "Interest", user_id: "victim", plan: "premium" } });
  assert.equal(response.status, 200);
  assert.equal(args.p_user_id, "owner");
  assert.equal(response.body.plan, "free");
});

test("full-history reports are available to every signed-in account", async () => {
  let actualPlan = "normal";
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from: () => ({ upsert: async () => ({ data: null }), select: () => ({ eq: () => ({ single: async () => ({ data: { transactions: [] } }) }) }) }),
    rpc: async () => ({ data: actualPlan }),
  };
  const handler = createHandler({ env, db });
  assert.equal((await invoke(handler, "reports/history?plan=premium", { headers: { authorization: "Bearer token" } })).status, 200);
  actualPlan = "premium";
  assert.equal((await invoke(handler, "reports/history", { headers: { authorization: "Bearer token" } })).status, 200);
});
