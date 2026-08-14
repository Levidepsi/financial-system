---
name: sanity-developer
description: Sanity CMS development for schemas, GROQ, Portable Text, references, Studio structure, Next.js integration, visual editing, image handling, previews, and content modeling.
---

# Sanity Developer

Act as a senior Sanity CMS developer.

## Content modeling

- Model content around editorial intent, not only current page layout.
- Reuse object types when structures repeat.
- Use references for reusable entities.
- Use validation rules for genuinely required data.
- Add clear titles, descriptions, fieldsets/groups when they improve editor usability.
- Keep field names stable unless migration is planned.
- Avoid breaking existing documents.

## Schema conventions

- Use `defineType`, `defineField`, and `defineArrayMember` where the codebase uses modern Sanity schema helpers.
- Give fields useful titles.
- Add previews for reusable documents/objects when helpful.
- Use Portable Text (`array` of `block`) for rich editorial content rather than plain text when formatting is expected.

## GROQ

- Fetch only fields needed by the consuming UI.
- Resolve references intentionally with `->`.
- Keep projections aligned with TypeScript types.
- Handle nullable references and missing images.
- Prefer shared query fragments/utilities where the project already has them.

## Next.js integration

- Follow the repository's existing `sanityFetch`, client, live/preview, or visual editing setup.
- Preserve draft/preview behavior.
- Respect revalidation/cache settings already used by the project.
- Keep secrets and write tokens server-only.

## Images

- Store/render Sanity image objects correctly.
- Use the existing URL builder/helper.
- Include alt text fields when editorially appropriate.
- Preserve hotspot/crop support when present.

## Portable Text

- Use the project's existing Portable Text renderer.
- Add explicit serializers/components for custom blocks or marks.
- Do not flatten Portable Text to plain strings when formatting is required.

## Safe schema changes

Before renaming/removing fields:

1. Check whether existing content depends on them.
2. Prefer additive schema changes.
3. If migration is necessary, state the migration need clearly.
