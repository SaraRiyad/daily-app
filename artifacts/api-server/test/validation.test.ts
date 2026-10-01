import assert from "node:assert/strict";
import { test } from "node:test";
import { dayKey, emptyStore, jobSchema, seed, sessionSchema, storeSchema, taskSchema, transactionSchema, type Store } from "@workspace/daily-model";
import { DailyError } from "../src/lib/daily-errors";
import { credentialsSchema, registrationSchema, validateWorkspaceInput } from "../src/lib/daily-validation";

const input = (workspace: Store) => ({ workspace, revision: 0, mutationId: "test-mutation-001" });
const invalid = (workspace: Store) => assert.throws(() => validateWorkspaceInput(input(workspace)), (error: unknown) => error instanceof DailyError && error.status === 400);

test("empty authenticated stores contain no demo records and retain original model exports", () => {
  const workspace = emptyStore(" New Person ");
  assert.equal(workspace.name, "New Person");
  assert.equal(workspace.entered, true);
  assert.deepEqual(workspace.preferences, { theme: "Light", hideHomeBalance: false, avatarColor: "Coral" });
  assert.deepEqual([workspace.jobs, workspace.tasks, workspace.transactions, workspace.sessions, workspace.days], [[], [], [], [], []]);
  assert.equal(workspace.selectedJob, "");
  assert.equal(workspace.active, null);
  assert.ok(storeSchema.safeParse(seed()).success);
});

test("account input normalizes email/name, rejects blanks, and never accepts client ownership fields", () => {
  const parsed = registrationSchema.parse({ email: " USER@Example.com ", name: " Person ", password: "test-password" });
  assert.equal(parsed.email, "user@example.com");
  assert.equal(parsed.name, "Person");
  assert.ok(!registrationSchema.safeParse({ email: "user@example.com", name: "   ", password: "test-password" }).success);
  assert.ok(!credentialsSchema.safeParse({ email: "not-an-email", password: "test-password" }).success);
  assert.ok(!credentialsSchema.safeParse({ email: "user@example.com", password: "short" }).success);
  assert.ok(!credentialsSchema.safeParse({ email: "user@example.com", password: "test-password", ownerId: "other" }).success);
});

test("valid workspace imports preserve IDs, rates, records, and active shifts; entered is normalized", () => {
  const workspace = seed();
  workspace.active = { jobId: workspace.selectedJob, start: Date.now(), normal: 5, overtime: 7 };
  const parsed = validateWorkspaceInput(input(workspace));
  assert.deepEqual(parsed.workspace, { ...workspace, entered: true });
  assert.equal(parsed.revision, 0);
});

test("references, selected job, active selection and duplicate identities are rejected", () => {
  const workspace = seed();
  invalid({ ...workspace, selectedJob: "missing-job" });
  invalid({ ...workspace, active: { jobId: "freelance", start: Date.now(), normal: 8, overtime: 10 } });
  invalid({ ...workspace, sessions: [{ ...workspace.sessions[0]!, jobId: "missing-job" }] });
  invalid({ ...workspace, jobs: [workspace.jobs[0]!, workspace.jobs[0]!] });
  invalid({ ...workspace, tasks: [workspace.tasks[0]!, workspace.tasks[0]!] });
  invalid({ ...workspace, transactions: [workspace.transactions[0]!, workspace.transactions[0]!] });
  invalid({ ...workspace, sessions: [workspace.sessions[0]!, workspace.sessions[0]!] });
  invalid({ ...workspace, days: [workspace.days[0]!, workspace.days[0]!] });
});

test("calendar dates, finite amounts, rates, timestamp order, spans and record bounds are checked", () => {
  const workspace = seed();
  invalid({ ...workspace, tasks: [{ ...workspace.tasks[0]!, due: "2025-02-30" }] });
  invalid({ ...workspace, transactions: [{ ...workspace.transactions[0]!, amount: 0 }] });
  invalid({ ...workspace, transactions: [{ ...workspace.transactions[0]!, amount: Infinity }] });
  invalid({ ...workspace, jobs: [{ ...workspace.jobs[0]!, overtime: 1 }] });
  invalid({ ...workspace, sessions: [{ ...workspace.sessions[0]!, end: 0 }] });
  invalid({ ...workspace, sessions: [{ ...workspace.sessions[0]!, start: 0, end: 367 * 86400000 }] });
  invalid({ ...workspace, sessions: [{ ...workspace.sessions[0]!, overtime: 1 }] });
  invalid({ ...workspace, tasks: Array.from({ length: 10001 }, (_, i) => ({ ...workspace.tasks[0]!, id: `task-${i}` })) });
  assert.throws(() => validateWorkspaceInput({ ...input(workspace), revision: -1 }));
  assert.throws(() => validateWorkspaceInput({ ...input(workspace), mutationId: "bad id" }));
  assert.throws(() => validateWorkspaceInput({ ...input(workspace), ownerId: "someone-else" }));
});

