const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { PGlite } = require("@electric-sql/pglite");
const CategoryPolicy = require("../category-policy.js");

test("free-access migration removes all plan restrictions while preserving ownership, data, and revision checks", async () => {
  const db = new PGlite();
  const user = "11111111-1111-4111-8111-111111111111";
  try {
    await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls;");
    for (const name of ["001_accounts_and_billing.sql", "002_category_limits.sql"]) {
      await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
    }
    await db.query("insert into auth.users values ($1)", [user]);
    await db.query("insert into public.monea_accounts(user_id, stripe_customer_id) values ($1, 'cus_legacy')", [user]);
    await db.query("select public.monea_apply_subscription('sub_legacy', 'cus_legacy', 'normal', 'canceled', '2020-01-01', 100, 'evt_old')");
    await db.query("select public.monea_create_category($1, 0, 'income', 'Existing category')", [user]);
    await db.exec(await readFile("supabase/migrations/003_free_access.sql", "utf8"));
    const entries = Array.from({ length: 100 }, (_, i) => ({ id: `t-${i}`, name: `Entry ${i}`, note: "", type: i % 2 ? "income" : "expense", category: `Category ${i}`, date: "2026-01-01", amount: 100, paid: false }));
    const saved = (await db.query("select public.monea_save_transactions($1, 1, $2) as saved", [user, JSON.stringify(entries)])).rows[0].saved;
    assert.equal(saved.plan, "free");
    assert.equal(saved.categories.length, 101);
    assert.equal(saved.transactions.length, 100);
    const category = (await db.query("select public.monea_create_category($1, 2, 'income', 'One more') as saved", [user])).rows[0].saved;
    assert.equal(category.categories.length, 102);
    await assert.rejects(db.query("select public.monea_save_transactions($1, 1, '[]')", [user]), /REVISION_CONFLICT/);
    const details = (await db.query("select public.monea_account_details($1) as details", [user])).rows[0].details;
    assert.equal(details.plan, "free");
    assert.equal(details.subscription, undefined);
    assert.equal((await db.query("select count(*)::integer as count from public.monea_subscriptions")).rows[0].count, 1);
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select public.monea_create_category($1, 3, 'income', 'Bypass')", [user]), /permission denied/);
    await assert.rejects(db.query("select * from public.monea_accounts"), /permission denied/);
    await db.exec("reset role");
  } finally { await db.close(); }
});

test("local category registry has no category count limit and still validates names", () => {
  const categories = Array.from({ length: 100 }, (_, i) => ({ type: "income", name: `Income ${i}` }));
  assert.equal(CategoryPolicy.merge([], categories).length, 100);
  assert.equal(CategoryPolicy.normalize("income", ""), null);
});
