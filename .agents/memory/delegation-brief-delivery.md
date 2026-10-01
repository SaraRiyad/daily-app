---
name: Delegation brief delivery
description: Workaround for pre-dispatch parsing failures with large inline delegation calls.
---

If a large inline subagent call fails with "unexpected end of string" before returning a job ID, put the task in a workspace brief file and dispatch a short instruction referencing it through relevantFiles.

**Why:** Repeated large inline calls failed before dispatch in this environment, while the equivalent short call pointing to a brief file succeeded. The precise parser limit or cause was not established.

**How to apply:** Use only for pre-dispatch failures. If a job ID exists, continue or wait for that job rather than starting a duplicate.