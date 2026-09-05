const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const Stripe = require("stripe");
const { createHandler, rawBody } = require("../server/api.cjs");
const { validateTransactions, subscriptionRecord } = require("../server/validation.cjs");

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
  assert.equal(JSON.stringify(response.body).includes("private"), false);
  assert.equal(JSON.stringify(response.body).includes("sk_test"), false);
  assert.match(response.headers["Cache-Control"], /no-store/);
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
test("webhooks reject unsigned or tampered payloads and apply verified current subscription state", async () => {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  let applied;
  stripe.subscriptions.retrieve = async () => ({ id: "sub_test", customer: "cus_real", status: "canceled",
    items: { data: [{ price: { id: "price_premium" }, current_period_end: 2000000000 }] } });
  const db = { rpc: async (_name, args) => { applied = args; return { data: null }; } };
  const handler = createHandler({ env, db, stripe });
  const payload = JSON.stringify({ id: "evt_valid", created: 100, type: "customer.subscription.updated", data: { object: { id: "sub_test", status: "active" } } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET });
  assert.equal((await invoke(handler, "stripe/webhook", { method: "POST", body: payload })).status, 400);
  assert.equal((await invoke(handler, "stripe/webhook", { method: "POST", body: `${payload} `, headers: { "stripe-signature": signature } })).status, 400);
  assert.equal((await invoke(handler, "stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } })).status, 200);
  assert.equal(applied.p_customer_id, "cus_real");
  assert.equal(applied.p_status, "canceled");
  assert.equal(applied.p_plan, "premium");
});
test("unknown prices never grant Premium", () => {
  const record = subscriptionRecord({ id: "sub", customer: "cus", status: "active",
    items: { data: [{ price: { id: "unrelated" }, current_period_end: 2000000000 }] } }, { premium: "price_premium", normal: "price_normal" });
  assert.equal(record.plan, "none");
});
test("server rejects malformed dates, duplicate IDs, and invalid transaction types", () => {
  const valid = { id: "t-1", name: "Salary", type: "income", category: "Income", amount: 50, date: "2026-01-01" };
  assert.equal(validateTransactions([valid])[0].amount, 50);
  assert.throws(() => validateTransactions([valid, valid]), /Invalid/);
  assert.throws(() => validateTransactions([{ ...valid, date: "2026-02-31" }]), /Invalid/);
  assert.throws(() => validateTransactions([{ ...valid, type: "premium" }]), /Invalid/);
  assert.throws(() => validateTransactions([{ ...valid, amount: Infinity }]), /Invalid/);
});

function checkoutFixture({ priceAmount = 100, subscriptions = [] } = {}) {
  const calls = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "real-user", email: "member@example.com" } } }) },
    from: () => ({ upsert: async () => ({ data: null }),
      select: () => ({ eq: () => ({ single: async () => ({ data: { stripe_customer_id: "cus_owned" } }) }) }) }),
    rpc: async (name) => {
      assert.equal(name, "monea_reserve_checkout");
      return { data: { key: "stable-reservation", expires_at: 2000000000 } };
    },
  };
  const stripe = {
    prices: { retrieve: async (id) => ({ id, active: true, currency: "usd", unit_amount: priceAmount,
      recurring: { interval: "month", interval_count: 1 } }) },
    subscriptions: { list: async () => ({ data: subscriptions }) },
    checkout: { sessions: { create: async (params, options) => {
      calls.push({ params, options }); return { url: "https://checkout.stripe.com/test" };
    } } },
    billingPortal: { sessions: { create: async (params) => { calls.push(params); return { url: "https://billing.stripe.com/test" }; } } },
  };
  return { handler: createHandler({ env, db, stripe }), calls };
}
const checkoutRequest = (plan = "normal") => ({ method: "POST", headers: {
  authorization: "Bearer verified", "content-type": "application/json", origin: env.APP_URL,
}, body: { plan, customer: "cus_victim", price: "price_free", success_url: "https://evil.example" } });

test("Checkout uses configured monthly price, authenticated customer, and stable idempotency", async () => {
  const { handler, calls } = checkoutFixture();
  assert.equal((await invoke(handler, "billing/checkout", checkoutRequest())).status, 200);
  assert.equal((await invoke(handler, "billing/checkout", checkoutRequest())).status, 200);
  assert.deepEqual(calls[0].params.line_items, [{ price: "price_normal", quantity: 1 }]);
  assert.equal(calls[0].params.customer, "cus_owned");
  assert.equal(calls[0].params.success_url, "https://monea.example/?billing=success");
  assert.equal(calls[0].options.idempotencyKey, calls[1].options.idempotencyKey);
});
test("misconfigured pricing and existing subscriptions cannot create a new checkout", async () => {
  const wrong = checkoutFixture({ priceAmount: 200 });
  assert.equal((await invoke(wrong.handler, "billing/checkout", checkoutRequest())).status, 503);
  assert.equal(wrong.calls.length, 0);
  const existing = checkoutFixture({ subscriptions: [{ status: "past_due" }] });
  assert.equal((await invoke(existing.handler, "billing/checkout", checkoutRequest())).status, 409);
  assert.equal(existing.calls.length, 0);
});
test("Premium checkout bills exactly $5 and portal cannot target another customer's account", async () => {
  const { handler, calls } = checkoutFixture({ priceAmount: 500 });
  assert.equal((await invoke(handler, "billing/checkout", checkoutRequest("premium"))).status, 200);
  assert.equal(calls[0].params.line_items[0].price, "price_premium");
  assert.equal((await invoke(handler, "billing/portal", checkoutRequest())).status, 200);
  assert.equal(calls[1].customer, "cus_owned");
});
