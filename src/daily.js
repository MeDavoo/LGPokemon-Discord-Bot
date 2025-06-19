const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');
const { EmbedBuilder } = require('discord.js');
const pokemonData = require('./pokemonData.json');
const schedule = require('node-schedule');
const moment = require('moment-timezone');

const dailyFilePath = path.join(__dirname, 'daily.json');
const netherlandsTime = moment.tz('Europe/Amsterdam').format('HH:mm');

// Load daily data from the JSON file
function loadDailyData() {
    if (fs.existsSync(dailyFilePath)) {
        return JSON.parse(fs.readFileSync(dailyFilePath, 'utf8'));
    }
    return { players: {}, lastReset: new Date().toISOString().split('T')[0] };
}

// Save daily data to the JSON file
function saveDailyData(data) {
    fs.writeFileSync(dailyFilePath, JSON.stringify(data, null, 2));
}

// Generate random Pokémon IDs
function generateRandomPokemonIds(count) {
    // Define the Pokémon ID ranges for Gen 1 to Gen 5
    const genRanges = {
        gen1: [1, 151],    // Gen 1: Bulbasaur to Mew
        gen2: [152, 251],  // Gen 2: Chikorita to Celebi
        gen3: [252, 386],  // Gen 3: Treecko to Deoxys
        gen4: [387, 493],  // Gen 4: Turtwig to Arceus
        gen5: [494, 649],  // Gen 5: Victini to Genesect
    };

    const allIds = [];

    // Combine all Pokémon IDs from Gen 1 to Gen 5
    for (const range of Object.values(genRanges)) {
        for (let i = range[0]; i <= range[1]; i++) {
            allIds.push(i);
        }
    }

    const selectedIds = [];

    // Randomly select `count` Pokémon IDs
    while (selectedIds.length < count) {
        const randomId = allIds[Math.floor(Math.random() * allIds.length)];
        if (!selectedIds.includes(randomId)) {
            selectedIds.push(randomId);
        }
    }

    return selectedIds;
}

