# Perfi

Perfi is sold through Raket PH for a one-time price of ₱299 with lifetime app access. After purchase, there are no recurring subscriptions or additional app access fees. Income categories, expense categories, transactions, dashboards, monthly reports, and full-history CSV exports have no subscription limits.

Purchase verification is not implemented in this app; this describes the external sales offer, not an access-control mechanism. Existing local-storage keys and database identifiers retain their legacy names to preserve saved data.

The unlisted About page uses `public/lv_0_20261116113733.mp4`. Add the Raket PH product URL to `data-product-url` in `about.html` when available. The lifetime-access offer appears when playback ends; the purchase button stays hidden until a URL is configured. The build copies `public` into `dist/public`.

Email sign-in, sign-out, account ownership, and cross-device data syncing remain enabled. Guests can use all features locally, including full-history export. Sign in to save financial data to an account.

## Database update required

Apply supabase/migrations/003_free_access.sql in the Supabase SQL Editor before deploying this version. It removes database category quotas without deleting accounts, categories, transactions, or historical billing records. It retains validation, ownership protections, and revision checks against concurrent edits.

For an existing installation, apply only migrations that have not already been applied. Migration 003 requires 001_accounts_and_billing.sql and 002_category_limits.sql. For a new project, run 001, 002, and then 003 in order. The earlier migrations describe the historical subscription system; 003 removes in-app subscription restrictions.

The app cannot run this migration through a Supabase service-role API key alone. Use the SQL Editor or a direct database connection.

## Run locally

Use Node.js 22 or later. Run npm ci, then npm run dev, and open http://127.0.0.1:5500. Restart the server after code changes.

Copy .env.example to .env.local and set APP_URL, SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY. The public key is used for email sign-in; the service-role key stays on the server. Stripe keys are not needed. The server serves only the files built into dist.

Enable the Email provider in Supabase Authentication. The Account dialog supports email/password sign-in and a separate Create account option. Account creation runs through the server service role, marks the new address as confirmed, and returns the form to sign-in, so it does not send a confirmation email. This means account email addresses are unverified. Configure Site URL and redirect allowlist for your production origin and http://127.0.0.1:5500/ when developing locally.

Users can select **Forgot password?** in the Account dialog to request a recovery email, then set and confirm a new password after opening the link. This also lets existing magic-link users set a password. Recovery uses Supabase Auth email delivery; configure its SMTP service for production and allow the exact redirect URL `https://your-domain/?recovery=1` (locally, `http://127.0.0.1:5500/?recovery=1`). Open the link in the same browser that requested it because recovery uses PKCE. Expired links can be replaced by requesting another email. Creating an account with an existing email does not reset its password or grant access to its data. Passwords are sent directly to Supabase Auth; the app continues using Supabase sessions for cloud data access.

## Accounts and data

After a successful password login, the Account dialog displays “Login successful.” To also email the user a plain notification, set `RESEND_API_KEY` and `LOGIN_EMAIL_FROM` in `.env.local` and your deployment environment. Use a sender such as `Perfi <notifications@your-domain.com>` on a verified Resend domain (see [Resend email setup](https://resend.com/docs/api-reference/emails/send-email)). Restart or redeploy after configuring these values. The email contains no confirmation link or button and requires no action. Missing email configuration or delivery failures do not block login. Notification failures are logged by the server; API acceptance does not guarantee inbox delivery.

The notification endpoint verifies the signed-in user, uses their account email, and accepts only logins from the past five minutes. Resend idempotency keys prevent repeat emails for the same login. Reloading the page, refreshing a token, and creating an account do not trigger notifications.

The API verifies the session and derives the user ID from it. Browser roles cannot directly edit account tables or privileged database functions. Financial data remains private to its account owner.

New accounts start empty. Existing local data stays on the device; export a monthly CSV and import it after signing in to migrate it. Signing out clears cloud data from the page. Cloud data is never stored in the guest ledger or service-worker cache.

Category names are case-insensitive within each transaction type. Empty categories are retained, and deleting a transaction does not delete its category. Existing browser ledgers are preserved and migrated when saved.

Revision checks prevent stale sessions from overwriting newer changes. Other tabs refresh after changes; visible sessions also refresh every 30 seconds and when returning to focus or reconnecting. Cloud writes require a connection and never silently fall back to local storage.

## Billing disabled

Checkout, billing-portal, and webhook routes return HTTP 410, even if old Stripe credentials remain configured. There are no in-app subscriptions or locked reports. The About and pricing pages explain the one-time Raket PH purchase and lifetime access.

Historical billing records are retained for reference. Disabling app billing endpoints does not cancel any subscriptions that might already exist in an external Stripe account; any such subscriptions must be canceled there separately.

## Verification

Run npm run check, npm test, npm run build, and npm run test:browser. Browser tests use installed Google Chrome in headless mode and mocked account services. Database tests use PGlite. Tests cover authentication and ownership, data preservation, unlimited free categories, concurrent writes, disabled billing, and free report exports. Historical migration tests still verify the earlier migration chain separately from the free-access migration.

The ledger is currently sent as one document, with a 4 MB request safety limit; very large ledgers will need paginated storage. This is a transport limit, not a subscription quota.
