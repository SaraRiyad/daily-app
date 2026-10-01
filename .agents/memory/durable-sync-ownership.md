---
name: Durable sync ownership
description: Cross-tab storage ownership and uncertain-versus-rejected save recovery.
---

Keep exclusive ownership of an account's durable client outbox; do not replace browser Web Locks with a localStorage read/check/write lock.

**Why:** Server revision checks only protect uploaded changes. A clean tab's background refresh can overwrite another tab's offline outbox in shared browser storage before any request reaches the server. In-process promise serialization does not protect separate tabs.

**How to apply:** Any change to session activation, cache hydration, logout or background refresh must preserve exclusive writer ownership until queued storage writes finish. Unsupported locking must fail visibly rather than permitting competing writers.

Treat uncertain network outcomes differently from definitive request rejection.

**Why:** Reusing the exact mutation ID and payload avoids duplicate writes after response loss. But retaining an invalid request forever after a definite 400/413 prevents even a corrected draft from saving.

**How to apply:** Keep uncertain requests immutable. Replace definitively rejected requests only through explicit recovery that backs up the original and latest draft first; never silently discard either.