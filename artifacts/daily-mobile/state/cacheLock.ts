// Browser caches are shared across tabs, but bearer sessions are not. A CAS on
// the server cannot protect an offline outbox from another local cache writer.
// Use the browser's real exclusive lock, held for the engine's entire lifetime.
export type CacheLocks = {
  request: (name: string, options: { mode: 'exclusive'; ifAvailable: true }, callback: (lock: unknown | null) => Promise<void>) => Promise<unknown>;
};
export type CacheLease = { owner: string; release: () => Promise<void> };
export async function acquireAccountCacheLock(owner: string, locks?: CacheLocks): Promise<CacheLease> {
  if (!locks) throw new Error('This account cannot be opened safely in this browser: exclusive Web Locks are unavailable. Use a supported browser or the native app. No device workspace was changed.');
  return new Promise<CacheLease>((resolve, reject) => {
    let lifetime: Promise<unknown> | undefined;
    try {
      lifetime = locks.request(`daily-account-cache-v1:${owner}`, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock) {
          reject(new Error('This account is open in another Daily tab. Close or safely log out of that tab, then Retry here. Its pending device data has not been touched.'));
          return;
        }
        await new Promise<void>(finish => {
          let released = false;
          resolve({ owner, release: async () => {
            if (!released) { released = true; finish(); }
            await lifetime;
          } });
        });
      });
      void lifetime.catch(() => reject(new Error('This account’s browser cache lock could not be acquired. Retry in a supported browser. No device workspace was changed.')));
    } catch { reject(new Error('This account’s browser cache lock could not be acquired. No device workspace was changed.')); }
  });
}