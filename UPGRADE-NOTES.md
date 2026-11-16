# Perfi productivity upgrade — review before deployment

This is a source-code update based on the uploaded financial-system project. Keep your original ZIP as a backup.

## Implemented
- Duplicate transaction action with today's date prefilled, using the existing transaction form.
- Visible sync status in the account banner: saving, device saved, account saved, or save failed.
- Editable existing grouped monthly budget limits with remaining amount and approaching-limit indicator. **Limits are browser-local**, not synced to Supabase.
- Recurring schedules for weekly/monthly income and expenses, with due-date list and manual review. **Schedules are browser-local** and do not create transactions automatically. Review and save a prefilled entry, then manually advance its schedule.
- Upcoming due entries appear in the Plan ahead section (no background push notifications).
- CSV import: prompt for missing required column mappings; preview valid/invalid/duplicate counts and five sample rows before import.
- First-use setup guide (manual walkthrough).
- Account migration prompt: after signing in, compares existing device transactions with account entries, shows the count and asks for consent before import. Existing account transactions are retained; device data is not deleted.

## Limitations and next steps
- Schedules and budget preferences use browser localStorage and do not sync between devices. Production sync requires a database migration and new authenticated endpoints.
- The setup guide is informational, not a full step-by-step onboarding wizard.
- CSV import preview is a confirmation dialog, not an editable grid.
- No automated due reminders or automatic posting; payments require manual review.
- Do not deploy without testing with a staging account and backup, especially migration, CSV, and data sync.
- Node dependencies are not installed in the provided environment. `npm test` could not run because @supabase/supabase-js and @electric-sql/pglite are missing. Syntax checks for the modified JavaScript passed. Run `npm ci && npm test && npm run build` locally.
- Your original `.env.local` and `.git` were intentionally excluded. Restore environment variables in Vercel settings, never commit secrets.
