import { z } from 'zod';
import { storeSchema, uid, type Store } from './model';

export const LEGACY_KEY = 'daily-native-workspace-v1';
export const cacheKey = (owner: string) => `daily-account-v1:${owner}`;
export const snapshotSchema = z.object({
  workspace: storeSchema, revision: z.number().int().nonnegative(), updatedAt: z.string(),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
const requestSchema = z.object({ workspace: storeSchema, revision: z.number().int().nonnegative(), mutationId: z.string().min(1) });
export type SaveRequest = z.infer<typeof requestSchema>;
const envelopeSchema = z.object({
  version: z.literal(1), owner: z.string().min(1), server: snapshotSchema,
  draft: storeSchema, dirty: z.boolean(), pending: requestSchema.nullable(),
  conflict: z.boolean(), rejected: z.string().nullable().default(null),
  imported: z.boolean(), importPending: z.boolean().default(false), backupKey: z.string().nullable(),
}).superRefine((value, ctx) => {
  if ((value.pending && (!value.dirty || value.pending.revision !== value.server.revision)) ||
      ((value.conflict || value.rejected) && !value.pending) ||
      (!value.dirty && !value.pending && JSON.stringify(value.draft) !== JSON.stringify(value.server.workspace))) {
    ctx.addIssue({ code: 'custom', message: 'Inconsistent device outbox; preserve it for recovery.' });
  }
});
export type Envelope = z.infer<typeof envelopeSchema>;
export type SyncStatus = 'Saved' | 'Saving' | 'Pending' | 'Error' | 'Conflict';
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
type Dependencies = {
  storage: Storage; save: (request: SaveRequest) => Promise<unknown>; fetch: () => Promise<unknown>;
  changed: () => void; unauthorized: () => void;
};
export function isEmptyWorkspace(s: Store) {
  return !s.jobs.length && !s.tasks.length && !s.transactions.length && !s.sessions.length && !s.days.length && !s.active;
}
export function statusCode(error: unknown): number | undefined {
  return error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : undefined;
}
export function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'data' in error && error.data && typeof error.data === 'object' && 'error' in error.data && typeof error.data.error === 'string') return error.data.error;
  return fallback;
}
export function freshEnvelope(owner: string, value: unknown): Envelope {
  const server = snapshotSchema.parse(value);
  return { version: 1, owner, server, draft: server.workspace, dirty: false, pending: null, conflict: false, rejected: null, imported: false, importPending: false, backupKey: null };
}
export function readEnvelope(owner: string, raw: string): Envelope {
  const value = envelopeSchema.parse(JSON.parse(raw));
  if (value.owner !== owner) throw new Error('This cache belongs to another account.');
  return value;
}
const same = (a: Store, b: Store) => JSON.stringify(a) === JSON.stringify(b);
const conflictMessage = 'Another device changed this workspace. Your unsynced draft is kept here. Export it or reload the server copy with a preserved backup. No automatic overwrite will be attempted.';
const rejectionMessage = (reason: string) => `The server rejected this save: ${reason} Your latest draft is kept. Correct the draft, then choose Resolve rejected save to back up and retry it, or keep a backup and reload the server copy.`;

// One immutable uncertain request, plus the latest draft. Never coalesce or
// change a request after it may have reached the server. Only its acknowledgement
// permits a new mutationId/revision. Storage always precedes networking.
export class DailySync {
  envelope: Envelope;
  error = '';
  saving = false;
  locked = false;
  disposed = false;
  private writes: Promise<void> = Promise.resolve();
  private work: Promise<void> | null = null;
  private refreshing: Promise<void> | null = null;
  private changes = 0;
  private editHolds = 0;

