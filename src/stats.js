const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const statsFilePath = path.join(__dirname, 'stats.json');

// Load stats from file
function loadStats() {
    try {
        if (fs.existsSync(statsFilePath)) {
            return JSON.parse(fs.readFileSync(statsFilePath, 'utf8'));
        }
    } catch (err) {
        console.error('Error loading stats:', err);
    }
    return { players: {} };
}

// Save stats to file
function saveStats(stats) {
    fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
}

// Update player stats after each game
function updatePlayerStats(userId, gameData) {
    const stats = loadStats();
    if (!stats.players[userId]) {
        stats.players[userId] = {
            gamesPlayed: 0,
            gamesWon: 0,
            totalGuessTime: 0,
            totalCorrectGuesses: 0,
            modeWins: {
                normal: 0,
                silhouette: 0,
                spotlight: 0
            }
        };
    }

    const playerStats = stats.players[userId];
    playerStats.gamesPlayed++;
    if (gameData.won) playerStats.gamesWon++;
    playerStats.totalGuessTime += gameData.guessTime;
    playerStats.totalCorrectGuesses += gameData.correctGuesses;
    playerStats.modeWins[gameData.mode]++;

    saveStats(stats);
}

// Handle stats command
async function handleStats(interaction) {
    const userId = interaction.options.getUser('user')?.id || interaction.user.id;
    const stats = loadStats();
    const playerStats = stats.players[userId] || {
        gamesPlayed: 0,
        gamesWon: 0,
        totalGuessTime: 0,
        totalCorrectGuesses: 0,
        modeWins: { normal: 0, silhouette: 0, spotlight: 0 }
    };

    const winRate = playerStats.gamesPlayed > 0 
        ? ((playerStats.gamesWon / playerStats.gamesPlayed) * 100).toFixed(1)
        : 0;

    const avgGuessTime = playerStats.totalCorrectGuesses > 0
        ? (playerStats.totalGuessTime / playerStats.totalCorrectGuesses).toFixed(1)
        : 0;

    const bestMode = Object.entries(playerStats.modeWins)
        .reduce((a, b) => a[1] > b[1] ? a : b)[0];

    const embed = new EmbedBuilder()
        .setTitle(`${interaction.guild.members.cache.get(userId).user.username}'s Stats`)
        .setColor('Blue')
        .addFields(
            { name: '🎮 Games Played', value: playerStats.gamesPlayed.toString(), inline: false },
            { name: '📊 Win Rate', value: `${winRate}%`, inline: false },
            { name: '⭐ Best Mode', value: bestMode.charAt(0).toUpperCase() + bestMode.slice(1), inline: false },
            { name: '⏱️ Average Guess Time', value: `${avgGuessTime}s`, inline: false }
        );

    await interaction.reply({ embeds: [embed] });
}

module.exports = { updatePlayerStats, handleStats };