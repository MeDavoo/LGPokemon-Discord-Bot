require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { startPokemonGame, forceStopGame, isGameRunning } = require('./pokemonGame');
const { handleLeaderboard } = require('./leaderboard');

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
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'poke') {
        const generation = interaction.options.getInteger('generation');
        const rounds = interaction.options.getInteger('rounds');
        const silhouetteMode = interaction.options.getBoolean('silhouette') || false;

        await startPokemonGame(interaction, generation, rounds, silhouetteMode);
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
    }
});

client.login(process.env.TOKEN);