const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");
const { HttpError, validateTransactions, subscriptionRecord } = require("./validation.cjs");
const CategoryPolicy = require("../category-policy.js");

const DATABASE_ERRORS = {
  REVISION_CONFLICT: [409, "Another session changed your data. The latest version has been loaded; try again."],
  NORMAL_INCOME_CATEGORY_LIMIT: [403, CategoryPolicy.message("income", "normal")],
  NORMAL_EXPENSE_CATEGORY_LIMIT: [403, CategoryPolicy.message("expense", "normal")],
  FREE_INCOME_CATEGORY_LIMIT: [403, CategoryPolicy.message("income", "none")],
  FREE_EXPENSE_CATEGORY_LIMIT: [403, CategoryPolicy.message("expense", "none")],
  INVALID_CATEGORY: [400, "Enter a valid income or expense category name."],
  CHECKOUT_PENDING: [409, "You already have a checkout open for the other plan. Finish it or wait for it to expire before choosing a different plan."],
};

function result({ data, error }) {
  if (error) {
    const known = Object.entries(DATABASE_ERRORS).find(([key]) => error.message?.includes(key));
    if (known) throw new HttpError(...known[1]);
    throw new HttpError(503, "Account storage is unavailable. Please try again.");
  }
  return data;
}

async function rawBody(req) {
  // Never access Vercel's lazy req.body helper: signatures require the
  // original bytes. Vercel restores these on the data/end event stream.
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    req.on("data", (chunk) => {
      length += Buffer.byteLength(chunk);
      if (length > 4_000_000) { reject(new HttpError(413, "Request is too large.")); return; }
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
    req.on("aborted", () => reject(new HttpError(400, "Request was interrupted.")));
  });
}

async function jsonBody(req) {
  if (!req.headers["content-type"]?.startsWith("application/json")) throw new HttpError(415, "Send application/json.");
  try { return JSON.parse((await rawBody(req)).toString("utf8")); }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, "Invalid JSON."); }
}

