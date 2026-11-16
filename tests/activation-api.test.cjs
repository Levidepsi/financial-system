const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { createHandler } = require("../server/api.cjs");
const { hash } = require("../server/access.cjs");

const user = { id: "11111111-1111-4111-8111-111111111111", email: "test@example.com" };
const sid = "22222222-2222-4222-8222-222222222222";
const token = `header.${Buffer.from(JSON.stringify({ session_id: sid })).toString("base64url")}.signature`;
const env = { PERFI_ACCESS_ENABLED: "true", APP_URL: "https://perfi.test", SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "public", SUPABASE_SERVICE_ROLE_KEY: "private", RAKET_PRODUCT_URL: "https://www.raket.ph/product" };
function database() {
  const tables = { perfi_access_config: [{ singleton: true, verified_at: new Date().toISOString() }],
    perfi_activation_sessions: [], perfi_web_sessions: [], perfi_login_activity: [] };
  const db = { tables, status: "active", creations: 0,
    auth: { getUser: async value => value === token ? { data: { user } } : { error: {} }, admin: { createUser: async input => {
      db.creations++;
      const activation = tables.perfi_activation_sessions.find(row => row.session_hash === input.app_metadata.perfi_activation_hash);
      if (activation.consumed_at) return { error: { code: "database_error" } };
      activation.consumed_at = new Date().toISOString(); activation.activated_user_id = user.id;
      return { data: { user } };
    } } },
    rpc: async name => ({ data: name === "perfi_rate_limit" ? true : { status: db.status } }),
    from(name) {
      const rows = tables[name] ||= [];
      let operation = "select", value, single = false;
      const filters = [];
      const query = { select: () => query, eq: (key, val) => { filters.push(row => row[key] === val); return query; },
        maybeSingle: () => { single = true; return query; },
        insert: data => { operation = "insert"; value = data; return query; },
        upsert: data => { operation = "insert"; value = data; return query; },
        delete: () => { operation = "delete"; return query; },
        then(resolve, reject) {
          if (operation === "insert") rows.push({ expires_at: new Date(Date.now() + 86400000).toISOString(), ...value });
          const found = rows.filter(row => filters.every(filter => filter(row)));
          if (operation === "delete") tables[name] = rows.filter(row => !found.includes(row));
          return Promise.resolve({ data: single ? found[0] || null : found }).then(resolve, reject);
        } };
      return query;
    } };
  return db;
}
async function invoke(handler, route, { method = "GET", body, headers = {} } = {}) {
  const req = Readable.from(body ? [JSON.stringify(body)] : []);
  Object.assign(req, { url: `/api?route=${route}`, method, headers: { origin: env.APP_URL, "content-type": "application/json", ...headers } });
  const result = { status: 200, headers: {} };
  await handler(req, { setHeader: (key, value) => { result.headers[key] = value; },
    set statusCode(value) { result.status = value; }, end: text => { try { result.body = JSON.parse(text); } catch { result.body = text; } } });
  return result;
}

test("purchase landing and server dashboard gate do not expose dashboard HTML", async () => {
  const db = database(); const handler = createHandler({ env, db });
  const landing = await invoke(handler, "page/home");
  assert.match(landing.body, /Unlock Your Financial Dashboard/);
  assert.doesNotMatch(landing.body, /id="transaction-form"/);
  assert.equal(landing.headers["Cache-Control"], "no-store, private");
  assert.equal((await invoke(handler, "page/dashboard")).headers.Location, "/login");
  assert.equal((await invoke(handler, "transactions", { method: "PUT", body: {} })).status, 401);
  db.status = "access_required";
  for (const [route, method] of [["account", "GET"], ["transactions", "PUT"], ["categories", "POST"], ["reports/history", "GET"]]) {
    assert.equal((await invoke(handler, route, { method, body: {}, headers: { authorization: `Bearer ${token}` } })).status, 403);
  }
});

