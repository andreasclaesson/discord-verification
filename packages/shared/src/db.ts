import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';

export type VerificationStatus = 'pending' | 'completed' | 'expired' | 'failed';

export interface PendingVerification {
  token: string;
  guild_id: string;
  user_id: string;
  status: VerificationStatus;
  created_at: number;
  expires_at: number;
  consumed_at: number | null;
  failure_reason: string | null;
}

let db: Database.Database | undefined;

function schemaPath(): string {
  const here = fileURLToPath(import.meta.url);
  return here.replace(/db\.(ts|js)$/, 'schema.sql');
}

export function getDb(): Database.Database {
  if (db) return db;

  const { db: dbConfig } = loadConfig();
  mkdirSync(dirname(dbConfig.path), { recursive: true });

  db = new Database(dbConfig.path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = readFileSync(schemaPath(), 'utf-8');
  db.exec(schema);

  return db;
}

export function createPendingVerification(guildId: string, userId: string): PendingVerification {
  const { verification } = loadConfig();
  const now = Date.now();
  const row: PendingVerification = {
    token: randomUUID(),
    guild_id: guildId,
    user_id: userId,
    status: 'pending',
    created_at: now,
    expires_at: now + verification.tokenTtlMinutes * 60_000,
    consumed_at: null,
    failure_reason: null,
  };

  getDb()
    .prepare(
      `INSERT INTO pending_verifications (token, guild_id, user_id, status, created_at, expires_at)
       VALUES (@token, @guild_id, @user_id, @status, @created_at, @expires_at)`
    )
    .run(row);

  return row;
}

export function getPendingVerification(token: string): PendingVerification | undefined {
  return getDb()
    .prepare(`SELECT * FROM pending_verifications WHERE token = ?`)
    .get(token) as PendingVerification | undefined;
}

export function claimPendingVerification(token: string): PendingVerification | undefined {
  const now = Date.now();
  const result = getDb()
    .prepare(
      `UPDATE pending_verifications
       SET status = 'completed', consumed_at = @now
       WHERE token = @token AND status = 'pending' AND expires_at > @now`
    )
    .run({ token, now });

  if (result.changes === 0) return undefined;
  return getPendingVerification(token);
}

export function markVerificationFailed(token: string, reason: string): void {
  getDb()
    .prepare(
      `UPDATE pending_verifications SET status = 'failed', failure_reason = @reason WHERE token = @token`
    )
    .run({ token, reason });
}

export function markUserVerified(guildId: string, userId: string): void {
  getDb()
    .prepare(
      `INSERT INTO verified_users (guild_id, user_id, verified_at)
       VALUES (@guild_id, @user_id, @verified_at)
       ON CONFLICT (guild_id, user_id) DO UPDATE SET verified_at = excluded.verified_at`
    )
    .run({ guild_id: guildId, user_id: userId, verified_at: Date.now() });
}

export function isUserVerified(guildId: string, userId: string): boolean {
  const row = getDb()
    .prepare(`SELECT 1 FROM verified_users WHERE guild_id = ? AND user_id = ?`)
    .get(guildId, userId);
  return !!row;
}

export function sweepExpiredVerifications(): number {
  const result = getDb()
    .prepare(`UPDATE pending_verifications SET status = 'expired' WHERE status = 'pending' AND expires_at <= ?`)
    .run(Date.now());
  return result.changes;
}

export function initDb(): void {
  getDb();
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = undefined;
  }
}