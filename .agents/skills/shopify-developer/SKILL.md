---
name: shopify-developer
description: Shopify theme and Liquid development for custom sections, snippets, product forms, collections, carts, Theme Editor settings, responsive UI, and theme debugging.
---

# Shopify Developer

Act as a senior Shopify theme developer.

## Core rules

- Use valid Shopify Liquid and JSON schema.
- Follow the existing theme architecture and naming conventions.
- Prefer native Shopify functionality before custom workarounds.
- Scope CSS and JavaScript to the section/component.
- Avoid modifying global theme behavior unless explicitly required.
- Keep Theme Editor compatibility.
- Make merchant-editable content configurable with section settings and blocks.
- Use blocks for repeatable content.
- Keep desktop and mobile behavior intentional.
- Use Shopify image filters such as `image_url` and `image_tag`.
- Use `routes`, product/variant objects, and Shopify-provided URLs rather than hardcoding where possible.
- Never hardcode variant IDs or product IDs when they can come from Liquid objects/settings.

## Sections

For custom sections:

1. Build semantic Liquid markup.
2. Add section-scoped CSS using `#shopify-section-{{ section.id }}` or equivalent scoping.
3. Add JavaScript only when necessary.
4. Add a valid `{% schema %}`.
5. Give settings clear labels and sensible defaults.
6. Use blocks when multiple cards/slides/items are expected.
7. Include a useful preset when appropriate.

## Product and cart behavior

- Submit valid variant IDs to `/cart/add`.
- Respect variant availability.
- Use `selected_or_first_available_variant` where appropriate.
- Preserve selling plan/subscription data when the existing theme supports it.
- Do not break product forms, dynamic checkout, quantity rules, or cart drawer integrations.
- For asynchronous cart updates, follow the theme's existing cart events/classes instead of inventing incompatible behavior.

## JavaScript

- Prefer vanilla JS unless the theme already uses a library.
- If Swiper or another library already exists, reuse the installed version.
- Initialize per section so Theme Editor reloads do not create duplicate instances.
- Clean up/reinitialize on Shopify section lifecycle events when necessary.
- Avoid global selectors that can target multiple instances incorrectly.

## Screenshot replication

When recreating a supplied design:

- Match layout, spacing, image ratios, cards, typography hierarchy, and mobile behavior closely.
- Determine whether the first item has a featured layout.
- Make media type configurable when requested, such as image, video, or slider.
- Use blocks so additional items can be added without code changes.
- Do not implement a popup when the requested interaction is inline.

## Schema validation

Check for common Shopify schema issues:

- Unique setting IDs.
- Supported setting types.
- Valid defaults for ranges/selects.
- No duplicate singleton settings that the theme/schema disallows.
- Valid block definitions and presets.
- Proper JSON syntax inside `{% schema %}`.

## Final checks

- Check Liquid syntax.
- Check schema JSON.
- Check section isolation.
- Check desktop and mobile.
- Note any theme-specific integration point that may need adjustment.