test("shared model accepts advertised collection caps and rejects cap-plus-one before central updates", () => {
  const base = seed();
  const jobs = Array.from({ length: 100 }, (_, i) => ({ ...base.jobs[0]!, id: `job-${i}` }));
  const jobWorkspace = { ...emptyStore("Limits"), jobs, selectedJob: jobs[0]!.id };
  assert.ok(storeSchema.safeParse(jobWorkspace).success);
  assert.ok(!storeSchema.safeParse({ ...jobWorkspace, jobs: [...jobs, { ...jobs[0]!, id: "job-extra" }] }).success);
  const collections = {
    tasks: Array.from({ length: 10000 }, (_, i) => ({ ...base.tasks[0]!, id: `task-${i}` })),
    transactions: Array.from({ length: 10000 }, (_, i) => ({ ...base.transactions[0]!, id: `transaction-${i}` })),
    sessions: Array.from({ length: 10000 }, (_, i) => ({ ...base.sessions[0]!, id: `session-${i}`, jobId: jobs[0]!.id })),
    days: Array.from({ length: 10000 }, (_, i) => ({ jobId: jobs[0]!.id, date: dayKey(new Date(2020, 0, i + 1)), status: "Work" as const })),
  };
  for (const [key, records] of Object.entries(collections)) {
    assert.ok(storeSchema.safeParse({ ...jobWorkspace, [key]: records }).success, `${key} at published cap`);
    // Identity/reference checks are tested separately; this case must expose the
    // array bound specifically, not merely fail because of the appended duplicate.
    const rejected = storeSchema.safeParse({ ...jobWorkspace, [key]: [...records, records[0]] });
    assert.ok(!rejected.success);
    if (!rejected.success) assert.ok(rejected.error.issues.some(issue => issue.code === "too_big" && issue.path[0] === key));
  }
});

test("shared IDs, categories, timestamps and shift rates match published/API bounds", () => {
  const base = seed();
  const maxId = "i".repeat(128);
  assert.ok(jobSchema.safeParse({ ...base.jobs[0]!, id: maxId }).success);
  assert.ok(!jobSchema.safeParse({ ...base.jobs[0]!, id: `${maxId}i` }).success);
  assert.ok(!taskSchema.safeParse({ ...base.tasks[0]!, id: `${maxId}i` }).success);
  assert.ok(transactionSchema.safeParse({ ...base.transactions[0]!, category: "c".repeat(80) }).success);
  assert.ok(!transactionSchema.safeParse({ ...base.transactions[0]!, category: "c".repeat(81) }).success);
  assert.ok(sessionSchema.safeParse({ ...base.sessions[0]!, start: 7258118400000, end: 7258118400000 }).success);
  assert.ok(!sessionSchema.safeParse({ ...base.sessions[0]!, end: 7258118400001 }).success);
  assert.ok(!sessionSchema.safeParse({ ...base.sessions[0]!, overtime: 1 }).success);
  assert.ok(!storeSchema.safeParse({ ...base, active: { jobId: base.selectedJob, start: Date.now(), normal: 5, overtime: 1 } }).success);
  // Do not add an unadvertised legacy span constraint to the shared schema.
  // The server's existing import policy remains unchanged.
  assert.ok(sessionSchema.safeParse({ ...base.sessions[0]!, start: 0, end: 367 * 86400000 }).success);
  const withoutPreferences = { ...base } as Partial<Store>;
  delete withoutPreferences.preferences;
  assert.deepEqual(storeSchema.parse(withoutPreferences).preferences, { theme: "Light", hideHomeBalance: false, avatarColor: "Coral" });
});

test("collection and string caps do not promise that a valid workspace fits the HTTP byte limit", () => {
  const workspace = {
    ...emptyStore("Size audit"),
    transactions: Array.from({ length: 10000 }, (_, i) => ({
      id: `transaction-${i}`.padEnd(128, "i"), kind: "income" as const, title: "t".repeat(120),
      amount: 1e12, category: "c".repeat(80), date: "2025-01-01", note: "n".repeat(500),
    })),
  };
  assert.ok(storeSchema.safeParse(workspace).success);
  const bytes = Buffer.byteLength(JSON.stringify(input(workspace)), "utf8");
  assert.ok(bytes > 8 * 1024 * 1024, "A valid single collection can exceed even the current 8 MiB server body cap");
});