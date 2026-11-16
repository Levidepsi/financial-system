# Perfi activation rollout

## Current state and important limits

Implementation is staged locally. No production migration, user creation, entitlement update, or deployment was performed. Enforcement defaults to **off** unless `PERFI_ACCESS_ENABLED=true`.

A read-only inspection on 2026-11-16 found **4 Supabase Auth users**, **3 finance account rows**, and **11 category rows**. The actual migration selects all Auth users up to its fixed cutoff, including users without finance rows. Counts may change before rollout; inspect again during the release window.

The shared `/activate` URL **does not verify a Raket PH purchase**. A new browser can obtain a new activation session without paying. Single-use sessions stop reuse of that session, not unpaid registration. This implementation does not add purchase approval or another payment provider.

## Architecture

- Existing Supabase Auth and password login are retained. The existing app uses server-admin registration with `email_confirm: true`; this implementation preserves that behavior. It does not newly disable a confirmation step. Email addresses remain unverified, as they were before this change. If email verification is introduced later, adapt activation/sign-in to the confirmation flow before changing that setting.
- `perfi_entitlements`: permanent, unique, lifetime access keyed by Auth user ID. Sources: `complimentary_existing_user` or `activation`.
- `perfi_access_config`: captures the complimentary cutoff once, on the first application of migration 004. Rerunning it never moves the cutoff.
- `perfi_activation_sessions`: stores only the SHA-256 hash of a cryptographically random 256-bit cookie. Database expiry is 24 hours. The HttpOnly/Secure/SameSite=Lax cookie is kept longer so refreshing an expired or consumed session cannot silently create another. Only localhost HTTP development omits Secure.
- The `auth.users` insertion trigger grants the entitlement and consumes the activation session **in the same PostgreSQL transaction**. It trusts only admin-controlled `app_metadata`, never browser-editable `user_metadata`. Row locking prevents two users from consuming one session. A failed insertion rolls the entitlement and consumption back too.
- `perfi_login_activity`: server-side inactivity/revocation records per Supabase `session_id`, independent of the permanent entitlement. Active sessions are checked against `auth.sessions`. Background polling does not count as activity. Navigation, mutations, and human interaction can update activity, coalesced into five-minute intervals (expiry may be conservatively up to five minutes earlier than the final interaction).
- `perfi_web_sessions`: hashed opaque HttpOnly cookies map page requests to verified Supabase sessions. They contain no password or Supabase refresh token. An entitled user gets server redirects from `/` and `/activate` to `/dashboard`. The dashboard HTML is not shipped as a public static artifact.
- All finance API requests require a verified Supabase user, live session, and lifetime entitlement when enforcement is on. Direct public Supabase signup does not grant an entitlement.
- Logout revokes only the current Perfi login session and removes its page cookies. Lifetime entitlement and financial data remain intact.
- Rate limits are stored in PostgreSQL: 20 activation-session creations per network address/hour and 10 registration attempts per activation session/15 minutes. Vercel's trusted `x-vercel-forwarded-for` is hashed; raw addresses and activation secrets are not logged. Use upstream bot protection if abuse becomes a concern.
- Welcome email failure never rolls back a successful activation. Login notifications are preserved. Resend idempotency keys prevent repeated delivery from retries. Welcome delivery is best-effort, not an outbox with guaranteed retries.

## Required configuration

Vercel server environment:

| Variable | Value |
| --- | --- |
| `APP_URL` | `https://perfi.asia` |
| `SUPABASE_URL` | Existing project URL |
| `SUPABASE_ANON_KEY` | Existing public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing **server-only** service key |
| `RESEND_API_KEY` | Existing **server-only** Resend key |
| `LOGIN_EMAIL_FROM` | `Perfi <login@perfi.asia>` |
| `RAKET_PRODUCT_URL` | Actual full HTTPS Raket PH product URL; still needs to be supplied |
| `PERFI_ACCESS_ENABLED` | `false` until migration verification; then `true` |

Local development: use `APP_URL=http://127.0.0.1:5500`, a separate test Supabase project, and `PERFI_ACCESS_ENABLED=true` only after migrating/verifying that test project. Never test user creation against production automatically.

Supabase settings:

1. Keep Email/password authentication enabled and existing password security settings.
2. Disable public self-service signups before enabling the new flow. Admin `createUser` is the intended registration path. This is defense in depth: direct public signup cannot assign entitlements even if accidentally left enabled.
3. Keep Site URL `https://perfi.asia`. Add `https://perfi.asia/login?recovery=1` to allowed redirects; retain the existing `https://perfi.asia/?recovery=1` URL for old reset emails. Add corresponding localhost URLs only for development.
4. Keep recovery-email SMTP configured. Resend notification API configuration is separate from Supabase password-reset mail delivery.
5. The app implements seven-day inactivity server-side, so it does not depend on a paid Supabase session-timeout feature. Optionally also set Supabase's native inactivity timeout to seven days if available; keep the normal JWT expiry and refresh behavior. Do not set a seven-day JWT expiry as a substitute.

