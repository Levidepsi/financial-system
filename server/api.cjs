const { createClient } = require("@supabase/supabase-js");
const { HttpError, validateTransactions } = require("./validation.cjs");
const CategoryPolicy = require("../category-policy.js");

const DATABASE_ERRORS = {
  REVISION_CONFLICT: [409, "Another session changed your data. The latest version has been loaded; try again."],
  CATEGORY_LIMIT: [503, "The database needs the free-access update. Please contact the app administrator."],
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

function createHandler({ env = process.env, db: providedDb } = {}) {
  let db = providedDb;
  const authConfigured = () => Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY);
  // Billing is deliberately disabled even if old Stripe credentials remain.
  const billingConfigured = () => false;

  function database() {
    if (!authConfigured()) throw new HttpError(503, "Account sign-in is not configured yet.");
    return db ||= createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } });
  }
  async function accountFor(userId) {
    result(await database().from("monea_accounts").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true }));
    return result(await database().from("monea_accounts").select("*").eq("user_id", userId).single());
  }
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      const url = new URL(req.url, "http://localhost");
      const route = url.searchParams.get("route") || url.pathname.replace(/^\/api\/?/, "");
      if (route.startsWith("billing/") || route.startsWith("stripe/")) {
        throw new HttpError(410, "Perfi is free. Subscriptions and billing are disabled.");
      }
      if (route === "config" && req.method === "GET") {
        res.end(JSON.stringify({ configured: authConfigured(), billingConfigured: billingConfigured(),
          supabaseUrl: authConfigured() ? env.SUPABASE_URL : null,
          supabaseAnonKey: authConfigured() ? env.SUPABASE_ANON_KEY : null }));
        return;
      }
      const allowed = { account: "GET", transactions: "PUT", categories: "POST", "reports/history": "GET" };
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
        payload = { user: { id: user.id, email: user.email }, categories: details.categories, plan: "free", revision: account.revision,
          transactions: account.transactions };
      } else if (route === "categories") {
        const body = await jsonBody(req);
        const category = CategoryPolicy.normalize(body?.type, body?.name);
        if (!category || !Number.isSafeInteger(body.revision) || body.revision < 0) throw new HttpError(400, "Enter a valid category and revision.");
        payload = result(await database().rpc("monea_create_category", {
          p_user_id: user.id, p_revision: body.revision, p_type: category.type, p_name: category.name,
        }));
      } else if (route === "reports/history") {
        payload = { transactions: account.transactions };
      } else if (route === "transactions") {
        const body = await jsonBody(req);
        if (!Number.isSafeInteger(body?.revision) || body.revision < 0) throw new HttpError(400, "Invalid revision.");
        payload = result(await database().rpc("monea_save_transactions", {
          p_user_id: user.id, p_revision: body.revision, p_transactions: validateTransactions(body.transactions),
        }));
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
