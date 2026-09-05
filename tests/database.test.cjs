const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { PGlite } = require("@electric-sql/pglite");

let db;
let migratedCategories;
const user = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const entry = (id, type = "expense", date = "2026-01-01") => ({ id: `t-${id}`, name: `Entry ${id}`, note: "", type,
  category: type === "income" ? "Income" : type === "savings" ? "Savings" : "Debt Repayment", amount: 100, date, paid: false });
const entries = (count, type = "expense", prefix = "e", date) => Array.from({ length: count }, (_, i) => entry(`${prefix}-${i}`, type, date));
const categoryEntries = (count, type = "expense") => entries(count, type).map((item, i) => ({ ...item, category: `${type} category ${i}` }));
async function createCategory(type, name, revision = 0, userId = user) {
  const { rows } = await db.query("select public.monea_create_category($1, $2, $3, $4) as saved", [userId, revision, type, name]);
  return rows[0].saved;
}

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
  await db.query("insert into public.monea_accounts(user_id, transactions) values ($1, $2)", [user, JSON.stringify(categoryEntries(8))]);
  await db.exec(await readFile("supabase/migrations/002_category_limits.sql", "utf8"));
  migratedCategories = (await db.query("select public.monea_categories_for($1) as categories", [user])).rows[0].categories;
});
beforeEach(async () => {
  await db.exec("truncate public.monea_accounts cascade");
  await db.query("insert into public.monea_accounts(user_id, stripe_customer_id) values ($1, 'cus_test'), ($2, 'cus_other')", [user, other]);
});
after(async () => { await db?.close(); });

test("Normal allows unlimited transactions within registered categories", async () => {
  await plan("normal");
  const data = [...entries(1000), ...entries(1000, "income", "i"), ...entries(8, "savings", "s")];
  assert.equal((await save(data)).transactions.length, 2008);
});

test("Normal rejects third income or sixth expense category, including imports, atomically", async () => {
  await plan("normal");
  await assert.rejects(save(categoryEntries(3, "income")), /NORMAL_INCOME_CATEGORY_LIMIT/);
  await assert.rejects(save(categoryEntries(6)), /NORMAL_EXPENSE_CATEGORY_LIMIT/);
  assert.deepEqual(await current(), { transactions: [], revision: 0 });
  const saved = await save([...categoryEntries(5), ...categoryEntries(2, "income").map((item) => ({ ...item, id: `i-${item.id}` }))]);
  assert.equal(saved.categories.length, 7);
  await assert.rejects(createCategory("expense", "Sixth", 1), /NORMAL_EXPENSE_CATEGORY_LIMIT/);
});

test("Premium has no category or transaction cap", async () => {
  await plan("premium");
  const saved = await save([...categoryEntries(100), ...categoryEntries(100, "income").map((item) => ({ ...item, id: `i-${item.id}` }))]);
  assert.equal(saved.categories.length, 200);
});

test("stale and concurrent writes cannot overwrite another session", async () => {
  await plan("normal");
  const attempts = await Promise.allSettled([save([entry("a")]), save([entry("b")])]);
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
  assert.match(attempts.find((r) => r.status === "rejected").reason.message, /REVISION_CONFLICT/);
  assert.equal((await current()).revision, 1);
});

test("expired/canceled accounts can add transactions and retain all existing categories", async () => {
  await plan("premium");
  await save(entries(8));
  await plan("premium", { status: "canceled", created: 200 });
  await save(entries(9), 1);
  const data = (await current()).transactions;
  data[0].paid = true;
  await save(data, 2);
  await save(data.slice(0, 7), 3);
  assert.equal((await current()).transactions[0].paid, true);
  await plan("premium", { end: "2020-01-01", created: 300 });
  await save([...data, entry("new")], 4);
  await assert.rejects(save(categoryEntries(6), 5), /FREE_EXPENSE_CATEGORY_LIMIT/);
});

