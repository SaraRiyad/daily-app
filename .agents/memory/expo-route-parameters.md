---
name: Expo route parameters
description: Why detail views must not use React Navigation reserved parameter names.
---

Do not use `screen` as an application query parameter in Expo Router. Use a neutral discriminator such as `view`.

**Why:** The router treats `screen` as nested-navigation metadata and strips it from serialized query parameters. A detail link using it silently returned to Home without a console error, even though typechecking passed.

**How to apply:** When adding detail routes or debugging buttons that seem to navigate nowhere, audit parameter names in both navigation writers and route readers. Preserve route guards rather than weakening authentication checks to compensate.