test("activation cookie persists across refresh, is HttpOnly and Secure, and can be consumed only once", async () => {
  const db = database(); const handler = createHandler({ env, db });
  const initial = await invoke(handler, "activation/session", { method: "POST" });
  assert.equal(initial.body.state, "ready");
  const cookie = initial.headers["Set-Cookie"];
  assert.match(cookie, /HttpOnly; SameSite=Lax/); assert.match(cookie, /Secure/);
  assert.equal(JSON.stringify(initial.body).includes("session_hash"), false);
  const headers = { cookie: cookie.split(";")[0] };
  const again = await invoke(handler, "activation/session", { method: "POST", headers });
  assert.equal(again.body.state, "ready");
  assert.equal(db.tables.perfi_activation_sessions.length, 1);
  const body = { email: user.email, password: "test-password", confirmPassword: "test-password" };
  assert.equal((await invoke(handler, "activation/register", { method: "POST", headers, body })).status, 201);
  assert.equal((await invoke(handler, "activation/register", { method: "POST", headers, body })).status, 409);
  assert.equal((await invoke(handler, "activation/session", { method: "POST", headers })).body.state, "used");
  assert.equal(db.creations, 1);
  assert.equal((await invoke(handler, "auth/register", { method: "POST", body })).status, 403);
});

test("expired activation does not reset and cannot register; unverified rollout fails closed", async () => {
  const db = database(); const handler = createHandler({ env, db });
  const value = "c".repeat(64);
  db.tables.perfi_activation_sessions.push({ session_hash: hash(value), expires_at: "2000-01-01" });
  const headers = { cookie: `perfi_activation=${value}` };
  assert.equal((await invoke(handler, "activation/session", { method: "POST", headers })).body.state, "expired");
  assert.equal(db.tables.perfi_activation_sessions.length, 1);
  assert.equal((await invoke(handler, "activation/register", { method: "POST", headers, body: {} })).status, 410);
  db.tables.perfi_access_config[0].verified_at = null;
  assert.equal((await invoke(handler, "activation/session", { method: "POST" })).status, 503);
  assert.equal(db.creations, 0);
});

test("activated and complimentary users revisit activate through a server redirect", async () => {
  const db = database(); const handler = createHandler({ env, db });
  const bridge = await invoke(handler, "auth/session", { method: "POST", headers: { authorization: `Bearer ${token}` } });
  assert.equal(bridge.status, 200);
  const headers = { cookie: bridge.headers["Set-Cookie"].split(";")[0] };
  assert.equal((await invoke(handler, "page/activate", { headers })).headers.Location, "/dashboard");
  assert.equal((await invoke(handler, "activation/register", { method: "POST", headers, body: {} })).status, 409);
  assert.equal(db.creations, 0);
  const recovery = await invoke(handler, "page/login&recovery=1", { headers });
  assert.equal(recovery.status, 200);
  assert.match(recovery.body, /id="access-new-password"/);
  assert.equal(db.tables.perfi_activation_sessions.length, 0);
  assert.match((await invoke(handler, "page/dashboard", { headers })).body, /id="transaction-form"/);
  db.status = "expired";
  assert.equal((await invoke(handler, "page/dashboard", { headers })).headers.Location, "/login");
  assert.equal((await invoke(handler, "auth/activity", { method: "POST", headers: { authorization: `Bearer ${token}` } })).status, 401);
  assert.equal((await invoke(handler, "auth/logout", { method: "POST", headers: { authorization: `Bearer ${token}` } })).status, 200);
  assert.ok(db.tables.perfi_login_activity[0].revoked_at);
  assert.equal(db.tables.perfi_web_sessions.length, 0);
});

test("activation rejects mismatched passwords and foreign origins without creating users", async () => {
  const db = database(); const handler = createHandler({ env, db });
  const initial = await invoke(handler, "activation/session", { method: "POST" });
  const headers = { cookie: initial.headers["Set-Cookie"].split(";")[0] };
  assert.equal((await invoke(handler, "activation/register", { method: "POST", headers, body: { email: user.email, password: "test-password", confirmPassword: "different" } })).status, 400);
  assert.equal((await invoke(handler, "activation/session", { method: "POST", headers: { origin: "https://evil.test" } })).status, 403);
  assert.equal(db.creations, 0);
});

test("network retry after completed activation never creates another account", async () => {
  const db = database();
  const create = db.auth.admin.createUser;
  db.auth.admin.createUser = async input => { await create(input); throw new Error("response lost"); };
  const handler = createHandler({ env, db });
  const initial = await invoke(handler, "activation/session", { method: "POST" });
  const headers = { cookie: initial.headers["Set-Cookie"].split(";")[0] };
  const body = { email: user.email, password: "test-password", confirmPassword: "test-password" };
  assert.equal((await invoke(handler, "activation/register", { method: "POST", body, headers })).status, 503);
  assert.equal((await invoke(handler, "activation/register", { method: "POST", body, headers })).status, 409);
  assert.equal(db.creations, 1);
});