References: [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), [admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser).

## Safe deployment sequence — approval required

The request explicitly says: **“Do not deploy or execute production database changes without explicit approval.”** Obtain that approval before these steps. Nothing below is executed automatically.

1. Rehearse on a separate Supabase staging project, including admin registration through the actual Auth service (local tests simulate Auth inserts in PostgreSQL). Verify the `auth.users` trigger executes successfully under the managed Auth service.
2. Arrange a short registration maintenance window. Disable public signup and pause the legacy `/api/auth/register` route at the edge during the migration/cutover window. Existing users may continue reading data, but take fingerprints while writes are paused or reconcile legitimate writes. This avoids users being created after the fixed cutoff through the old registration flow.
3. Take a database backup. Save the results of the read-only queries below before migration. Do not export passwords, tokens, or financial records into logs.
4. Apply migrations 001–003 only if not already installed; then apply `supabase/migrations/004_lifetime_activation.sql` once. It is additive and idempotent. Do not run reset or destructive schema commands.
5. Re-run the fingerprint queries and confirm preserved finance data. Check the missing-entitlement query is zero. Only then execute `select public.perfi_verify_migration();`. This records readiness and returns the number of covered existing users. It is not purchase approval.
6. Deploy the code with `PERFI_ACCESS_ENABLED=false` first if needed for verification, keeping registration paused. Then set the flag to `true` and redeploy. Do not enable it before verification. A missing migration/readiness record fails closed rather than exposing finance data.
7. Set Raket PH's “Redirect Buyer to a URL” delivery target to `https://perfi.asia/activate`; set `RAKET_PRODUCT_URL` to the real product URL.
8. Verify an existing customer can log in without activation and see unchanged data; then create an approved staging/test customer through activation. Confirm reload, consumed-session reuse, logout/login, and welcome email behavior. Do not send test mail to real customers without permission.
9. Unpause registration traffic through the new activation path. The old `/api/auth/register` route now rejects creation while enforcement is on.

### Read-only verification queries

```sql
select count(*) as auth_users from auth.users;
select count(*) as finance_accounts,
  md5(coalesce(string_agg(row_to_json(a)::text, '|' order by user_id), '')) as finance_fingerprint
from public.monea_accounts a;
select count(*) as categories,
  md5(coalesce(string_agg(row_to_json(c)::text, '|' order by user_id, type, name), '')) as category_fingerprint
from public.monea_categories c;
```

After migration:

```sql
select complimentary_cutoff, verified_at from public.perfi_access_config;
select count(*) as missing_existing_entitlements
from auth.users u
where u.created_at <= (select complimentary_cutoff from public.perfi_access_config)
and not exists (select 1 from public.perfi_entitlements e where e.user_id = u.id);
select source, count(*) from public.perfi_entitlements group by source;
-- Only after reviewing the results and preserved-data fingerprints:
select public.perfi_verify_migration();
```

The cutoff must remain fixed. If a legitimate customer was created during an incorrectly managed cutover gap, investigate and perform a reviewed, explicit backfill for those specific pre-cutover users; never replace the cutoff with the current time on every deploy.

## Recovery and operational notes

- If activation succeeds but the response or automatic login fails, the user logs in normally. A reused cookie shows “Already Used”; it cannot create a second account. Existing credentials are never overwritten by activation.
- A 24-hour-expired cookie stays expired. A fresh browser can start again because the URL is intentionally public; this is not purchase verification.
- Existing sessions older than seven days may require one fresh login when enforcement begins. Entitlements remain permanent.
- Account pages and API responses use `no-store, private`. The new service worker removes old caches and never caches the protected dashboard. Offline visitors see a reconnect page; this does not implement offline account syncing.
- Retain consumed/expired activation tombstones while their cookies can remain (one year). Do not recycle their hashes. Expired rate-limit buckets and old web-session records can be cleaned by a separately reviewed retention job. Auth user deletion is governed by Supabase, not this rollout.
- This release does not modify transaction/category storage, local budgets, savings schedules, guest backups, or user settings. Legacy internal storage names are retained for compatibility.

## Rollback

Set `PERFI_ACCESS_ENABLED=false` and redeploy this version to restore the previous unrestricted application mode. Keep registration paused while assessing the incident. This deliberately reopens legacy guest access; it is an emergency rollback, not a paid-access mode. Do not drop entitlements, sessions, Auth users, or finance tables. Existing users can still sign in; permanent entitlements remain available for a later re-enable. Keep the new service worker cache version to avoid restoring obsolete cached dashboards. Re-enable only after resolving the issue and rechecking the fixed-cutoff coverage.

## Verification

Run `npm run check`, `npm test`, `npm run build`, and `npm run test:browser -- --workers=1`.
The new tests exercise migration idempotence/data preservation, atomic consumption, expiry, RLS, inactivity, server page/API access, cookie flags, registration validation, purchase UI, and automatic login redirects. Browser tests mock external Auth and email services; they do not prove production migration permissions or real email delivery.
