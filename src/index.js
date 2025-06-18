require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { startPokemonGame, forceStopGame, isGameRunning } = require('./pokemonGame');
const { handleLeaderboard } = require('./leaderboard');
const { handleStats } = require('./stats');
const { handleDaily, handleDailyLeaderboard, scheduleDailyReset } = require('./daily');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setActivity(`Who's that Pokémon?`);

    // Schedule the daily reset
    scheduleDailyReset(client);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'poke') {
        const generation = interaction.options.getInteger('generation');
        const rounds = interaction.options.getInteger('rounds');
        const mode = interaction.options.getString('mode');
        await startPokemonGame(interaction, generation, rounds, mode);
    } else if (interaction.commandName === 'leaderboard') {
        const mode = interaction.options.getString('mode');
        await handleLeaderboard(interaction, mode);
    } else if (interaction.commandName === 'stop') {
        if (isGameRunning()) {
            forceStopGame();
            await interaction.reply({ content: 'Game stopped.', ephemeral: false });
        } else {
            await interaction.reply({ content: 'No game is currently running.', ephemeral: true });
        }
    } else if (interaction.commandName === 'stats') {
        await handleStats(interaction);
    } else if (interaction.commandName === 'daily') {
        await handleDaily(interaction);
    } else if (interaction.commandName === 'dailyleaderboard') {
        await handleDailyLeaderboard(interaction);
    }
});

client.login(process.env.TOKEN);