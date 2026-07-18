import Database from 'better-sqlite3';
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
export declare function getDb(): Database.Database;
export declare function createPendingVerification(guildId: string, userId: string): PendingVerification;
export declare function getPendingVerification(token: string): PendingVerification | undefined;
export declare function claimPendingVerification(token: string): PendingVerification | undefined;
export declare function markVerificationFailed(token: string, reason: string): void;
export declare function markUserVerified(guildId: string, userId: string): void;
export declare function isUserVerified(guildId: string, userId: string): boolean;
export declare function sweepExpiredVerifications(): number;
export declare function initDb(): void;
