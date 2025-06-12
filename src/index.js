require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { startPokemonGame, forceStopGame, isGameRunning } = require('./pokemonGame'); // Import the normal gameplay function and force stop function
const { startPokemonGameSil, forceStopGameSil, isGameRunningSil } = require('./pokemonGameSil'); // Import the silhouette gameplay function and force stop function
const { handleLeaderboard } = require('./leaderboard'); // Import the leaderboard handler

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Placeholder object to store scores (replace with your actual implementation)
const scores = {};

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setActivity(`Who's that Pokémon?`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'poke') {
        const generation = interaction.options.getInteger('generation');
        const rounds = interaction.options.getInteger('rounds');
        const silhouetteMode = interaction.options.getBoolean('silhouette') || false; // Check if silhouette mode is enabled

        if (silhouetteMode) {
            // Call the silhouette gameplay function
            await startPokemonGameSil(interaction, generation, rounds);
        } else {
            // Call the normal gameplay function
            await startPokemonGame(interaction, generation, rounds);
        }
    } else if (interaction.commandName === 'leaderboard') {
        const mode = interaction.options.getString('mode');
        await handleLeaderboard(interaction, mode);
    } else if (interaction.commandName === 'stop') {
        if (isGameRunning() || isGameRunningSil()) {
            forceStopGame();
            forceStopGameSil();
            await interaction.reply({ content: 'Game stopped.', ephemeral: false });
        } else {
            await interaction.reply({ content: 'No game is currently running.', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);