  constructor(envelope: Envelope, private deps: Dependencies) {
    this.envelope = envelope;
    if (envelope.conflict) this.error = conflictMessage;
    else if (envelope.rejected) this.error = rejectionMessage(envelope.rejected);
  }
  get pending() { return this.envelope.dirty || !!this.envelope.pending; }
  get status(): SyncStatus {
    return this.envelope.conflict ? 'Conflict' : this.error ? 'Error' : this.saving ? 'Saving' : this.pending ? 'Pending' : 'Saved';
  }
  private notify() { if (!this.disposed) this.deps.changed(); }
  dispose() { this.disposed = true; this.locked = true; }
  async settledWrites() { await this.writes.catch(() => {}); }
  holdRefresh() {
    this.editHolds++;
    return () => {
      this.editHolds = Math.max(0, this.editHolds - 1);
      if (!this.disposed && !this.editHolds && !this.error) void this.refresh();
    };
  }
  async persist() {
    await this.writeRaw(cacheKey(this.envelope.owner), JSON.stringify(this.envelope));
  }
  private async writeRaw(key: string, text: string) {
    if (this.disposed) throw new Error('The device cache writer is closed.');
    const write = this.writes.catch(() => {}).then(() => this.deps.storage.setItem(key, text));
    this.writes = write;
    await write;
  }
  private storageError() {
    this.error = 'Device storage could not save your latest changes. They remain in memory. Keep Daily open, export a copy, and retry. Nothing was uploaded before a durable outbox was saved.';
    this.notify();
  }
  update(fn: (s: Store) => Store): boolean {
    if (this.locked || this.disposed) return false;
    let draft: Store;
    try { draft = storeSchema.parse({ ...fn(JSON.parse(JSON.stringify(this.envelope.draft)) as Store), entered: true }); }
    catch {
      this.error = 'This edit was not accepted. Daily supports up to 100 jobs and 10,000 tasks, money entries, shifts and calendar entries each; shift dates and rates must be valid. Your previous workspace is unchanged. Review the edit or export a copy before removing records.';
      this.notify();
      return false;
    }
    if (same(draft, this.envelope.draft)) return true;
    this.changes++;
    this.envelope = { ...this.envelope, draft, dirty: true };
    this.notify();
    void this.persist().then(() => {
      if (!this.error && !this.envelope.conflict && !this.disposed) void this.flush();
    }).catch(() => this.storageError());
    return true;
  }
  flush(): Promise<void> {
    if (this.work) return this.work;
    if (this.disposed || this.envelope.conflict || this.envelope.rejected) return Promise.resolve();
    this.work = this.drain().finally(() => { this.work = null; });
    return this.work;
  }
  private async drain() {
    this.saving = true; this.notify();
    try {
      // Also persists acknowledged revisions / changes whose previous local
      // write failed. A retry does not discard them or reload over them.
      await this.persist();
      while (!this.disposed && this.pending && !this.envelope.conflict && !this.envelope.rejected) {
        if (!this.envelope.pending) {
          this.envelope = { ...this.envelope, pending: { workspace: this.envelope.draft, revision: this.envelope.server.revision, mutationId: uid() } };
        }
        await this.persist();
        if (this.disposed) break;
        const request = this.envelope.pending!;
        let server: Snapshot;
        try { server = snapshotSchema.parse(await this.deps.save(request)); }
        catch (error) {
          if (this.disposed) return;
          if (statusCode(error) === 409) {
            this.envelope = { ...this.envelope, conflict: true };
            this.error = conflictMessage;
            try { await this.persist(); } catch { this.storageError(); }
          } else if (statusCode(error) === 400 || statusCode(error) === 413) {
            const reason = errorMessage(error, statusCode(error) === 413 ? 'The workspace exceeded the server request-size limit.' : 'The workspace did not meet the server validation rules.');
            this.envelope = { ...this.envelope, rejected: reason };
            this.error = rejectionMessage(reason);
            try { await this.persist(); } catch { this.storageError(); }
          } else if (statusCode(error) === 401) {
            this.error = 'Your session expired. Sign in to the same account to resume your pending changes.';
            this.locked = true;
            this.deps.unauthorized();
          } else {
            this.error = errorMessage(error, 'The server could not confirm this save. Your device outbox is retained. Retry when connected; the same request will be used safely.');
          }
          return;
        }
        if (this.disposed) return;
        this.envelope = {
          ...this.envelope, server, pending: null,
          imported: this.envelope.imported || this.envelope.importPending,
          importPending: false,
          draft: same(this.envelope.draft, request.workspace) ? server.workspace : this.envelope.draft,
          dirty: !same(this.envelope.draft, request.workspace),
        };
        await this.persist();
      }
      if (!this.disposed) this.error = '';
    } catch { if (!this.disposed) this.storageError(); }
    finally { this.saving = false; this.notify(); }
  }
  async retry() {
    if (this.envelope.conflict || this.envelope.rejected || this.disposed) return;
    // Existing error remains visible until acknowledgement / refresh succeeds.
    if (this.pending) await this.flush();
    else await this.refresh();
  }
  refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    if (this.disposed || this.pending || this.saving || this.locked || this.envelope.conflict || this.envelope.rejected || this.editHolds) return Promise.resolve();
    this.refreshing = this.fetchFresh().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }
  private async fetchFresh() {
    const changes = this.changes;
    try {
      const server = snapshotSchema.parse(await this.deps.fetch());
      if (this.disposed || this.pending || this.changes !== changes || this.editHolds) return;
      this.envelope = { ...this.envelope, server, draft: server.workspace };
      await this.persist();
      this.error = '';
    } catch (error) {
      if (this.disposed) return;
      if (statusCode(error) === 401) { this.locked = true; this.deps.unauthorized(); }
      this.error = errorMessage(error, 'Daily could not refresh from the server. Your current workspace is retained. Retry to check for newer changes.');
    } finally { this.notify(); }
  }
  async reloadServer() {
    if (this.disposed || this.locked) return;
    this.locked = true; this.notify();
    try {
      if (this.work) await this.work;
      if (this.refreshing) await this.refreshing;
      if (this.disposed) return;
      await this.persist();
      if (this.disposed) return;
      const backupKey = `${cacheKey(this.envelope.owner)}:backup:${uid()}`;
      // A failed backup must never allow discarding a draft.
      await this.writeRaw(backupKey, JSON.stringify(this.envelope));
      if (this.disposed) return;
      const server = snapshotSchema.parse(await this.deps.fetch());
      if (this.disposed) return;
      const replacement = { ...freshEnvelope(this.envelope.owner, server), imported: this.envelope.imported, backupKey };
      await this.writeRaw(cacheKey(this.envelope.owner), JSON.stringify(replacement));
      if (this.disposed) return;
      this.envelope = replacement; this.changes++; this.error = '';
    } catch (error) {
      this.error = errorMessage(error, 'Reload failed. Your current draft has not been discarded. Retry after checking your connection and device storage.');
      if (statusCode(error) === 401) this.deps.unauthorized();
    } finally { this.locked = false; this.notify(); }
  }
  async retryCorrectedDraft() {
    if (this.disposed || this.locked || !this.envelope.rejected || !this.envelope.pending) throw new Error('Only a definitively rejected 400/413 request can be replaced. Uncertain requests must retain their original mutation ID.');
    this.locked = true; this.notify();
    try {
      if (this.work) await this.work;
      if (this.disposed) return;
      await this.persist();
      const backupKey = `${cacheKey(this.envelope.owner)}:backup:${uid()}`;
      await this.writeRaw(backupKey, JSON.stringify(this.envelope));
      if (this.disposed) return;
      const replacement = { ...this.envelope, pending: null, rejected: null, dirty: true, backupKey };
      // The rejected request and latest draft must be safely archived and the
      // replacement durably recorded before dropping the obsolete pending item.
      await this.writeRaw(cacheKey(this.envelope.owner), JSON.stringify(replacement));
      if (this.disposed) return;
      this.envelope = replacement;
    } catch {
      this.storageError();
      return;
    } finally { this.locked = false; this.notify(); }
    // Keep the previous error visible until the corrected request is confirmed.
    await this.flush();
  }
  async importLegacy(legacy: Store) {
    if (this.disposed || this.locked || this.pending || this.envelope.imported || !isEmptyWorkspace(this.envelope.server.workspace)) throw new Error('Device data can only be imported into an empty, fully synced account.');
    // Check the server immediately before consented import. CAS also prevents
    // an unseen concurrent account change from being overwritten.
    await this.refresh();
    if (this.error || this.pending || !isEmptyWorkspace(this.envelope.server.workspace)) throw new Error('Could not verify an empty server workspace. Refresh the account before importing.');
    this.envelope = { ...this.envelope, importPending: true };
    if (!this.update(() => ({ ...legacy, entered: true }))) {
      this.envelope = { ...this.envelope, importPending: false };
      throw new Error('This device backup could not be imported under Daily’s current limits. The account and original backup are unchanged. Export the original recovery copy.');
    }
    await this.flush();
  }
  async prepareLogout() {
    this.locked = true; this.notify();
    try {
      if (this.refreshing) await this.refreshing;
      await this.flush();
      await this.persist();
      if (this.pending || this.error || this.envelope.conflict) throw new Error('Logout paused: your latest changes are not confirmed saved. Resolve the sync error first. Your session and draft are kept.');
    } catch (error) { this.locked = false; this.notify(); throw error; }
  }
}