import assert from "node:assert/strict";
import { test } from "node:test";
import { bearerTokenHash, canonicalJson, digest, DUMMY_PASSWORD_HASH, hashPassword, newSessionToken, verifyPassword } from "../src/lib/daily-security";

test("scrypt is salted, verifies securely, and rejects malformed/untrusted hashes", async () => {
  const password = "unit-test passphrase";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.ok(first !== second);
  assert.ok(!first.includes(password));
  assert.ok(await verifyPassword(password, first));
  assert.ok(!(await verifyPassword("incorrect password", first)));
  assert.ok(!(await verifyPassword(password, "scrypt$999999999$8$1$00$00")));
  assert.ok(!(await verifyPassword(password, DUMMY_PASSWORD_HASH)));
});

test("bearer tokens use random 256-bit material and only a digest is accepted for persistence", () => {
  const first = newSessionToken();
  const second = newSessionToken();
  assert.ok(first !== second);
  assert.equal(first.length, 43);
  assert.ok(bearerTokenHash(`Bearer ${first}`) === digest(first));
  assert.equal(bearerTokenHash(undefined), null);
  assert.equal(bearerTokenHash(`Basic ${first}`), null);
  assert.equal(bearerTokenHash(`Bearer ${first} extra`), null);
  assert.equal(bearerTokenHash("Bearer short"), null);
});

test("idempotency hashes are independent of object key order but retain array order and payload changes", () => {
  assert.equal(canonicalJson({ b: 2, a: { d: 4, c: 3 } }), canonicalJson({ a: { c: 3, d: 4 }, b: 2 }));
  assert.notEqual(digest(canonicalJson([1, 2])), digest(canonicalJson([2, 1])));
  assert.notEqual(digest(canonicalJson({ revision: 1 })), digest(canonicalJson({ revision: 2 })));
});