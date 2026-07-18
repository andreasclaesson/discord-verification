import WebSocket from 'ws';
import { loadConfig } from '@discord-verification/shared';

// gateway opcodes we actually need to handle for this bot.
/* https://docs.discord.com/developers/events/gateway#gateway-opcodes-and-status-codes */
const OP = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  RESUME: 6,
  RECONNECT: 7,
  INVALID_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
} as const;

// GUILDS (1 << 0) for basic guild state, GUILD_MEMBERS (1 << 1, privileged) for
// GUILD_MEMBER_ADD events, the only intent the bot needs.
const INTENTS = (1 << 0) | (1 << 1);

interface GatewayPayload {
  op: number;
  d: unknown;
  s: number | null;
  t: string | null;
}

type DispatchHandler = (eventType: string, data: unknown) => void;

export class GatewayClient {
  private ws?: WebSocket;
  private heartbeatInterval?: ReturnType<typeof setInterval>;
  private lastSequence: number | null = null;
  private sessionId?: string;
  private resumeGatewayUrl?: string;
  private heartbeatAcked = true;
  private reconnectDelayMs = 1000;
  private shuttingDown = false;

  constructor(private readonly onDispatch: DispatchHandler) { }

  connect(url = 'wss://gateway.discord.gg/?v=10&encoding=json'): void {
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.reconnectDelayMs = 1000; // reset backoff on a clean connect
    });

    this.ws.on('message', (raw) => this.handleMessage(JSON.parse(raw.toString())));

    this.ws.on('close', (code) => {
      this.stopHeartbeat();
      if (this.shuttingDown) return;
      console.warn(`[gateway] closed with code ${code}, reconnecting...`);
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[gateway] socket error:', err);
    });
  }

  // intentionally closes the connection, won't trigger a reconnect.
  close(): void {
    this.shuttingDown = true;
    this.stopHeartbeat();
    this.ws?.close(1000, 'shutting down');
  }

  private scheduleReconnect(): void {
    setTimeout(() => {
      this.connect(this.resumeGatewayUrl ? `${this.resumeGatewayUrl}/?v=10&encoding=json` : undefined);
    }, this.reconnectDelayMs);
    // exponential backoff, capped at 30s
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 30_000);
  }

  private handleMessage(payload: GatewayPayload): void {
    if (payload.s !== null) this.lastSequence = payload.s;

    switch (payload.op) {
      case OP.HELLO: {
        const { heartbeat_interval } = payload.d as { heartbeat_interval: number };
        this.startHeartbeat(heartbeat_interval);
        this.sessionId ? this.resume() : this.identify();
        break;
      }
      case OP.HEARTBEAT_ACK:
        this.heartbeatAcked = true;
        break;
      case OP.HEARTBEAT:
        this.sendHeartbeat();
        break;
      case OP.RECONNECT:
        this.ws?.close();
        break;
      case OP.INVALID_SESSION: {
        const resumable = payload.d === true;
        if (!resumable) {
          this.sessionId = undefined;
          this.lastSequence = null;
        }
        // discord asks us to wait a random 1-5s before re-identifying/resuming.
        setTimeout(() => (this.sessionId ? this.resume() : this.identify()), 1000 + Math.random() * 4000);
        break;
      }
      case OP.DISPATCH: {
        const eventType = payload.t;
        if (eventType === 'READY') {
          const data = payload.d as { session_id: string; resume_gateway_url: string };
          this.sessionId = data.session_id;
          this.resumeGatewayUrl = data.resume_gateway_url;
        }
        if (eventType) this.onDispatch(eventType, payload.d);
        break;
      }
    }
  }

  private startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat();
    this.heartbeatAcked = true;
    // jitter the first beat as the docs recommend, so we don't all sync up.
    setTimeout(() => this.sendHeartbeat(), intervalMs * Math.random());
    this.heartbeatInterval = setInterval(() => {
      if (!this.heartbeatAcked) {
        // discord didn't ack our last heartbeat, connection is stale, force a reconnect.
        this.ws?.close();
        return;
      }
      this.sendHeartbeat();
    }, intervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
  }

  private sendHeartbeat(): void {
    this.heartbeatAcked = false;
    this.send({ op: OP.HEARTBEAT, d: this.lastSequence, s: null, t: null });
  }

  private identify(): void {
    const { discord } = loadConfig();
    this.send({
      op: OP.IDENTIFY,
      d: {
        token: discord.botToken,
        intents: INTENTS,
        properties: {
          os: process.platform,
          browser: 'discord-verification',
          device: 'discord-verification',
        },
      },
      s: null,
      t: null,
    });
  }

  private resume(): void {
    const { discord } = loadConfig();
    this.send({
      op: OP.RESUME,
      d: {
        token: discord.botToken,
        session_id: this.sessionId,
        seq: this.lastSequence,
      },
      s: null,
      t: null,
    });
  }

  private send(payload: Partial<GatewayPayload>): void {
    this.ws?.send(JSON.stringify(payload));
  }
}