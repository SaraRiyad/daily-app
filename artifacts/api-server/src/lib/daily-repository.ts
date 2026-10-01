import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "@workspace/db";
import type { Account, AuthResult, WorkspaceSnapshot } from "@workspace/api-zod";
import { emptyStore, type Store } from "@workspace/daily-model";
import { DailyError, databaseErrorCode } from "./daily-errors";
import { canonicalJson, digest, DUMMY_PASSWORD_HASH, hashPassword, newSessionToken, SESSION_TTL_SECONDS, verifyPassword } from "./daily-security";

type UserRow = { id: string; email: string; password_hash: string; created_at: Date };
type WorkspaceRow = { workspace: Store; revision: number; updated_at: Date };
export type AuthenticatedOwner = { account: Account; tokenHash: string };
type SaveInput = { workspace: Store; revision: number; mutationId: string };

const accountFromRow = (row: UserRow): Account => ({ id: row.id, email: row.email, createdAt: row.created_at.toISOString() });
const snapshotFromRow = (row: WorkspaceRow): WorkspaceSnapshot => ({ workspace: row.workspace, revision: row.revision, updatedAt: row.updated_at.toISOString() });

export class DailyRepository {
  constructor(private readonly pool: Pool) {}

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* Preserve the original failure. */ }
      throw error;
    } finally {
      client.release();
    }
  }

  private async incrementLimit(client: PoolClient, key: string, limit: number, seconds: number) {
    // The unique key and UPSERT row lock serialize requests across all instances.
    const result = await client.query<{ attempts: number; retry_after: number }>(
      `INSERT INTO daily_rate_limits (key, window_start, attempts, expires_at)
       VALUES ($1, statement_timestamp(), 1, statement_timestamp() + $3 * interval '1 second')
       ON CONFLICT (key) DO UPDATE SET
         attempts = CASE WHEN daily_rate_limits.expires_at <= statement_timestamp()
           THEN 1 ELSE LEAST(daily_rate_limits.attempts + 1, $2 + 1) END,
         window_start = CASE WHEN daily_rate_limits.expires_at <= statement_timestamp()
           THEN statement_timestamp() ELSE daily_rate_limits.window_start END,
         expires_at = CASE WHEN daily_rate_limits.expires_at <= statement_timestamp()
           THEN statement_timestamp() + $3 * interval '1 second' ELSE daily_rate_limits.expires_at END
       RETURNING attempts, GREATEST(1, CEIL(EXTRACT(EPOCH FROM expires_at - statement_timestamp())))::integer AS retry_after`,
      [key, limit, seconds],
    );
    return result.rows[0]!;
  }

  async throttleAuthentication(network: string, email: string): Promise<void> {
    const blocked = await this.transaction(async client => {
      // Bounded request-time cleanup, never startup-time schema mutations.
      await client.query(`DELETE FROM daily_rate_limits WHERE key IN
        (SELECT key FROM daily_rate_limits WHERE expires_at < statement_timestamp() - interval '1 day' LIMIT 100)`);
      const networkLimit = await this.incrementLimit(client, `auth-network:${digest(network)}`, 120, 900);
      if (networkLimit.attempts > 120) return networkLimit.retry_after;
      const accountLimit = await this.incrementLimit(client, `auth-account:${digest(email)}`, 10, 900);
      return accountLimit.attempts > 10 ? accountLimit.retry_after : null;
    });
    // Throw only after committing: rejected requests must not roll back counters.
    if (blocked !== null) throw new DailyError(429, "Too many sign-in attempts. Please wait before trying again.", blocked);
  }

  private async insertSession(client: PoolClient, ownerId: string, token: string): Promise<void> {
    await client.query(
      `INSERT INTO daily_sessions (token_hash, owner_id, expires_at)
       VALUES ($1, $2, statement_timestamp() + $3 * interval '1 second')`,
      [digest(token), ownerId, SESSION_TTL_SECONDS],
    );
    await client.query(`DELETE FROM daily_sessions WHERE token_hash IN
      (SELECT token_hash FROM daily_sessions WHERE expires_at < statement_timestamp() - interval '1 day' LIMIT 100)`);
  }

  async register(email: string, password: string, name: string): Promise<AuthResult> {
    const passwordHash = await hashPassword(password);
    const ownerId = randomUUID();
    const token = newSessionToken();
    try {
      return await this.transaction(async client => {
        const users = await client.query<UserRow>(
          `INSERT INTO daily_users (id, email, password_hash) VALUES ($1, $2, $3) RETURNING *`,
          [ownerId, email, passwordHash],
        );
        const workspaces = await client.query<WorkspaceRow>(
          `INSERT INTO daily_workspaces (owner_id, workspace) VALUES ($1, $2::jsonb) RETURNING workspace, revision, updated_at`,
          [ownerId, JSON.stringify(emptyStore(name))],
        );
        await this.insertSession(client, ownerId, token);
        return { token, account: accountFromRow(users.rows[0]!), snapshot: snapshotFromRow(workspaces.rows[0]!) };
      });
    } catch (error) {
      if (databaseErrorCode(error) === "23505") throw new DailyError(409, "An account with this email already exists. Sign in instead.");
      throw error;
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const users = await this.pool.query<UserRow>("SELECT * FROM daily_users WHERE email = $1", [email]);
    const user = users.rows[0];
    const matches = await verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!user || !matches) throw new DailyError(401, "Email or password is incorrect.");
    const token = newSessionToken();
    return this.transaction(async client => {
      const workspaces = await client.query<WorkspaceRow>(
        "SELECT workspace, revision, updated_at FROM daily_workspaces WHERE owner_id = $1", [user.id],
      );
      if (!workspaces.rows[0]) throw new DailyError(500, "Your workspace could not be loaded.");
      await this.insertSession(client, user.id, token);
      return { token, account: accountFromRow(user), snapshot: snapshotFromRow(workspaces.rows[0]) };
    });
  }

  async authenticate(tokenHash: string): Promise<AuthenticatedOwner> {
    const result = await this.pool.query<UserRow>(
      `SELECT u.* FROM daily_sessions s JOIN daily_users u ON u.id = s.owner_id
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > statement_timestamp()`,
      [tokenHash],
    );
    if (!result.rows[0]) throw new DailyError(401, "Your session has expired. Please sign in again.");
    return { account: accountFromRow(result.rows[0]), tokenHash };
  }

  async logout(owner: AuthenticatedOwner): Promise<void> {
    await this.pool.query(
      `UPDATE daily_sessions SET revoked_at = COALESCE(revoked_at, statement_timestamp())
       WHERE token_hash = $1 AND owner_id = $2`, [owner.tokenHash, owner.account.id],
    );
  }

  async getWorkspace(ownerId: string): Promise<WorkspaceSnapshot> {
    const result = await this.pool.query<WorkspaceRow>(
      "SELECT workspace, revision, updated_at FROM daily_workspaces WHERE owner_id = $1", [ownerId],
    );
    if (!result.rows[0]) throw new DailyError(500, "Your workspace could not be loaded.");
    return snapshotFromRow(result.rows[0]);
  }

  async saveWorkspace(owner: AuthenticatedOwner, input: SaveInput): Promise<WorkspaceSnapshot> {
    const normalizedWorkspace = { ...input.workspace, entered: true };
    const requestHash = digest(canonicalJson({ workspace: normalizedWorkspace, revision: input.revision }));
    return this.transaction(async client => {
      // Prevent a logout racing a write: revocation waits for this session lock.
      const session = await client.query(
        `SELECT token_hash FROM daily_sessions WHERE token_hash = $1 AND owner_id = $2
         AND revoked_at IS NULL AND expires_at > statement_timestamp() FOR SHARE`,
        [owner.tokenHash, owner.account.id],
      );
      if (!session.rowCount) throw new DailyError(401, "Your session has expired. Please sign in again.");
      const current = await client.query<WorkspaceRow>(
        `SELECT workspace, revision, updated_at FROM daily_workspaces WHERE owner_id = $1 FOR UPDATE`,
        [owner.account.id],
      );
      if (!current.rows[0]) throw new DailyError(500, "Your workspace could not be loaded.");
      // All writes for an owner are serialized by the workspace row lock.
      const previous = await client.query<{ snapshot: WorkspaceSnapshot; request_hash: string }>(
        "SELECT snapshot, request_hash FROM daily_mutations WHERE owner_id = $1 AND mutation_id = $2",
        [owner.account.id, input.mutationId],
      );
      if (previous.rows[0]) {
        if (previous.rows[0].request_hash !== requestHash) {
          throw new DailyError(409, "This mutation ID was already used for a different save.");
        }
        return previous.rows[0].snapshot;
      }
      if (current.rows[0].revision !== input.revision) {
        throw new DailyError(409, "Your workspace changed on another device. Keep your local draft or reload the server version.");
      }
      const rate = await this.incrementLimit(client, `workspace:${owner.account.id}`, 120, 60);
      if (rate.attempts > 120) throw new DailyError(429, "Too many workspace saves. Please wait before retrying.", rate.retry_after);
      const updated = await client.query<WorkspaceRow>(
        `UPDATE daily_workspaces SET workspace = $1::jsonb, revision = revision + 1, updated_at = statement_timestamp()
         WHERE owner_id = $2 AND revision = $3 RETURNING workspace, revision, updated_at`,
        [JSON.stringify(normalizedWorkspace), owner.account.id, input.revision],
      );
      if (!updated.rows[0]) throw new DailyError(409, "Your workspace changed on another device.");
      const snapshot = snapshotFromRow(updated.rows[0]);
      await client.query(
        `INSERT INTO daily_mutations (owner_id, mutation_id, request_hash, snapshot) VALUES ($1, $2, $3, $4::jsonb)`,
        [owner.account.id, input.mutationId, requestHash, JSON.stringify(snapshot)],
      );
      return snapshot;
    });
  }
}