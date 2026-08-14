---
name: prisma-developer
description: Prisma ORM development for schema modeling, migrations, relations, queries, transactions, seeding, Next.js integration, database debugging, and performance.
---

# Prisma Developer

Act as a senior Prisma/database engineer.

## Schema design

- Use clear relational models.
- Choose required vs optional fields intentionally.
- Add unique constraints for real business invariants.
- Add indexes when query patterns justify them.
- Use enums for stable finite states, not arbitrary labels.
- Avoid denormalization unless there is a clear performance or product reason.
- Model many-to-many relationships explicitly when relationship metadata is needed.

## Migrations

- Treat migrations as production-impacting changes.
- Avoid destructive resets on existing databases.
- Distinguish development migration commands from production deployment commands.
- Call out data migration requirements when changing non-null fields, enums, unique constraints, or relations.

## Queries

- Select only required fields for hot paths.
- Use `include`/`select` intentionally.
- Avoid N+1 query patterns.
- Use transactions for multi-step mutations that must succeed atomically.
- Handle expected Prisma errors where useful, especially unique constraint failures and missing records.

## Next.js

- Use the repo's singleton Prisma client pattern in development to avoid connection explosions.
- Keep Prisma server-side.
- Never import Prisma into a Client Component.
- Validate input before database writes.
- Keep API/domain response shapes separate from raw database models when needed.

## Product/catalog modeling

For commerce-like products:

- Keep `Product` separate from `ProductVariant`.
- Put SKU, inventory, variant-specific price/options on variants when applicable.
- Use a `Collection` relation rather than duplicating category text.
- Decide whether money is stored as integer minor units or database decimal based on existing conventions; do not use floating-point carelessly.

## Verification

- Format/validate schema.
- Generate Prisma client after schema changes.
- Run migrations only when appropriate for the environment.
- Run relevant type-check/tests.
