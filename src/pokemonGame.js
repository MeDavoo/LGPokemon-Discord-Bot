const { updateScore } = require('./leaderboard');
const { updatePlayerStats } = require('./stats');
const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

let gameInProgress = false;
let anyCorrectGuess = false;
let currentCollector = null;

async function startPokemonGame(interaction, generation, rounds, mode = 'normal') {
    if (interaction.deferred || interaction.replied || gameInProgress) {
        interaction.reply({ content: 'A game is already in progress.', ephemeral: true });
        return;
    }

    gameInProgress = true;

    const startEmbed = new EmbedBuilder()
        .setTitle(
            mode === 'silhouette' ? 'Who\'s that Pokémon? (Silhouette Mode)' :
            mode === 'spotlight' ? 'Who\'s that Pokémon? (Spotlight Mode)' :
            'Who\'s that Pokémon?'
        )
        .setDescription('Get ready...')
        .setColor('Blue');
    await interaction.reply({ embeds: [startEmbed] });

    setTimeout(async () => {
        if (!gameInProgress) return;

        const pokemonData = require('./pokemonData');
        let availableImages = [];

        if (generation === 0) {
            for (let gen = 1; gen <= 8; gen++) {
                const genFolder = `gen${gen}`;
                const genPath = path.join(__dirname, '..', genFolder);
                if (fs.existsSync(genPath)) {
                    const images = fs.readdirSync(genPath).filter(file => file.endsWith('.png'));
                    images.forEach(img => availableImages.push({ gen, img }));
                }
            }
        } else {
            const genFolder = `gen${generation}`;
            const genPath = path.join(__dirname, '..', genFolder);
            if (!fs.existsSync(genPath)) {
                interaction.followUp({ content: `Generation ${generation} not found.`, ephemeral: true });
                gameInProgress = false;
                return;
            }
            const images = fs.readdirSync(genPath).filter(file => file.endsWith('.png'));
            availableImages = images.map(img => ({ gen: generation, img }));
        }

        if (availableImages.length === 0) {
            interaction.followUp({ content: `No Pokémon images found for the selected generation(s).`, ephemeral: true });
            gameInProgress = false;
            return;
        }

        let scores = {};
        let round = 0;
        anyCorrectGuess = false;

        const nextRound = async () => {
            if (!gameInProgress) return;

            round++;
            const roundStartTime = Date.now(); // Add this line!

            if (round > rounds || availableImages.length === 0) {
                gameInProgress = false;
                const embed = new EmbedBuilder()
                    .setTitle(':star: **Final Scores**')
                    .setColor('Gold');

                if (anyCorrectGuess) {
                    displayFinalScores(embed, interaction.guild, scores);
                    
                    // Check if there are at least 2 players who participated
                    const playersWhoParticipated = Object.keys(scores).length;
                    
                    if (playersWhoParticipated >= 2) {
                        // Get the highest score
                        const maxScore = Math.max(...Object.values(scores));
                        
                        // Find all players who tied for first
                        const winnerIds = Object.keys(scores).filter(userId => scores[userId] === maxScore);
                        
                        // Update leaderboard scores for winners
                        for (const winnerId of winnerIds) {
                            updateScore(winnerId, mode);
                        }
                        
                        // Add a note about points being awarded
                        embed.setFooter({ 
                            text: `🏆 Leaderboard points awarded to ${winnerIds.length > 1 ? 'winners' : 'winner'}!` 
                        });
                    } else {
                        // Add a note that no points were awarded
                        embed.setFooter({ 
                            text: '❌ No leaderboard points awarded - not enough players tried hard enough.' 
                        });
                    }
                } else {
                    embed.setDescription('No one got anything right!');
                }

                await interaction.channel.send({ embeds: [embed] });
                return;
            }

            const randomIndex = Math.floor(Math.random() * availableImages.length);
            const { gen, img } = availableImages[randomIndex];
            availableImages.splice(randomIndex, 1);

            const genPath = path.join(__dirname, '..', `gen${gen}`);
            const pokemonImage = path.join(genPath, img);
            const pokemonNumber = path.basename(pokemonImage, path.extname(pokemonImage));
            const pokemonName = pokemonData[pokemonNumber];

            let imageToSend = pokemonImage;
            if (mode === 'silhouette') {
                try {
                    imageToSend = await createSilhouetteImage(pokemonImage);
                } catch (error) {
                    console.error('Error creating silhouette image:', error);
                }
            } else if (mode === 'spotlight') {
                try {
                    imageToSend = await createSpotlightImage(pokemonImage);
                } catch (error) {
                    console.error('Error creating spotlight image:', error);
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`Round ${round}`)
                .setColor('Blue')
                .setImage(`attachment://pokemon.png`);

            const message = await interaction.channel.send({ 
                embeds: [embed], 
                files: [{ attachment: imageToSend, name: 'pokemon.png' }] 
            }).catch(console.error);

            const filter = m => m.content.toLowerCase().trim() === pokemonName.toLowerCase();
            const collector = interaction.channel.createMessageCollector({ filter, time: 15000, max: 1 });
            currentCollector = collector;

            setTimeout(async () => {
                if (collector.ended || !gameInProgress) return;

                const hint = generateHint(pokemonName);
                const hintEmbed = new EmbedBuilder()
                    .setTitle('❓ Hint')
                    .setDescription(hint)
                    .setColor('Yellow');

                const hintMessage = await interaction.channel.send({ embeds: [hintEmbed] });
                
                // Add timeout to delete hint message
                setTimeout(async () => {
                    try {
                        await hintMessage.delete();
                    } catch (err) {
                        console.error('Failed to delete hint message:', err);
                    }
                }, 5000); // Deletes hint after 5 seconds
            }, 10000);

            collector.on('collect', async (collected) => {
                const user = collected.author;
                if (!scores[user.id]) scores[user.id] = 1;
                else scores[user.id]++;

                anyCorrectGuess = true;
                await collected.reply(`:white_check_mark: **${user.username}** got it right!`);
                collector.stop();

                const updatedEmbed = new EmbedBuilder()
                    .setTitle(`Round ${round}`)
                    .setColor('Green')
                    .setDescription(`:white_check_mark: **${user.username}**`)
                    .setImage(`attachment://pokemon.png`);

                await message.edit({ 
                    embeds: [updatedEmbed], 
                    files: [{ attachment: pokemonImage, name: 'pokemon.png' }] 
                });

                // Update player stats
                updatePlayerStats(user.id, {
                    won: true,
                    guessTime: (Date.now() - roundStartTime) / 1000, // Add roundStartTime at start of each round
                    correctGuesses: 1,
                    mode: mode
                });

                setTimeout(async () => {
                    try { await message.delete(); } catch (err) { }
                }, 10000);

                setTimeout(() => {
                    if (gameInProgress) nextRound();
                }, 2000);
                currentCollector = null;
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    const updatedEmbed = new EmbedBuilder()
                        .setTitle(`Round ${round}`)
                        .setColor('Red')
                        .setDescription(`❌ **Time's up!** The Pokémon was: **${pokemonName}**`)
                        .setImage(`attachment://pokemon.png`);

                    await message.edit({ 
                        embeds: [updatedEmbed], 
                        files: [{ attachment: pokemonImage, name: 'pokemon.png' }] 
                    });
                    await interaction.channel.send(`❌ **Time's up!** Answer: **${pokemonName}**`);

                    setTimeout(async () => {
                        try { await message.delete(); } catch (err) { }
                    }, 10000);

                    setTimeout(() => {
                        if (gameInProgress) nextRound();
                    }, 2000);
                }
                currentCollector = null;
            });
        };

        await nextRound();
    }, 2000);
}

