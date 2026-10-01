import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { pool } from "@workspace/db";
import { emptyStore, seed } from "@workspace/daily-model";
import { DailyError } from "../src/lib/daily-errors";
import { DailyRepository } from "../src/lib/daily-repository";
import { digest } from "../src/lib/daily-security";
import { validateWorkspaceInput } from "../src/lib/daily-validation";

test("Daily PostgreSQL account, all-workspace, concurrency, idempotency and throttle integration", async t => {
  assert.equal(process.env.DAILY_DB_TEST, "1", "Explicit development integration test flag required.");
  assert.notEqual(process.env.NODE_ENV, "production", "Never run fixtures in production.");
  const namespace = randomUUID();
  const emailA = `daily-${namespace}-a@daily-test.invalid`;
  const emailB = `daily-${namespace}-b@daily-test.invalid`;
  const password = `integration-${randomUUID()}`;
  const repository = new DailyRepository(pool);
  const secondInstance = new DailyRepository(pool);
  const owners: string[] = [];
  const limitKeys: string[] = [];
  try {
    const a = await repository.register(emailA, password, "Integration A");
    const b = await repository.register(emailB, password, "Integration B");
    owners.push(a.account.id, b.account.id);
    const authA = await repository.authenticate(digest(a.token));
    const authB = await repository.authenticate(digest(b.token));

    await t.test("new accounts are empty; passwords are scrypt hashes and bearer secrets are never stored", async () => {
      assert.deepEqual(a.snapshot.workspace, emptyStore("Integration A"));
      assert.equal(a.snapshot.revision, 0);
      const users = await pool.query("SELECT password_hash FROM daily_users WHERE id = $1", [a.account.id]);
      assert.ok(users.rows[0].password_hash.startsWith("scrypt$"));
      assert.ok(users.rows[0].password_hash !== password);
      const sessions = await pool.query("SELECT token_hash, expires_at FROM daily_sessions WHERE owner_id = $1", [a.account.id]);
      assert.ok(sessions.rows[0].token_hash === digest(a.token));
      assert.ok(sessions.rows[0].token_hash !== a.token);
      assert.ok(sessions.rows[0].expires_at > new Date());
      assert.equal(Object.keys(a.account).sort().join(","), "createdAt,email,id");
    });

    await t.test("database login, duplicates and invalid passwords use correct failures", async () => {
      const login = await secondInstance.login(emailA, password);
      assert.equal(login.account.id, a.account.id);
      await assert.rejects(repository.login(emailA, "incorrect password"), (error: unknown) => error instanceof DailyError && error.status === 401);
      await assert.rejects(repository.login(`missing-${namespace}@daily-test.invalid`, password), (error: unknown) => error instanceof DailyError && error.status === 401);
      await assert.rejects(repository.register(emailA, password, "Duplicate"), (error: unknown) => error instanceof DailyError && error.status === 409);
    });

    let complete = seed();
    complete.name = "Real integration workspace";
    complete.preferences = { theme: "Dark", hideHomeBalance: true, avatarColor: "Stone" };
    complete.active = { jobId: complete.selectedJob, start: Date.now() - 3600000, normal: 5, overtime: 7 };
    complete = validateWorkspaceInput({ workspace: complete, revision: 0, mutationId: "import-original-001" }).workspace;
    const original = await repository.saveWorkspace(authA, { workspace: complete, revision: 0, mutationId: "import-original-001" });
    await t.test("all records, active shifts and settings persist across repository instances without account bleed", async () => {
      assert.deepEqual((await secondInstance.getWorkspace(a.account.id)).workspace, complete);
      assert.deepEqual((await repository.getWorkspace(b.account.id)).workspace, b.snapshot.workspace);
      assert.equal(original.revision, 1);
      const committed = await pool.query("SELECT count(*)::integer AS count FROM daily_mutations WHERE owner_id = $1", [a.account.id]);
      assert.equal(committed.rows[0].count, 1);
    });

    await t.test("concurrent compare-and-swap yields exactly one commit and one 409", async () => {
      const results = await Promise.allSettled([
        repository.saveWorkspace(authA, { workspace: { ...complete, name: "Concurrent first" }, revision: 1, mutationId: "concurrent-first" }),
        secondInstance.saveWorkspace(authA, { workspace: { ...complete, name: "Concurrent second" }, revision: 1, mutationId: "concurrent-second" }),
      ]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
      const rejection = results.find(result => result.status === "rejected") as PromiseRejectedResult;
      assert.ok(rejection.reason instanceof DailyError && rejection.reason.status === 409);
      assert.equal((await repository.getWorkspace(a.account.id)).revision, 2);
      const committed = await pool.query("SELECT count(*)::integer AS count FROM daily_mutations WHERE owner_id = $1", [a.account.id]);
      assert.equal(committed.rows[0].count, 2);
    });

    await t.test("uncertain-network retry returns the exact ORIGINAL commit before checking now-stale revision", async () => {
      const replay = await secondInstance.saveWorkspace(authA, { workspace: complete, revision: 0, mutationId: "import-original-001" });
      assert.deepEqual(replay, original);
      assert.equal((await repository.getWorkspace(a.account.id)).revision, 2);
      await assert.rejects(
        repository.saveWorkspace(authA, { workspace: { ...complete, name: "Different payload" }, revision: 0, mutationId: "import-original-001" }),
        (error: unknown) => error instanceof DailyError && error.status === 409,
      );
    });

    await t.test("same mutation ID is isolated by owner, and concurrent identical retries commit once", async () => {
      const input = { workspace: emptyStore("Integration B changed"), revision: 0, mutationId: "import-original-001" };
      const [first, retry] = await Promise.all([repository.saveWorkspace(authB, input), secondInstance.saveWorkspace(authB, input)]);
      assert.deepEqual(first, retry);
      assert.equal(first.revision, 1);
      assert.equal((await repository.getWorkspace(a.account.id)).revision, 2);
    });

    await t.test("revoked and expired sessions are rejected, including already-authenticated write attempts", async () => {
      await repository.logout(authB);
      await assert.rejects(repository.authenticate(digest(b.token)), (error: unknown) => error instanceof DailyError && error.status === 401);
      await assert.rejects(repository.saveWorkspace(authB, { workspace: emptyStore("Revoked write"), revision: 1, mutationId: "revoked-write-001" }), (error: unknown) => error instanceof DailyError && error.status === 401);
      const login = await repository.login(emailB, password);
      await pool.query("UPDATE daily_sessions SET expires_at = statement_timestamp() - interval '1 second' WHERE token_hash = $1", [digest(login.token)]);
      await assert.rejects(repository.authenticate(digest(login.token)), (error: unknown) => error instanceof DailyError && error.status === 401);
      assert.equal((await repository.getWorkspace(b.account.id)).revision, 1);
    });

    await t.test("auth limits persist across instances and concurrent attempts, without storing raw addresses/emails", async () => {
      const network = `integration-network-${namespace}`;
      const account = `throttle-${namespace}@daily-test.invalid`;
      limitKeys.push(`auth-network:${digest(network)}`, `auth-account:${digest(account)}`);
      const results = await Promise.allSettled(Array.from({ length: 11 }, (_, i) => (i % 2 ? repository : secondInstance).throttleAuthentication(network, account)));
      assert.equal(results.filter(result => result.status === "fulfilled").length, 10);
      const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
      assert.ok(rejected.reason instanceof DailyError && rejected.reason.status === 429 && (rejected.reason.retryAfter ?? 0) > 0);
      await assert.rejects(secondInstance.throttleAuthentication(network, account), (error: unknown) => error instanceof DailyError && error.status === 429);
      const rows = await pool.query("SELECT key FROM daily_rate_limits WHERE key = ANY($1::text[])", [limitKeys]);
      assert.equal(rows.rows.length, 2);
      assert.ok(rows.rows.every(row => !row.key.includes(account) && !row.key.includes(network)));
      await pool.query("UPDATE daily_rate_limits SET expires_at = statement_timestamp() - interval '1 second' WHERE key = ANY($1::text[])", [limitKeys]);
      await repository.throttleAuthentication(network, account);
    });

    await t.test("network limit rejects distributed account guesses before creating extra account keys", async () => {
      const network = `blocked-network-${namespace}`;
      const account = `blocked-account-${namespace}@daily-test.invalid`;
      const networkKey = `auth-network:${digest(network)}`;
      const accountKey = `auth-account:${digest(account)}`;
      limitKeys.push(networkKey, accountKey);
      await pool.query(
        `INSERT INTO daily_rate_limits (key, window_start, attempts, expires_at)
         VALUES ($1, statement_timestamp(), 120, statement_timestamp() + interval '15 minutes')`, [networkKey],
      );
      await assert.rejects(secondInstance.throttleAuthentication(network, account), (error: unknown) => error instanceof DailyError && error.status === 429);
      const rows = await pool.query("SELECT key FROM daily_rate_limits WHERE key = $1", [accountKey]);
      assert.equal(rows.rows.length, 0);
    });

    await t.test("workspace throttling is persistent and never blocks a committed idempotent replay", async () => {
      await pool.query(
        "UPDATE daily_rate_limits SET attempts = 120, expires_at = statement_timestamp() + interval '60 seconds' WHERE key = $1",
        [`workspace:${a.account.id}`],
      );
      const current = await repository.getWorkspace(a.account.id);
      await assert.rejects(
        secondInstance.saveWorkspace(authA, { workspace: current.workspace, revision: current.revision, mutationId: "throttled-save-001" }),
        (error: unknown) => error instanceof DailyError && error.status === 429 && (error.retryAfter ?? 0) > 0,
      );
      assert.deepEqual(await repository.getWorkspace(a.account.id), current);
      const replay = await secondInstance.saveWorkspace(authA, { workspace: complete, revision: 0, mutationId: "import-original-001" });
      assert.deepEqual(replay, original);
      await pool.query("UPDATE daily_rate_limits SET expires_at = statement_timestamp() - interval '1 second' WHERE key = $1", [`workspace:${a.account.id}`]);
      const resumed = await repository.saveWorkspace(authA, { workspace: current.workspace, revision: current.revision, mutationId: "throttled-save-001" });
      assert.equal(resumed.revision, current.revision + 1);
    });
  } finally {
    await pool.query("DELETE FROM daily_rate_limits WHERE key = ANY($1::text[])", [[...limitKeys, ...owners.map(owner => `workspace:${owner}`)]]);
    // Only remove this test run's explicit fixtures; owner FKs cascade.
    await pool.query("DELETE FROM daily_users WHERE email = ANY($1::text[])", [[emailA, emailB]]);
    await pool.end();
  }
});