// Create the daily image with three Pokémon
async function createDailyImage(pokemonIds, guessed = [], userId) {
    const canvasWidth = 600; // Total width of the image
    const canvasHeight = 600; // Height of the image (square layout)
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Draw black background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const sectionWidth = canvasWidth / 3; // Width of each section
    const sectionHeight = canvasHeight; // Height of each section

    for (let i = 0; i < 3; i++) {
        const pokemonId = pokemonIds[i];

        // Determine the generation folder based on the Pokémon ID
        let genFolder = '';
        if (pokemonId >= 1 && pokemonId <= 151) genFolder = 'gen1';
        else if (pokemonId >= 152 && pokemonId <= 251) genFolder = 'gen2';
        else if (pokemonId >= 252 && pokemonId <= 386) genFolder = 'gen3';
        else if (pokemonId >= 387 && pokemonId <= 493) genFolder = 'gen4';
        else if (pokemonId >= 494 && pokemonId <= 649) genFolder = 'gen5';

        const pokemonImagePath = path.join(__dirname, '..', genFolder, `${pokemonId}.png`);

        try {
            const image = await loadImage(pokemonImagePath);

            // Calculate the section to crop (left, center, or right)
            const sx = i === 0 ? 0 : i === 1 ? image.width / 3 : (image.width / 3) * 2; // Start x-coordinate
            const sw = image.width / 3; // Width of the section
            const sh = image.height; // Height of the section
            const dx = i * sectionWidth; // Destination x-coordinate on the canvas
            const dy = 0; // Destination y-coordinate on the canvas

            // If the Pokémon is guessed or revealing all, show the full section; otherwise, silhouette it
            if (guessed.includes(pokemonId)) {
                ctx.drawImage(image, sx, 0, sw, sh, dx, dy, sectionWidth, sectionHeight);
            } else {
                // Silhouette the Pokémon section
                ctx.drawImage(image, sx, 0, sw, sh, dx, dy, sectionWidth, sectionHeight);
                const imageData = ctx.getImageData(dx, dy, sectionWidth, sectionHeight);
                const data = imageData.data;

                for (let j = 0; j < data.length; j += 4) {
                    const avg = (data[j] + data[j + 1] + data[j + 2]) / 3; // Grayscale
                    data[j] = avg * 0.2; // Darken red
                    data[j + 1] = avg * 0.2; // Darken green
                    data[j + 2] = avg * 0.2; // Darken blue
                }

                ctx.putImageData(imageData, dx, dy);
            }

            // Draw white line between sections
            if (i < 2) {
                ctx.fillStyle = 'white';
                ctx.fillRect((i + 1) * sectionWidth - 2, 0, 4, canvasHeight);
            }
        } catch (err) {
            console.error(`Error loading image for Pokémon ID ${pokemonId}:`, err);
        }
    }

    const outputPath = path.join(__dirname, '..', `daily_${userId}.png`);
    const out = fs.createWriteStream(outputPath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    return new Promise((resolve, reject) => {
        out.on('finish', () => resolve(outputPath));
        out.on('error', reject);
    });
}

// Handle the daily game logic
async function handleDaily(interaction) {
    const userId = interaction.user.id;
    const dailyData = loadDailyData();
    const today = new Date().toISOString().split('T')[0];

    let hasFailed = false; // Track whether the player has already failed

    // Reset daily data if it's a new day
    if (dailyData.lastReset !== today) {
        dailyData.players = {};
        dailyData.lastReset = today;
        saveDailyData(dailyData);
    }

    // Check if the user has already played
    if (dailyData.players[userId]) {
        // Calculate the time until 8 AM Netherlands time
        const now = moment.tz('Europe/Amsterdam');
        const nextReset = moment.tz('Europe/Amsterdam').startOf('day').add(8, 'hours'); // 8 AM Netherlands time

        if (now.isAfter(nextReset)) {
            nextReset.add(1, 'day'); // Move to the next day's 8 AM if the current time is past today's 8 AM
        }

        const timeUntilNextDaily = nextReset.diff(now); // Time difference in milliseconds
        const hours = Math.floor(timeUntilNextDaily / (60 * 60 * 1000));
        const minutes = Math.floor((timeUntilNextDaily % (60 * 60 * 1000)) / (60 * 1000));

        const embed = new EmbedBuilder()
            .setTitle('Daily Pokémon Challenge')
            .setDescription(`You've already played today's challenge! Come back in **${hours}h ${minutes}m**.`)
            .setColor('Red');

        await interaction.reply({ embeds: [embed] });
        return;
    }

    // Generate 3 random Pokémon IDs for this player
    const pokemonIds = generateRandomPokemonIds(3);
    dailyData.players[userId] = {
        streak: dailyData.players[userId]?.streak || 0,
        totalWins: dailyData.players[userId]?.totalWins || 0,
        guessed: [],
        wrongGuesses: 0,
        pokemonIds: pokemonIds // Store the Pokémon IDs for this player
    };
    saveDailyData(dailyData);

    // Create the daily image
    const imagePath = await createDailyImage(pokemonIds, [], userId);

    const embed = new EmbedBuilder()
        .setTitle('Daily Pokémon Challenge')
        .setDescription('Guess the names of the three Pokémon! You can only make 5 wrong guesses. (3 minutes)')
        .setColor('Blue')
        .setImage(`attachment://daily_${userId}.png`);

    await interaction.reply({ embeds: [embed], files: [{ attachment: imagePath, name: `daily_${userId}.png` }] });

    // Handle guesses
    const filter = m => m.author.id === userId;
    const collector = interaction.channel.createMessageCollector({ filter, time: 60000 }); // Timer set to 1 minute

    collector.on('collect', async (message) => {
        const guess = message.content.toLowerCase();
        const correctIndex = pokemonIds.findIndex((id, index) => !dailyData.players[userId].guessed.includes(id) && pokemonData[id].toLowerCase() === guess);

        if (correctIndex !== -1) {
            dailyData.players[userId].guessed.push(pokemonIds[correctIndex]);
            saveDailyData(dailyData);

            // React to the player's message with a green checkmark
            await message.react('✅');

            // Regenerate the image with the guessed Pokémon revealed
            const updatedImagePath = await createDailyImage(pokemonIds, dailyData.players[userId].guessed, userId);

            // Update the existing embed
            const updatedEmbed = new EmbedBuilder()
                .setTitle('Daily Pokémon Challenge')
                .setDescription('Guess the names of the 3 Pokémon! (1MIN)')
                .setColor('Blue')
                .setImage(`attachment://daily_${userId}.png`);

            await interaction.editReply({ embeds: [updatedEmbed], files: [{ attachment: updatedImagePath, name: `daily_${userId}.png` }] });

            // Delete the image file after updating the embed
            fs.unlink(updatedImagePath, (err) => {
                if (err) console.error(`Failed to delete image: ${updatedImagePath}`, err);
            });

            // Check if all Pokémon are guessed
            if (dailyData.players[userId].guessed.length === 3) {
                dailyData.players[userId].streak++;
                dailyData.players[userId].totalWins++; // Increment total wins
                saveDailyData(dailyData);

                const successEmbed = new EmbedBuilder()
                    .setTitle('Daily Pokémon Challenge')
                    .setDescription(`🎉 You guessed all the Pokémon! Your streak is now **${dailyData.players[userId].streak}**.`)
                    .setColor('Green');

                await interaction.editReply({ embeds: [successEmbed] });
                collector.stop();
            }
        } else {
            dailyData.players[userId].wrongGuesses++;
            saveDailyData(dailyData);

            if (dailyData.players[userId].wrongGuesses >= 5 && !hasFailed) {
                hasFailed = true; // Mark the player as failed
                dailyData.players[userId].streak = 0; // Reset streak
                saveDailyData(dailyData);

                // Reveal all Pokémon in full color
                const revealedImagePath = await createDailyImage(pokemonIds, pokemonIds, userId); // Pass all IDs to reveal all Pokémon

                // Get the names of the Pokémon
                const pokemonNames = pokemonIds.map(id => pokemonData[id]).join(' | ');

                const failEmbed = new EmbedBuilder()
                    .setTitle('Daily Pokémon Challenge')
                    .setDescription(`❌ You made 5 wrong guesses! The Pokémon were:\n**${pokemonNames}**`)
                    .setColor('Red')
                    .setImage(`attachment://daily_${userId}.png`);

                await interaction.editReply({ embeds: [failEmbed], files: [{ attachment: revealedImagePath, name: `daily_${userId}.png` }] });

                // Send "Try Again Another Day" embed
                const nextDayEmbed = new EmbedBuilder()
                    .setTitle('Daily Pokémon Challenge')
                    .setDescription('You flopped! You can try again tomorrow!')
                    .setColor('Red');

                await interaction.followUp({ embeds: [nextDayEmbed] });

                // Delete the image file
                fs.unlink(revealedImagePath, (err) => {
                    if (err) console.error(`Failed to delete image: ${revealedImagePath}`, err);
                });

                collector.stop();
            } else {
                await message.reply(`❌ Incorrect guess! You have ${5 - dailyData.players[userId].wrongGuesses} guesses left.`);
            }
        }
    });

    collector.on('end', async () => {
        if ((dailyData.players[userId].guessed.length < 3 || dailyData.players[userId].wrongGuesses >= 5) && !hasFailed) {
            hasFailed = true; // Mark the player as failed

            // Reveal all Pokémon in full color
            const revealedImagePath = await createDailyImage(pokemonIds, pokemonIds, userId); // Pass all IDs to reveal all Pokémon

            // Get the names of the Pokémon
            const pokemonNames = pokemonIds.map(id => pokemonData[id]).join(' | ');

            const updatedEmbed = new EmbedBuilder()
                .setTitle('Daily Pokémon Challenge')
                .setDescription(`❌ You lost! The Pokémon were:\n**${pokemonNames}**`)
                .setColor('Red')
                .setImage(`attachment://daily_${userId}.png`);

            try {
                await interaction.editReply({ embeds: [updatedEmbed], files: [{ attachment: revealedImagePath, name: `daily_${userId}.png` }] });

                // Send "Try Again Another Day" embed
                const nextDayEmbed = new EmbedBuilder()
                    .setTitle('Daily Pokémon Challenge')
                    .setDescription('You flopped! You can try again tomorrow!')
                    .setColor('Red');

                await interaction.followUp({ embeds: [nextDayEmbed] });

                // Delete the image file
                fs.unlink(revealedImagePath, (err) => {
                    if (err) console.error(`Failed to delete image: ${revealedImagePath}`, err);
                });
            } catch (error) {
                console.error('Failed to edit the reply:', error);
            }
        }
    });
}

// Handle the daily leaderboard
async function handleDailyLeaderboard(interaction) {
    // Reload daily data dynamically
    const dailyData = loadDailyData();

    // Sort players by streak (highest to lowest) and limit to top 10
    const sortedStreaks = Object.entries(dailyData.players)
        .sort(([, a], [, b]) => b.streak - a.streak)
        .slice(0, 10);

    const embed = new EmbedBuilder()
        .setTitle('📅 Daily Streak Leaderboard')
        .setColor('Gold');

    for (const [userId, data] of sortedStreaks) {
        try {
            const member = await interaction.guild.members.fetch(userId);
            const username = member ? member.user.username : `User ${userId}`;
            embed.addFields({
                name: username,
                value: `Streak: ${data.streak} | Wins: ${data.totalWins}`,
                inline: false
            });
        } catch (error) {
            console.error(`Could not fetch user for ID ${userId}:`, error);
            embed.addFields({
                name: `User ${userId}`,
                value: `Streak: ${data.streak} | Wins: ${data.totalWins}`,
                inline: false
            });
        }
    }

    await interaction.reply({ embeds: [embed] });
}

// Schedule daily reset at 8 AM Netherlands time
function scheduleDailyReset(client) {
    schedule.scheduleJob('0 8 * * *', async () => {
        const dailyData = loadDailyData();

        // Reset daily-specific fields for each player
        for (const userId in dailyData.players) {
            dailyData.players[userId].guessed = [];
            dailyData.players[userId].wrongGuesses = 0;
            dailyData.players[userId].pokemonIds = [];
        }

        // Update the last reset date
        dailyData.lastReset = new Date().toISOString().split('T')[0];
        saveDailyData(dailyData);

        // Send the streak leaderboard to the specific channel
        const channelId = '759456524341870614'; // Replace with your channel ID
        const channel = await client.channels.fetch(channelId).catch(() => null);

        if (channel) {
            const sortedStreaks = Object.entries(dailyData.players)
                .sort(([, a], [, b]) => b.streak - a.streak) // Sort by streak (highest to lowest)
                .slice(0, 10); // Limit to top 10 players

            const embed = new EmbedBuilder()
                .setTitle('Daily Streak Leaderboard')
                .setColor('Gold');

            sortedStreaks.forEach(([userId, data], index) => {
                const username = `User ${userId}`; // Default username if fetching fails
                embed.addFields({ name: `${index + 1}. ${username}`, value: `Streak: ${data.streak}`, inline: false });
            });

            await channel.send({ embeds: [embed] });
        } else {
            console.error(`Failed to fetch channel with ID ${channelId}.`);
        }
    });
}

module.exports = { handleDaily, handleDailyLeaderboard, scheduleDailyReset };