// Helper functions
function generateHint(pokemonName) {
    const name = pokemonName.toLowerCase();
    let hint = new Array(name.length).fill('⬛');
    const lettersToReveal = Math.max(2, Math.floor(name.length * 0.5));
    let revealedCount = 0;
    
    for (let i = 0; i < name.length; i++) {
        if (name[i] === ' ' || name[i] === '-' || name[i] === '.') {
            hint[i] = name[i];
        }
    }
    
    while (revealedCount < lettersToReveal) {
        const randomIndex = Math.floor(Math.random() * name.length);
        if (hint[randomIndex] === '⬛' && name[randomIndex] !== ' ') {
            hint[randomIndex] = name[randomIndex].toUpperCase();
            revealedCount++;
        }
    }
    
    return hint.join(' ');
}

async function createSilhouetteImage(originalImagePath) {
    const image = await loadImage(originalImagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
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

async function createSpotlightImage(originalImagePath) {
    const image = await loadImage(originalImagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // Draw black background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Random angle for the spotlight bar (0 to 180 degrees)
    const angle = Math.random() * Math.PI;
    
    // Width of the spotlight bar (5-10% of image width)
    const barWidth = Math.max(20, canvas.width * 0.08);
    
    // Save context state
    ctx.save();
    
    // Move to center and rotate
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.rotate(angle);
    
    // Create spotlight bar
    ctx.beginPath();
    ctx.rect(-canvas.width, -barWidth/2, canvas.width * 2, barWidth);
    ctx.clip();
    
    // Draw original image
    ctx.rotate(-angle);
    ctx.drawImage(image, -canvas.width/2, -canvas.height/2);
    
    // Restore context
    ctx.restore();

    const spotlightImagePath = path.join(__dirname, '..', 'spotlight.png');
    const out = fs.createWriteStream(spotlightImagePath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    return new Promise((resolve, reject) => {
        out.on('finish', () => resolve(spotlightImagePath));
        out.on('error', reject);
    });
}

function displayFinalScores(embed, guild, scores) {
    const sortedScores = Object.entries(scores)
        .sort(([, score1], [, score2]) => score2 - score1)
        .forEach(([userId, score], index) => {
            const member = guild.members.cache.get(userId);
            const username = member ? member.user.username : 'Unknown';
            embed.addFields({ name: `${index + 1}. ${username}`, value: `Score: ${score}` });
        });
}

function forceStopGame() {
    gameInProgress = false;
    if (currentCollector) {
        currentCollector.stop('force-stopped');
        currentCollector = null;
    }
}

function isGameRunning() {
    return gameInProgress;
}

module.exports = { 
    startPokemonGame,
    forceStopGame, 
    isGameRunning,
    createSilhouetteImage,
    createSpotlightImage 
};