test("downgrade preserves excess categories and prevents adding any new category of that type", async () => {
  await plan("premium");
  await save(categoryEntries(8));
  await plan("normal", { created: 200 });
  await assert.rejects(save(categoryEntries(9), 1), /NORMAL_EXPENSE_CATEGORY_LIMIT/);
  const saved = await save(categoryEntries(7), 1);
  assert.equal(saved.categories.length, 8);
  await save([...categoryEntries(7), { ...entry("extra"), category: "expense category 0" }], 2);
  await assert.rejects(createCategory("expense", "new", 3), /NORMAL_EXPENSE_CATEGORY_LIMIT/);
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
  await assert.rejects(save(categoryEntries(6), 0, other), /FREE_EXPENSE_CATEGORY_LIMIT/);
});

test("browser roles cannot read account tables or directly bypass quota/billing functions", async () => {
  await db.exec("set role authenticated");
  try {
    await assert.rejects(db.query("select * from public.monea_accounts"), /permission denied/);
    await assert.rejects(save([entry("bypass")]), /permission denied/);
    await assert.rejects(plan("premium"), /permission denied/);
    await assert.rejects(createCategory("income", "Bypass"), /permission denied/);
    await assert.rejects(db.query("insert into public.monea_categories(user_id, type, name) values ($1, 'income', 'Bypass')", [user]), /permission denied/);
  } finally { await db.exec("reset role"); }
});

test("migration preserves categories above the new limits", () => {
  assert.equal(migratedCategories.length, 8);
});

test("free users can save without subscribing, subject to category limits", async () => {
  const saved = await save([...entries(30), ...entries(30, "income", "i")]);
  assert.equal(saved.transactions.length, 60);
  assert.equal(saved.plan, "none");
  await createCategory("income", "Second income", 1);
  await assert.rejects(createCategory("income", "Third income", 2), /FREE_INCOME_CATEGORY_LIMIT/);
});

test("empty categories count and deleting all transactions does not remove categories", async () => {
  await plan("normal");
  await createCategory("income", "Salary");
  await createCategory("income", "Freelance", 1);
  const saved = await save([], 2);
  assert.equal(saved.categories.length, 2);
  await assert.rejects(createCategory("income", "Interest", 3), /NORMAL_INCOME_CATEGORY_LIMIT/);
});

test("case and whitespace variants reuse a category instead of consuming more slots", async () => {
  await createCategory("income", " Salary ");
  const saved = await save([{ ...entry("salary", "income"), category: "salary" }], 1);
  assert.equal(saved.categories.length, 1);
  assert.equal(saved.transactions[0].category, "Salary");
});

test("simultaneous category creation cannot exceed the last available slot", async () => {
  await plan("normal");
  await createCategory("income", "Salary");
  const attempts = await Promise.allSettled([createCategory("income", "Freelance", 1), createCategory("income", "Interest", 1)]);
  assert.equal(attempts.filter((item) => item.status === "fulfilled").length, 1);
  assert.match(attempts.find((item) => item.status === "rejected").reason.message, /REVISION_CONFLICT/);
  await assert.rejects(createCategory("income", "Third", 2), /NORMAL_INCOME_CATEGORY_LIMIT/);
});

test("account details include verified status, renewal, cancellation and billing amount", async () => {
  await db.query("select public.monea_apply_subscription('sub_test', 'cus_test', 'premium', 'active', '2099-01-01', 100, 'evt_details', true, 500, 'usd', 'month')");
  const details = (await db.query("select public.monea_account_details($1) as details", [user])).rows[0].details;
  assert.equal(details.plan, "premium");
  assert.equal(details.subscription.status, "active");
  assert.equal(details.subscription.cancelAtPeriodEnd, true);
  assert.equal(details.subscription.amount, 500);
  assert.match(details.subscription.periodEnd, /2099-01-01/);
});

test("concurrent checkout retries reuse one reservation and reject a second plan", async () => {
  const reserve = (name) => db.query("select public.monea_reserve_checkout($1, $2) as reservation", [user, name]);
  const [a, b] = await Promise.all([reserve("normal"), reserve("normal")]);
  assert.equal(a.rows[0].reservation.key, b.rows[0].reservation.key);
  await assert.rejects(reserve("premium"), /CHECKOUT_PENDING/);
});
