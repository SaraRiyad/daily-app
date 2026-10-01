import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { pool } from "@workspace/db";
import { RegisterDailyAccountResponse, SaveDailyWorkspaceResponse, type ApiFailure } from "@workspace/api-zod";
import { digest } from "../src/lib/daily-security";

// The parent starts the managed server. This test never starts an app or bypasses
// the shared reverse proxy.
const base = "http://localhost:80/api";

test("Daily HTTP contract against the already-running managed API", async () => {
  assert.equal(process.env.DAILY_DB_TEST, "1");
  assert.notEqual(process.env.NODE_ENV, "production");
  const email = `daily-http-${randomUUID()}@daily-test.invalid`;
  const password = `http-${randomUUID()}`;
  let ownerId: string | undefined;
  try {
    const anonymous = await fetch(`${base}/workspace`);
    assert.equal(anonymous.status, 401);
    assert.equal(typeof ((await anonymous.json()) as ApiFailure).error, "string");
    const malformed = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    assert.equal(malformed.status, 400);
    const response = await fetch(`${base}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.toUpperCase(), password, name: "HTTP integration" }),
    });
    assert.equal(response.status, 201);
    const auth = RegisterDailyAccountResponse.parse(await response.json());
    ownerId = auth.account.id;
    assert.equal(auth.account.email, email);
    assert.equal(auth.snapshot.revision, 0);
    assert.deepEqual(auth.snapshot.workspace.jobs, []);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` };
    const me = await fetch(`${base}/auth/me`, { headers });
    assert.equal(me.status, 200);
    assert.deepEqual(await me.json(), auth.account);
    const workspace = { ...auth.snapshot.workspace, name: "Saved HTTP workspace", entered: false };
    const body = JSON.stringify({ workspace, revision: 0, mutationId: "http-save-original-001" });
    const saved = await fetch(`${base}/workspace`, { method: "PUT", headers, body });
    assert.equal(saved.status, 200);
    const snapshot = SaveDailyWorkspaceResponse.parse(await saved.json());
    assert.equal(snapshot.workspace.entered, true);
    assert.equal(snapshot.revision, 1);
    const retry = await fetch(`${base}/workspace`, { method: "PUT", headers, body });
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), snapshot);
    const stale = await fetch(`${base}/workspace`, {
      method: "PUT", headers, body: JSON.stringify({ workspace, revision: 0, mutationId: "http-save-stale-001" }),
    });
    assert.equal(stale.status, 409);
    const ownership = await fetch(`${base}/workspace`, {
      method: "PUT", headers, body: JSON.stringify({ workspace, revision: 1, mutationId: "http-save-owner-001", ownerId: "another-owner" }),
    });
    assert.equal(ownership.status, 400);
    const logout = await fetch(`${base}/auth/logout`, { method: "POST", headers });
    assert.equal(logout.status, 204);
    assert.equal((await fetch(`${base}/auth/me`, { headers })).status, 401);
  } finally {
    if (ownerId) await pool.query("DELETE FROM daily_rate_limits WHERE key = $1", [`workspace:${ownerId}`]);
    await pool.query("DELETE FROM daily_rate_limits WHERE key = $1", [`auth-account:${digest(email)}`]);
    await pool.query("DELETE FROM daily_users WHERE email = $1", [email]);
    await pool.end();
  }
});