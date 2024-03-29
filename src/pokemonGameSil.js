const { updateScore } = require('./leaderboard');
const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

let gameInProgress = false;
let anyCorrectGuess = false;

async function startPokemonGameSil(interaction, generation, rounds, silhouetteMode = true) {
    if (gameInProgress) {
        interaction.reply({ content: 'A game is already in progress.', ephemeral: true });
        return;
    }

    gameInProgress = true;

    const startEmbed = new EmbedBuilder()
        .setTitle('Starting Pokémon Naming Game')
        .setDescription('Get ready...')
        .setColor('Blue');
    await interaction.reply({ embeds: [startEmbed] });

    setTimeout(async () => {
        if (!gameInProgress) {
            return;
        }

        const genFolder = `gen${generation}`;
        const genPath = path.join(__dirname, '..', genFolder);

        if (!fs.existsSync(genPath)) {
            interaction.followUp({ content: `Generation ${generation} not found.`, ephemeral: true });
            gameInProgress = false;
            return;
        }

        const pokemonData = require('./pokemonData');

        const images = fs.readdirSync(genPath).filter(file => file.endsWith('.png'));

        if (images.length === 0) {
            interaction.followUp({ content: `No Pokémon images found for Generation ${generation}.`, ephemeral: true });
            gameInProgress = false;
            return;
        }

        let scores = {};
        let round = 0;
        anyCorrectGuess = false;

        const nextRound = async () => {
            round++;

            if (round > rounds) {
                gameInProgress = false;
                const embed = new EmbedBuilder()
                    .setTitle(':star: **Final Scores**')
                    .setColor('Gold');

                if (anyCorrectGuess) {
                    displayFinalScores(embed, interaction.guild, scores);
                } else {
                    embed.setDescription('No one got anything right!');
                }

                await interaction.channel.send({ embeds: [embed] });

                if (anyCorrectGuess) {
                    const winnerId = Object.keys(scores).find(userId => scores[userId] === rounds);
                    if (winnerId) {
                        updateScore(winnerId);
                    }
                }

                return;
            }

            const randomIndex = Math.floor(Math.random() * images.length);
            const pokemonImage = path.join(genPath, images[randomIndex]);
            const pokemonNumber = path.basename(pokemonImage, path.extname(pokemonImage));
            const pokemonName = pokemonData[pokemonNumber];

            let imageToSend = pokemonImage;

            if (silhouetteMode) {
                try {
                    imageToSend = await createSilhouetteImage(pokemonImage);
                } catch (error) {
                    console.error('Error creating silhouette image:', error);
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`Round ${round}`)
                .setColor('Blue')
                .setImage(`attachment://pokemon.png`);

            const message = await interaction.channel.send({ embeds: [embed], files: [{ attachment: imageToSend, name: 'pokemon.png' }] })
                .catch(console.error);

            const filter = m => m.content.toLowerCase().trim() === pokemonName.toLowerCase();
            const collector = interaction.channel.createMessageCollector({ filter, time: 15000, max: 1 });

            collector.on('collect', async (collected) => {
                const user = collected.author;
                if (!scores[user.id]) {
                    scores[user.id] = 1;
                } else {
                    scores[user.id]++;
                }
                anyCorrectGuess = true;
                await collected.reply(`:white_check_mark: **${user.username}** got it right!`);
                collector.stop();
                let imageToSend = silhouetteMode ? await createOriginalImage(pokemonNumber) : pokemonImage;
                const updatedEmbed = new EmbedBuilder()
                    .setTitle(`Round ${round}`)
                    .setColor('Green')
                    .setDescription(`:white_check_mark: **${user.username}**`)
                    .setImage(`attachment://pokemon.png`);
                await message.edit({ embeds: [updatedEmbed], files: [{ attachment: imageToSend, name: 'pokemon.png' }] });
                setTimeout(nextRound, 2000);
            });
            
            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    let imageToSend = silhouetteMode ? await createOriginalImage(pokemonNumber) : pokemonImage;
                    const updatedEmbed = new EmbedBuilder()
                        .setTitle(`Round ${round}`)
                        .setColor('Red')
                        .setDescription(`❌ **Time's up!** The Pokémon was: **${pokemonName}**`)
                        .setImage(`attachment://pokemon.png`);
                    await message.edit({ embeds: [updatedEmbed], files: [{ attachment: imageToSend, name: 'pokemon.png' }] });
                    await interaction.channel.send(`**Time's up!** Answer: **${pokemonName}**`);
                    setTimeout(nextRound, 2000);
                }
            });
            
            async function createOriginalImage(pokemonNumber) {
                const originalImagePath = path.join(__dirname, '..', `gen${generation}`, `${pokemonNumber}.png`);
                return originalImagePath;
            }
        };

        await nextRound();
    }, 2000);
}

async function createSilhouetteImage(originalImagePath) {
    const image = await loadImage(originalImagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        data[i] = 0; // Red
        data[i + 1] = 0; // Green
        data[i + 2] = 0; // Blue
    }

    ctx.putImageData(imageData, 0, 0);

    const silhouetteImagePath = path.join(__dirname, '..', 'silhouette.png');
    const out = fs.createWriteStream(silhouetteImagePath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    return new Promise((resolve, reject) => {
        out.on('finish', () => resolve(silhouetteImagePath));
        out.on('error', reject);
    });
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

module.exports = { startPokemonGameSil };