function createHandler({ env = process.env, db: providedDb, stripe: providedStripe } = {}) {
  let db = providedDb;
  let stripe = providedStripe;
  const prices = () => ({ normal: env.STRIPE_NORMAL_PRICE_ID, premium: env.STRIPE_PREMIUM_PRICE_ID });
  const authConfigured = () => Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY);
  const billingConfigured = () => Boolean(authConfigured() && env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
    && env.STRIPE_NORMAL_PRICE_ID && env.STRIPE_PREMIUM_PRICE_ID
    && env.STRIPE_NORMAL_PRICE_ID !== env.STRIPE_PREMIUM_PRICE_ID && env.APP_URL);

  function database() {
    if (!authConfigured()) throw new HttpError(503, "Account sign-in is not configured yet.");
    return db ||= createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } });
  }
  function payments() {
    if (!billingConfigured()) throw new HttpError(503, "Subscriptions are not configured yet.");
    return stripe ||= new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 15000 });
  }
  async function accountFor(userId) {
    result(await database().from("monea_accounts").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true }));
    return result(await database().from("monea_accounts").select("*").eq("user_id", userId).single());
  }
  async function applySubscription(subscription, event) {
    const record = subscriptionRecord(subscription, prices());
    result(await database().rpc("monea_apply_subscription", {
      ...Object.fromEntries(Object.entries(record).map(([key, value]) => [`p_${key}`, value])),
      p_event_created: event.created, p_event_id: event.id,
    }));
  }
  async function webhook(req) {
    const client = payments();
    let event;
    try { event = client.webhooks.constructEvent(await rawBody(req), req.headers["stripe-signature"], env.STRIPE_WEBHOOK_SECRET); }
    catch { throw new HttpError(400, "Invalid webhook signature."); }
    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      // Fetch current state so delayed deliveries cannot reactivate a canceled
      // subscription from an old payload. SQL also rejects older event times.
      const current = await client.subscriptions.retrieve(event.data.object.id);
      await applySubscription(current, event);
    }
    return { received: true };
  }
  async function customerFor(user, account) {
    if (account.stripe_customer_id) return account.stripe_customer_id;
    const customer = await payments().customers.create({ email: user.email, metadata: { monea_user_id: user.id } },
      { idempotencyKey: `monea-customer-${user.id}` });
    result(await database().from("monea_accounts").update({ stripe_customer_id: customer.id }).eq("user_id", user.id));
    return customer.id;
  }

  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      const url = new URL(req.url, "http://localhost");
      const route = url.searchParams.get("route") || url.pathname.replace(/^\/api\/?/, "");
      if (route === "config" && req.method === "GET") {
        res.end(JSON.stringify({ configured: authConfigured(), billingConfigured: billingConfigured(),
          supabaseUrl: authConfigured() ? env.SUPABASE_URL : null,
          supabaseAnonKey: authConfigured() ? env.SUPABASE_ANON_KEY : null }));
        return;
      }
      if (route === "stripe/webhook" && req.method === "POST") {
        res.end(JSON.stringify(await webhook(req))); return;
      }
      const allowed = { account: "GET", transactions: "PUT", categories: "POST", "reports/history": "GET", "billing/checkout": "POST", "billing/portal": "POST" };
      if (!Object.hasOwn(allowed, route)) throw new HttpError(404, "Not found.");
      if (req.method !== allowed[route]) { res.setHeader("Allow", allowed[route]); throw new HttpError(405, "Method not allowed."); }
      if (req.method !== "GET" && req.headers.origin && (!env.APP_URL || req.headers.origin !== new URL(env.APP_URL).origin)) {
        throw new HttpError(403, "Unrecognized request origin.");
      }
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!token) throw new HttpError(401, "Sign in to continue.");
      const { data: auth, error } = await database().auth.getUser(token);
      if (error || !auth?.user) throw new HttpError(401, "Your session expired. Sign in again.");
      const user = auth.user;
      const account = await accountFor(user.id);
      let payload;
      if (route === "account") {
        const details = result(await database().rpc("monea_account_details", { p_user_id: user.id }));
        payload = { user: { id: user.id, email: user.email }, ...details, revision: account.revision,
          transactions: account.transactions, hasCustomer: Boolean(account.stripe_customer_id) };
      } else if (route === "categories") {
        const body = await jsonBody(req);
        const category = CategoryPolicy.normalize(body?.type, body?.name);
        if (!category || !Number.isSafeInteger(body.revision) || body.revision < 0) throw new HttpError(400, "Enter a valid category and revision.");
        payload = result(await database().rpc("monea_create_category", {
          p_user_id: user.id, p_revision: body.revision, p_type: category.type, p_name: category.name,
        }));
      } else if (route === "reports/history") {
        const plan = result(await database().rpc("monea_plan", { p_user_id: user.id }));
        if (plan !== "premium") throw new HttpError(403, "Upgrade to Premium to export the full-history report.");
        payload = { transactions: account.transactions };
      } else if (route === "transactions") {
        const body = await jsonBody(req);
        if (!Number.isSafeInteger(body?.revision) || body.revision < 0) throw new HttpError(400, "Invalid revision.");
        payload = result(await database().rpc("monea_save_transactions", {
          p_user_id: user.id, p_revision: body.revision, p_transactions: validateTransactions(body.transactions),
        }));
      } else if (route === "billing/portal") {
        if (!account.stripe_customer_id) throw new HttpError(400, "Choose a subscription first.");
        const session = await payments().billingPortal.sessions.create({
          customer: account.stripe_customer_id, return_url: `${new URL(env.APP_URL).origin}/?billing=returned`,
        });
        payload = { url: session.url };
      } else if (route === "billing/checkout") {
        const body = await jsonBody(req);
        if (!["normal", "premium"].includes(body?.plan)) throw new HttpError(400, "Choose Normal or Premium.");
        const client = payments();
        const price = await client.prices.retrieve(prices()[body.plan]);
        if (!price.active || price.currency !== "usd" || price.unit_amount !== (body.plan === "normal" ? 100 : 500)
          || price.recurring?.interval !== "month" || price.recurring?.interval_count !== 1) {
          throw new HttpError(503, "The subscription price is not configured correctly.");
        }
        const customer = await customerFor(user, account);
        const subscriptions = await client.subscriptions.list({ customer, status: "all", limit: 100 });
        if (subscriptions.data.some((sub) => !["canceled", "incomplete_expired"].includes(sub.status))) {
          throw new HttpError(409, "You already have a subscription. Use Manage subscription to change plans or payment details.");
        }
        const reservation = result(await database().rpc("monea_reserve_checkout", { p_user_id: user.id, p_plan: body.plan }));
        const origin = new URL(env.APP_URL).origin;
        const session = await client.checkout.sessions.create({
          mode: "subscription", customer, client_reference_id: user.id,
          line_items: [{ price: prices()[body.plan], quantity: 1 }],
          subscription_data: { metadata: { monea_user_id: user.id } },
          success_url: `${origin}/?billing=success`, cancel_url: `${origin}/?billing=canceled`,
          expires_at: reservation.expires_at,
        }, { idempotencyKey: `monea-checkout-${reservation.key}` });
        payload = { url: session.url };
      }
      res.end(JSON.stringify(payload));
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 503;
      res.statusCode = status;
      res.end(JSON.stringify({ error: error instanceof HttpError ? error.message : "The service is temporarily unavailable. Please try again." }));
    }
  };
}

module.exports = { createHandler, rawBody };
