# Monea

Personal finance tracker with a local demo, email sign-in, account-scoped cloud storage, loan payment status, and Stripe subscriptions.

| Plan | Monthly price | Income categories | Expense categories |
| --- | --- | --- | --- |
| Free (not subscribed) | $0 | 2 | 5 |
| Normal | $1 USD | 2 | 5 |
| Premium | $5 USD | Unlimited | Unlimited |

All plans, including unsubscribed accounts, allow unlimited transactions within their categories. Category limits apply to the entire account and never reset monthly. Savings entries do not consume income/expense category slots. The basic dashboard and monthly CSV reports remain available to everyone; Premium also includes a server-protected full-history CSV report. The public comparison page is `/pricing.html`.

Normal is an optional paid plan with the same limits as Free; no additional Free transaction cap is applied. A subscription's expiration, cancellation, or downgrade never deletes categories or transactions. Users above a category limit can keep recording transactions in their existing categories, but cannot create additional categories of that type. Empty categories count, and deleting transactions does not delete their categories.

Frontend limits disable Add Category and display the income/expense-specific limit message with Upgrade to Premium. The API derives ownership from the verified session, and the database checks the subscription and locks the account row before creating a category. The same checks protect category creation through transaction saves, CSV imports, and backup restores. A failed batch rolls back all newly-created categories and transactions. Category names are case-insensitive within each type; income and expense categories are separate.

## Run locally

Use Node.js 22 or later:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5500`. The server builds and serves only `dist/`; secrets and server files are never part of the public output. Restart it after code changes. Without service credentials the local demo remains available, and billing buttons are disabled. The demo mirrors Free's category limits. Existing local arrays are migrated to a ledger containing both transactions and persistent categories on the next save, preserving all existing data. Local-only storage is editable by its device owner; server enforcement applies to signed-in accounts.

## Configure accounts

1. Create a Supabase project and run `supabase/migrations/001_accounts_and_billing.sql`, then `supabase/migrations/002_category_limits.sql` in its SQL Editor once, in that order. **For an existing installation, run only the new `002_category_limits.sql`.** It preserves existing ledgers, backfills their categories (including those above the new limits), replaces transaction-count restrictions, and adds billing details. Apply it before deploying the updated app/API. After upgrading, replay the latest Stripe subscription event to populate billing details for existing subscriptions, or wait for the next subscription update.
2. Enable email sign-in. Configure the Site URL and allowed redirect URLs to include your production origin and `http://127.0.0.1:5500/` for local testing. Use a production SMTP provider before inviting real users.
3. Copy `.env.example` to `.env.local`. Fill in `SUPABASE_URL`, the public `SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY`.
4. Set `APP_URL` to your app origin. The local server loads `.env.local`; Vercel needs the same values in its environment settings.

Sign-in links use PKCE and should be opened in the browser that requested them. The server verifies access tokens with Supabase `getUser()` and derives the account ID from the verified user, never from the request body. Database tables and RPC functions are inaccessible to browser roles; only the server service role can access them.

New signed-in accounts start empty. Local browser entries are never automatically attached to an email account. To migrate them, export a monthly CSV from the local demo, sign in, and import it within your plan's category limits. Cloud data is held in memory, never saved to the shared guest ledger or service-worker cache. Signing out clears it from the page. Account changes in another tab also clear the previous account's view.

## Configure Stripe

Start in Stripe test mode:

1. Create two products with recurring, fixed USD prices: **Normal, $1 monthly** and **Premium, $5 monthly**. Set the corresponding `price_...` IDs in `STRIPE_NORMAL_PRICE_ID` and `STRIPE_PREMIUM_PRICE_ID`.
2. Set `STRIPE_SECRET_KEY` to the secret key for that same Stripe environment. The server verifies that the selected price is active, USD, monthly, and exactly $1 or $5 before opening Checkout.
3. Enable the Stripe customer portal with payment-method updates, cancellation, and switching between **only these two products/prices**. For paid upgrades, configure immediate invoicing; schedule downgrades for the end of the current period if desired. The app's Manage subscription button opens this portal.
4. Add a webhook endpoint at `https://YOUR_DOMAIN/api/stripe/webhook`, listening for `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`. Copy its signing secret to `STRIPE_WEBHOOK_SECRET`.
5. For local webhook testing, use the Stripe CLI:

```sh
stripe listen --events customer.subscription.created,customer.subscription.updated,customer.subscription.deleted --forward-to http://127.0.0.1:5500/api/stripe/webhook
```

Use the CLI's signing secret in `.env.local` while forwarding locally. Restart the local server after changing environment variables.

Paid-plan access is granted only for a recognized price on an `active` subscription whose billing period has not expired. Pending, past-due, canceled, unknown-price, and expired subscriptions use Free's category limits and retain all their data. A Checkout return URL cannot grant access. Verified webhooks retrieve current Stripe subscription state, map its customer to the stored account, and update the database; duplicate/older events cannot overwrite newer subscription records. Do not disable webhook delivery: renewal needs to extend the recorded period end. Account settings show the effective plan, subscription status, renewal/access-end date, and recorded recurring plan amount; actual invoices are available in the Stripe portal.

An existing subscription must be changed through the portal instead of creating a second subscription. Repeated checkout requests share an idempotency key and a one-hour database reservation. If a checkout for one plan is already open, complete it or let it expire before choosing the other plan.

## Deploy and verify payments

Vercel is configured to build the static app and route `/api/*` to the Node API. Add all environment values, apply the Supabase migration, configure redirects and the webhook, then deploy. Use separate test and live Stripe prices, keys, and webhook secrets. Keep `.env.local` out of source control.

Before enabling live billing, test both subscriptions through the app with Stripe test payment details, payment failure, renewal, upgrade/downgrade, and cancellation. Confirm the webhook returns 200 and Refresh status shows the correct plan. These external checks require your configured Stripe and Supabase projects; local tests do not create customers, subscriptions, emails, or charges.

## Verification

```sh
npm run check
npm test
npm run build
npm run test:browser
```

Database tests execute the migration in an in-memory PostgreSQL runtime (PGlite). They check quotas, batch imports, stale writes, cancellation, downgrade, customer ownership, checkout reservations, and browser-role restrictions. API tests check verified identities, signature verification, price mapping, and validation. Browser tests use installed Google Chrome in headless mode with mocked account services.

Cloud writes use revision checks to prevent one session overwriting another; a conflict refreshes the ledger and asks the user to retry while preserving an open transaction form. Same-browser updates notify other tabs; visible sessions also refresh every 30 seconds and when coming back online or into focus. Cloud writes require a connection and never silently fall back to guest storage. The current storage model sends the ledger as one document, with a 4 MB request safety limit; very large ledgers will need paginated transaction storage.

Implementation references: [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [Stripe signature verification](https://docs.stripe.com/webhooks/signature), [Stripe customer portal](https://docs.stripe.com/customer-management/integrate-customer-portal), [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser), and [Vercel Node request bodies](https://vercel.com/docs/functions/runtimes/node-js#request-body).
