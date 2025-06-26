const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const statsFilePath = path.join(__dirname, 'stats.json');
const normalScoresFilePath = path.join(__dirname, 'leaderboard.json');
const silhouetteScoresFilePath = path.join(__dirname, 'leaderboard_sil.json');
const spotlightScoresFilePath = path.join(__dirname, 'leaderboard_spotlight.json');
const dailyStatsFilePath = path.join(__dirname, 'daily_stats.json'); // Path to daily stats file

// Add this function to get total wins across all modes
function getTotalLeaderboardWins(userId) {
    let totalWins = 0;
    
    // Load and sum up wins from each leaderboard file
    try {
        // Normal mode wins
        if (fs.existsSync(normalScoresFilePath)) {
            const normalScores = JSON.parse(fs.readFileSync(normalScoresFilePath, 'utf8'));
            totalWins += normalScores[userId] || 0;
        }
        
        // Silhouette mode wins
        if (fs.existsSync(silhouetteScoresFilePath)) {
            const silhouetteScores = JSON.parse(fs.readFileSync(silhouetteScoresFilePath, 'utf8'));
            totalWins += silhouetteScores[userId] || 0;
        }
        
        // Spotlight mode wins
        if (fs.existsSync(spotlightScoresFilePath)) {
            const spotlightScores = JSON.parse(fs.readFileSync(spotlightScoresFilePath, 'utf8'));
            totalWins += spotlightScores[userId] || 0;
        }
    } catch (err) {
        console.error('Error loading leaderboard scores:', err);
    }
    
    return totalWins;
}

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

function saveStats(stats) {
    fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
}

// New function to load daily stats
function loadDailyData() {
    try {
        if (fs.existsSync(dailyStatsFilePath)) {
            return JSON.parse(fs.readFileSync(dailyStatsFilePath, 'utf8'));
        }
    } catch (err) {
        console.error('Error loading daily stats:', err);
    }
    return { players: {} };
}

// Updated to track actual games and leaderboard wins
function updatePlayerStats(userId, gameData) {
    const stats = loadStats();
    const dailyData = loadDailyData();

    if (!stats.players[userId]) {
        stats.players[userId] = {
            gamesPlayed: 0,
            leaderboardWins: 0,
            totalGuessTime: 0,
            totalCorrectGuesses: 0,
            modeWins: {
                normal: 0,
                silhouette: 0,
                spotlight: 0
            },
            bestStreak: 0 // Initialize best streak
        };
    }

    const playerStats = stats.players[userId];
    const dailyPlayerData = dailyData.players[userId] || { streak: 0 };

    // Update best streak if the current streak is higher
    if (dailyPlayerData.streak > playerStats.bestStreak) {
        playerStats.bestStreak = dailyPlayerData.streak;
    }

    // Update other stats (e.g., games played, leaderboard wins, etc.)
    if (gameData.isNewGame) {
        playerStats.gamesPlayed++;
    }

    if (gameData.gotLeaderboardPoint) {
        playerStats.leaderboardWins++;
        playerStats.modeWins[gameData.mode]++;
    }

    if (gameData.guessTime) {
        playerStats.totalGuessTime += gameData.guessTime;
        playerStats.totalCorrectGuesses += gameData.correctGuesses;
    }

    saveStats(stats);
}

async function handleStats(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;
    const stats = loadStats();
    const dailyData = require('./daily.json'); // Load daily data directly

    // Initialize default stats if player doesn't exist
    if (!stats.players[userId]) {
        stats.players[userId] = {
            gamesPlayed: 0,
            leaderboardWins: 0,
            totalGuessTime: 0,
            totalCorrectGuesses: 0,
            modeWins: {
                normal: 0,
                silhouette: 0,
                spotlight: 0
            },
            bestStreak: 0 // Initialize best streak
        };
        saveStats(stats);
    }

    const playerStats = stats.players[userId];
    const dailyStats = dailyData.players[userId] || { streak: 0, totalWins: 0 }; // Default values if user hasn't played daily

    let username;
    try {
        const member = await interaction.guild.members.fetch(userId);
        username = member.user.username;
    } catch (error) {
        console.error('Could not fetch user:', error);
        username = 'Unknown User';
    }

    const embed = new EmbedBuilder()
        .setTitle(`${username}'s Stats`)
        .setColor('Blue')
        .addFields(
            { name: '🎮 Games Played', value: (playerStats.gamesPlayed || 0).toString(), inline: false },
            { name: '🏆 Leaderboard Wins', value: (playerStats.leaderboardWins || 0).toString(), inline: false },
            { name: '📊 Daily Wins', value: (dailyStats.totalWins || 0).toString(), inline: false },
            { name: '🔥 Best Streak', value: (playerStats.bestStreak || 0).toString(), inline: false }, // Display best streak
            { name: '⏱️ Average Guess Time', value: `${(playerStats.totalGuessTime / (playerStats.totalCorrectGuesses || 1)).toFixed(1)}s`, inline: false }
        );

    await interaction.reply({ embeds: [embed] });
}

module.exports = { updatePlayerStats, handleStats };