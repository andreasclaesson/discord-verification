import { loadConfig, registerGuildCommands } from '@discord-verification/shared';
import { commandDefinitions } from './commands.js';

const { guild } = loadConfig();

await registerGuildCommands(guild.guildId, commandDefinitions);
console.log(`Registered ${commandDefinitions.length} command(s) to guild ${guild.guildId}.`);