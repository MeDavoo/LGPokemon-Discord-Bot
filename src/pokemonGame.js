const { updateScore } = require('./leaderboard'); // Import the updateScore and getScores functions
const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

// Variable to track whether a game is in progress
let gameInProgress = false;
let anyCorrectGuess = false; // Variable to track if any guesses were correct

async function startPokemonGame(interaction, generation, rounds) {
    // Check if a game is already in progress
    if (gameInProgress) {
        interaction.reply({ content: 'A game is already in progress.', ephemeral: true });
        return;
    }

    // Set game in progress
    gameInProgress = true;

    // Send initial embed indicating the start of the game
    const startEmbed = new EmbedBuilder()
        .setTitle('Starting Pokémon Naming Game')
        .setDescription('Get ready...')
        .setColor('Blue');
    await interaction.reply({ embeds: [startEmbed] });

    // Delay the start of the game by 2-3 seconds
    setTimeout(async () => {
        // Check if the game is still in progress after the delay
        if (!gameInProgress) {
            return;
        }

        const genFolder = `gen${generation}`;
        const genPath = path.join(__dirname, '..', genFolder); // Assuming gen folders are in the parent directory

        // Check if the specified generation folder exists
        if (!fs.existsSync(genPath)) {
            interaction.followUp({ content: `Generation ${generation} not found.`, ephemeral: true });
            gameInProgress = false; // Reset game status
            return;
        }

        const pokemonData = require('./pokemonData');

        const images = fs.readdirSync(genPath).filter(file => file.endsWith('.png'));

        // Check if there are enough images for the specified generation
        if (images.length === 0) {
            interaction.followUp({ content: `No Pokémon images found for Generation ${generation}.`, ephemeral: true });
            gameInProgress = false; // Reset game status
            return;
        }

        let scores = {}; // Reset scores for each game
        let round = 0;
        anyCorrectGuess = false; // Reset correct guess tracker

        const nextRound = async () => {
            round++;

            if (round > rounds) {
                gameInProgress = false; // Reset game status
                // Game ended, display final scores or "No one got anything right" message
                const embed = new EmbedBuilder()
                    .setTitle(':star: **Final Scores**')
                    .setColor('Gold');

                if (anyCorrectGuess) {
                    displayFinalScores(embed, interaction.guild, scores);
                } else {
                    embed.setDescription('No one got anything right!');
                }

                await interaction.channel.send({ embeds: [embed] });

                // Add 1 point to the leaderboard for the winner
                if (anyCorrectGuess) {
                    const winnerId = Object.keys(scores).find(userId => scores[userId] === rounds);
                    if (winnerId) {
                        updateScore(winnerId); // Update the score for the winner
                    }
                }

                return;
            }

            const randomIndex = Math.floor(Math.random() * images.length);
            const pokemonImage = path.join(genPath, images[randomIndex]);
            const pokemonNumber = path.basename(pokemonImage, path.extname(pokemonImage));
            const pokemonName = pokemonData[pokemonNumber];

            const embed = new EmbedBuilder()
                .setTitle(`Round ${round}`)
                .setColor('Blue')
                .setImage(`attachment://${path.basename(pokemonImage)}`);

            const message = await interaction.channel.send({ embeds: [embed], files: [pokemonImage] })
                .catch(console.error);

            // Listen for guesses for 15 seconds
            const filter = m => m.content.toLowerCase().trim() === pokemonName.toLowerCase();
            const collector = interaction.channel.createMessageCollector({ filter, time: 15000, max: 1 }); // Listen for only one answer

            collector.on('collect', async (collected) => {
                const user = collected.author;
                if (!scores[user.id]) {
                    scores[user.id] = 1; // Initialize score to 1 if user doesn't have a score
                } else {
                    scores[user.id]++; // Increment score if user already has a score
                }
                anyCorrectGuess = true; // Set flag to true if any guess is correct
                await collected.reply(`:white_check_mark: **${user.username}** got it right!`);
                collector.stop();
                const updatedEmbed = new EmbedBuilder()
                    .setTitle(`Round ${round}`)
                    .setColor('Green')
                    .setDescription(`:white_check_mark: **${user.username}**`)
                    .setImage(`attachment://${path.basename(pokemonImage)}`);
                await message.edit({ embeds: [updatedEmbed], files: [pokemonImage] });
                setTimeout(nextRound, 2000); // Start the next round after a delay
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    const updatedEmbed = new EmbedBuilder()
                        .setTitle(`Round ${round}`)
                        .setColor('Red')
                        .setDescription(`❌ **Time's up!** The Pokémon was: **${pokemonName}**`)
                        .setImage(`attachment://${path.basename(pokemonImage)}`);
                    await message.edit({ embeds: [updatedEmbed], files: [pokemonImage] });
                    await interaction.channel.send(`**Time's up!** Answer: **${pokemonName}**`);
                    // Move to the next round after a delay
                    setTimeout(nextRound, 2000);
                }
            });
        };

        // Start the first round
        await nextRound();
    }, 2000); // Adjust the delay as needed
}

function displayFinalScores(embed, guild, scores) {
    const sortedScores = Object.entries(scores).sort(([, score1], [, score2]) => score2 - score1);

    sortedScores.forEach(([userId, score], index) => {
        const member = guild.members.cache.get(userId);
        const username = member ? member.user.username : 'Unknown';
        embed.addFields(
            { name: `${index + 1}. ${username}`, value: `Score: ${score}` }
        );
    });
}

module.exports = { startPokemonGame };