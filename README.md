# Monea

Personal finance tracker with a local demo, email sign-in, account-scoped cloud storage, loan payment status, and Stripe subscriptions.

| Plan | Monthly price | Income entries | Expense entries |
| --- | --- | --- | --- |
| Normal | $1 USD | 5 per calendar month | 5 per calendar month |
| Premium | $5 USD | Unlimited | Unlimited |

Savings entries are unlimited on both active plans. Limits use each entry's transaction month, not the subscription renewal date. CSV imports and backup restores go through the same database checks as manual entries. Deleting entries frees space in that month. After a downgrade, existing entries above the limit are retained; counts above five cannot increase. After expiration or cancellation, users can still view, export, delete, or mark existing loans paid, but adding entries requires an active subscription.

## Run locally

Use Node.js 22 or later:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5500`. The server builds and serves only `dist/`; secrets and server files are never part of the public output. Restart it after code changes. Without service credentials the local demo remains available, and billing buttons are disabled. The demo has Normal's entry limits; pre-existing sample/history data is retained even if already above five.

## Configure accounts

1. Create a Supabase project and run `supabase/migrations/001_accounts_and_billing.sql` in its SQL Editor once.
2. Enable email sign-in. Configure the Site URL and allowed redirect URLs to include your production origin and `http://127.0.0.1:5500/` for local testing. Use a production SMTP provider before inviting real users.
3. Copy `.env.example` to `.env.local`. Fill in `SUPABASE_URL`, the public `SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY`.
4. Set `APP_URL` to your app origin. The local server loads `.env.local`; Vercel needs the same values in its environment settings.

Sign-in links use PKCE and should be opened in the browser that requested them. The server verifies access tokens with Supabase `getUser()` and derives the account ID from the verified user, never from the request body. Database tables and RPC functions are inaccessible to browser roles; only the server service role can access them.

New signed-in accounts start empty. Local browser entries are never automatically attached to an email account. To migrate them, export a monthly CSV from the local demo, sign in, subscribe, and import it. Cloud data is held in memory, never saved to the shared guest ledger or service-worker cache. Signing out clears it from the page. Account changes in another tab also clear the previous account's view.

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

Access is granted only for a recognized price on an `active` subscription whose billing period has not expired. Pending, past-due, canceled, unknown-price, and expired subscriptions do not grant entry creation. A Checkout return URL cannot grant access. Verified webhooks retrieve current Stripe subscription state, map its customer to the stored account, and update the database; duplicate/older events cannot overwrite newer subscription records. Do not disable webhook delivery: renewal needs to extend the recorded period end.

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
