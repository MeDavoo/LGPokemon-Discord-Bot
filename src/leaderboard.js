const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

let scores = {};

const scoresFilePath = path.join(__dirname, 'leaderboard.json'); // Path to the JSON file

function getScores() {
    return scores;
}

function updateScore(userId) {
    if (!scores[userId]) {
        scores[userId] = 1;
    } else {
        scores[userId]++;
    }

    // Save the updated scores to the JSON file
    saveScoresToFile();
}

async function handleLeaderboard(interaction) {
    const scores = getScores();

    if (Object.keys(scores).length === 0) {
        // If there are no scores yet, send a message indicating that
        const noScoresEmbed = new EmbedBuilder()
            .setTitle(':trophy: Leaderboard')
            .setDescription('No scores yet.');

        await interaction.reply({ embeds: [noScoresEmbed] });
        return;
    }

    const sortedScores = Object.entries(scores).sort(([, score1], [, score2]) => score2 - score1);

    const leaderboardEmbed = new EmbedBuilder()
        .setTitle(':trophy: Leaderboard')
        .setColor('Blue');

    sortedScores.forEach(([userId, score], index) => {
        const member = interaction.guild.members.cache.get(userId);
        const username = member ? member.user.username : 'Unknown';
        leaderboardEmbed.addFields({ name: `${index + 1}. ${username}`, value: `Wins: ${score}` });
    });

    await interaction.reply({ embeds: [leaderboardEmbed] });
}

// Function to save scores to the JSON file
function saveScoresToFile() {
    fs.writeFile(scoresFilePath, JSON.stringify(scores, null, 2), (err) => {
        if (err) {
            console.error('Error saving scores:', err);
        } else {
            console.log('Scores saved successfully.');
        }
    });
}

// Load scores from the JSON file when the script starts
function loadScoresFromFile() {
    fs.readFile(scoresFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error loading scores:', err);
        } else {
            try {
                scores = JSON.parse(data);
                console.log('Scores loaded successfully.');
            } catch (error) {
                console.error('Error parsing scores:', error);
            }
        }
    });
}

// Load scores from the file when the script starts
loadScoresFromFile();

module.exports = { handleLeaderboard, updateScore, getScores };