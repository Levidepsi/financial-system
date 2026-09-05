const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { PGlite } = require("@electric-sql/pglite");

let db;
const user = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const entry = (id, type = "expense", date = "2026-01-01") => ({ id: `t-${id}`, name: `Entry ${id}`, note: "", type,
  category: type === "income" ? "Income" : type === "savings" ? "Savings" : "Debt Repayment", amount: 100, date, paid: false });
const entries = (count, type = "expense", prefix = "e", date) => Array.from({ length: count }, (_, i) => entry(`${prefix}-${i}`, type, date));

async function plan(value, { status = "active", end = "2099-01-01", created = 100, id = `evt-${value}-${status}-${created}` } = {}) {
  return db.query("select public.monea_apply_subscription('sub_test', 'cus_test', $1, $2, $3, $4, $5)", [value, status, end, created, id]);
}
async function save(transactions, revision = 0, userId = user) {
  const { rows } = await db.query("select public.monea_save_transactions($1, $2, $3) as saved", [userId, revision, JSON.stringify(transactions)]);
  return rows[0].saved;
}
async function current() {
  const { rows } = await db.query("select transactions, revision from public.monea_accounts where user_id = $1", [user]);
  return rows[0];
}

before(async () => {
  db = new PGlite();
  await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(await readFile("supabase/migrations/001_accounts_and_billing.sql", "utf8"));
  await db.query("insert into auth.users values ($1), ($2)", [user, other]);
});
beforeEach(async () => {
  await db.exec("truncate public.monea_accounts cascade");
  await db.query("insert into public.monea_accounts(user_id, stripe_customer_id) values ($1, 'cus_test'), ($2, 'cus_other')", [user, other]);
});
after(async () => { await db?.close(); });

test("Normal permits five of each per month and unlimited savings", async () => {
  await plan("normal");
  const data = [...entries(5), ...entries(5, "income", "i"), ...entries(8, "savings", "s"), ...entries(5, "expense", "feb", "2026-02-01")];
  assert.equal((await save(data)).transactions.length, 23);
});

test("Normal rejects sixth income or expense, including batch imports, atomically", async () => {
  await plan("normal");
  await assert.rejects(save(entries(6, "income")), /PLAN_LIMIT/);
  await assert.rejects(save(entries(6)), /PLAN_LIMIT/);
  assert.deepEqual(await current(), { transactions: [], revision: 0 });
  await save(entries(5));
  await assert.rejects(save(entries(6), 1), /PLAN_LIMIT/);
  assert.equal((await current()).transactions.length, 5);
});

test("Premium has no plan entry cap", async () => {
  await plan("premium");
  assert.equal((await save([...entries(1000), ...entries(1000, "income", "i")])).transactions.length, 2000);
});

test("stale and concurrent writes cannot overwrite another session", async () => {
  await plan("normal");
  const attempts = await Promise.allSettled([save([entry("a")]), save([entry("b")])]);
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
  assert.match(attempts.find((r) => r.status === "rejected").reason.message, /REVISION_CONFLICT/);
  assert.equal((await current()).revision, 1);
});

test("expired/canceled accounts retain data and paid toggles but cannot add", async () => {
  await plan("premium");
  await save(entries(8));
  await plan("premium", { status: "canceled", created: 200 });
  await assert.rejects(save(entries(9), 1), /SUBSCRIPTION_REQUIRED/);
  const data = (await current()).transactions;
  data[0].paid = true;
  await save(data, 1);
  await save(data.slice(0, 7), 2);
  assert.equal((await current()).transactions[0].paid, true);
  await plan("premium", { end: "2020-01-01", created: 300 });
  await assert.rejects(save([...data, entry("new")], 3), /SUBSCRIPTION_REQUIRED/);
});

test("downgrade preserves excess history while preventing increased monthly counts", async () => {
  await plan("premium");
  await save(entries(8));
  await plan("normal", { created: 200 });
  await assert.rejects(save(entries(9), 1), /PLAN_LIMIT/);
  await save(entries(7), 1);
  await save([...entries(7), ...entries(5, "income", "i")], 2);
});

test("webhook updates are idempotent and older events cannot reactivate canceled subscriptions", async () => {
  await plan("premium");
  await plan("premium", { status: "canceled", created: 200 });
  await plan("premium", { created: 100 });
  await plan("premium", { status: "canceled", created: 200 });
  const { rows } = await db.query("select public.monea_plan($1) as plan", [user]);
  assert.equal(rows[0].plan, "none");
});

test("a subscription belongs only to the customer-mapped user", async () => {
  await plan("premium");
  await assert.rejects(save([entry("other")], 0, other), /SUBSCRIPTION_REQUIRED/);
});

test("browser roles cannot read account tables or directly bypass quota/billing functions", async () => {
  await db.exec("set role authenticated");
  try {
    await assert.rejects(db.query("select * from public.monea_accounts"), /permission denied/);
    await assert.rejects(save([entry("bypass")]), /permission denied/);
    await assert.rejects(plan("premium"), /permission denied/);
  } finally { await db.exec("reset role"); }
});

test("concurrent checkout retries reuse one reservation and reject a second plan", async () => {
  const reserve = (name) => db.query("select public.monea_reserve_checkout($1, $2) as reservation", [user, name]);
  const [a, b] = await Promise.all([reserve("normal"), reserve("normal")]);
  assert.equal(a.rows[0].reservation.key, b.rows[0].reservation.key);
  await assert.rejects(reserve("premium"), /CHECKOUT_PENDING/);
});
