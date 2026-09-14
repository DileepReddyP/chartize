import "server-only";

import { DatabaseSync } from "node:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import path from "node:path";

/** One small private database for this VPS, separate from the public data catalog. */
export class AuthStore {
  constructor(readonly db: DatabaseSync) {
    db.exec(`PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS auth_state (
        namespace TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, expires INTEGER NOT NULL,
        PRIMARY KEY (namespace, key)
      );
      CREATE INDEX IF NOT EXISTS auth_expiry ON auth_state(expires);
      CREATE TABLE IF NOT EXISTS admin_accounts (
        provider TEXT NOT NULL, subject TEXT NOT NULL,
        PRIMARY KEY (provider, subject)
      );`);
  }

  /** Checks the current admin membership for a provider's verified account ID. */
  isAdmin(provider: string, subject: string) {
    return Boolean(this.db.prepare("SELECT 1 FROM admin_accounts WHERE provider = ? AND subject = ?").get(provider, subject));
  }

  get<T>(namespace: string, key: string): T | undefined {
    const row = this.db.prepare("SELECT value FROM auth_state WHERE namespace = ? AND key = ? AND expires > ?").get(namespace, key, Date.now());
    return row ? JSON.parse(String(row.value)) as T : undefined;
  }

  set(namespace: string, key: string, value: unknown, ttl: number) {
    this.db.prepare("INSERT OR REPLACE INTO auth_state VALUES (?, ?, ?, ?)").run(namespace, key, JSON.stringify(value), Date.now() + ttl);
  }

  delete(namespace: string, key: string) {
    this.db.prepare("DELETE FROM auth_state WHERE namespace = ? AND key = ?").run(namespace, key);
  }

  prune() {
    this.db.prepare("DELETE FROM auth_state WHERE expires <= ?").run(Date.now());
  }

  /** Reserve all counters together, so a rejected request consumes none of them. */
  reserve(limits: { key: string; max: number; ttl: number }[]) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const counts = limits.map((limit) => this.get<number>("quota", limit.key) ?? 0);
      if (limits.some((limit, index) => counts[index]! >= limit.max)) { this.db.exec("ROLLBACK"); return false; }
      limits.forEach((limit, index) => this.set("quota", limit.key, counts[index]! + 1, limit.ttl));
      this.db.exec("COMMIT");
      return true;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  oauthStore<T>(namespace: string) {
    return {
      get: async (key: string) => this.get<T>(namespace, key),
      set: async (key: string, value: T) => { this.set(namespace, key, value, 10 * 60_000); },
      del: async (key: string) => { this.delete(namespace, key); },
    };
  }
}

const globals = globalThis as typeof globalThis & { chartizeAuthStore?: AuthStore };

export function authStore() {
  if (!globals.chartizeAuthStore) {
    const directory = path.resolve(process.env.CHARTIZE_AUTH_DIR ?? path.join(process.env.CHARTIZE_DATA_ROOT ?? "../../data", "auth"));
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    chmodSync(directory, 0o700);
    const filename = path.join(directory, "sessions.sqlite");
    const database = new DatabaseSync(filename);
    chmodSync(filename, 0o600);
    globals.chartizeAuthStore = new AuthStore(database);
  }
  globals.chartizeAuthStore.prune();
  return globals.chartizeAuthStore;
}
