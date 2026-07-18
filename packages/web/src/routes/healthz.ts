import type { IncomingMessage, ServerResponse } from 'node:http';
import { getDb } from '@discord-verification/shared';

export function handleHealthz(_req: IncomingMessage, res: ServerResponse): void {
    try {
        getDb().prepare('SELECT 1').get();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) }));
    } catch (err) {
        console.error('[healthz] DB check failed:', err);
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'database unavailable' }));
    }
}