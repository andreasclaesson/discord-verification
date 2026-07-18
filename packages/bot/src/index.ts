import { initDb, sweepExpiredVerifications, closeDb, registerGracefulShutdown } from '@discord-verification/shared';
import { GatewayClient } from './gateway.js';
import { handleGuildMemberAdd } from './handlers/guildMemberAdd.js';
import { handleInteractionCreate } from './handlers/interactionCreate.js';

initDb();

const gateway = new GatewayClient((eventType, data) => {
  switch (eventType) {
    case 'READY':
      console.log('[bot] gateway ready');
      break;
    case 'GUILD_MEMBER_ADD':
      handleGuildMemberAdd(data).catch((err) => console.error('[guildMemberAdd] failed:', err));
      break;
    case 'INTERACTION_CREATE':
      handleInteractionCreate(data).catch((err) => console.error('[interactionCreate] failed:', err));
      break;
  }
});

gateway.connect();

// periodically flip stale pending rows to 'expired' so they can't be redeemed
// and so an admin looking at the DB isn't confused by ancient "pending" rows.
const sweepTimer = setInterval(() => {
  const count = sweepExpiredVerifications();
  if (count > 0) console.log(`[bot] expired ${count} stale verification token(s)`);
}, 5 * 60_000);

registerGracefulShutdown('bot', () => {
  clearInterval(sweepTimer);
  gateway.close();
  closeDb();
});