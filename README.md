# Perfi

Perfi is free for everyone. Income categories, expense categories, transactions, dashboards, monthly reports, and full-history CSV exports have no subscription limits. No payment is required.

Email sign-in, sign-out, account ownership, and cross-device data syncing remain enabled. Guests can use all features locally, including full-history export. Sign in to save financial data to an account.

## Database update required

Apply supabase/migrations/003_free_access.sql in the Supabase SQL Editor before deploying this version. It removes database category quotas without deleting accounts, categories, transactions, or historical billing records. It retains validation, ownership protections, and revision checks against concurrent edits.

For an existing installation, apply only migrations that have not already been applied. Migration 003 requires 001_accounts_and_billing.sql and 002_category_limits.sql. For a new project, run 001, 002, and then 003 in order. The earlier migrations describe the historical paid system; 003 establishes the current free behavior.

The app cannot run this migration through a Supabase service-role API key alone. Use the SQL Editor or a direct database connection.

## Run locally

Use Node.js 22 or later. Run npm ci, then npm run dev, and open http://127.0.0.1:5500. Restart the server after code changes.

Copy .env.example to .env.local and set APP_URL, SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY. The public key is used for email sign-in; the service-role key stays on the server. Stripe keys are not needed. The server serves only the files built into dist.

Enable the Email provider and new user signups in Supabase Authentication. The Account dialog supports email/password sign-in and a separate Create account option (minimum 8 characters, subject to your Supabase password policy). To create accounts and sign in without email delivery, disable **Confirm Email** in Supabase Authentication settings. This assumes email addresses are unverified. With confirmation enabled, signup asks the user to confirm by email before signing in. Configure Site URL and redirect allowlist for your production origin and http://127.0.0.1:5500/ when developing locally.

Existing magic-link users need a password set through a trusted Supabase recovery or administrative process before using password sign-in. Creating an account with an existing email does not reset its password or grant access to its data. Passwords are sent directly to Supabase Auth; the app continues using Supabase sessions for cloud data access.

## Accounts and data

The API verifies the session and derives the user ID from it. Browser roles cannot directly edit account tables or privileged database functions. Making features free does not make financial data public.

New accounts start empty. Existing local data stays on the device; export a monthly CSV and import it after signing in to migrate it. Signing out clears cloud data from the page. Cloud data is never stored in the guest ledger or service-worker cache.

Category names are case-insensitive within each transaction type. Empty categories are retained, and deleting a transaction does not delete its category. Existing browser ledgers are preserved and migrated when saved.

Revision checks prevent stale sessions from overwriting newer changes. Other tabs refresh after changes; visible sessions also refresh every 30 seconds and when returning to focus or reconnecting. Cloud writes require a connection and never silently fall back to local storage.

## Billing disabled

Checkout, billing-portal, and webhook routes return HTTP 410, even if old Stripe credentials remain configured. The interface has no prices, upgrades, billing forms, or locked reports. The old pricing.html URL now explains that all features are free.

Historical billing records are retained for reference. Disabling app billing endpoints does not cancel any subscriptions that might already exist in an external Stripe account; any such subscriptions must be canceled there separately.

## Verification

Run npm run check, npm test, npm run build, and npm run test:browser. Browser tests use installed Google Chrome in headless mode and mocked account services. Database tests use PGlite. Tests cover authentication and ownership, data preservation, unlimited free categories, concurrent writes, disabled billing, and free report exports. Historical migration tests still verify the earlier migration chain separately from the free-access migration.

The ledger is currently sent as one document, with a 4 MB request safety limit; very large ledgers will need paginated storage. This is a transport limit, not a subscription quota.
