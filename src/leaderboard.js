const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const normalScoresFilePath = path.join(__dirname, 'leaderboard.json');
const silhouetteScoresFilePath = path.join(__dirname, 'leaderboard_sil.json');
const spotlightScoresFilePath = path.join(__dirname, 'leaderboard_spotlight.json');

// Load scores from the JSON file when the script starts
function loadScoresFromFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Error loading scores:', err);
    }
    return {};
}

// Load scores for normal mode
let normalScores = loadScoresFromFile(normalScoresFilePath);

// Load scores for silhouette mode
let silhouetteScores = loadScoresFromFile(silhouetteScoresFilePath);

// Load scores for spotlight mode
let spotlightScores = loadScoresFromFile(spotlightScoresFilePath);

function updateScore(userId, mode) {
    let scores;
    switch(mode) {
        case 'silhouette':
            scores = silhouetteScores;
            break;
        case 'spotlight':
            scores = spotlightScores;
            break;
        default:
            scores = normalScores;
    }

    if (!scores[userId]) {
        scores[userId] = 1;
    } else {
        scores[userId]++;
    }

    // Save the updated scores to the JSON file
    saveScoresToFile(mode);
}

async function handleLeaderboard(interaction, mode) {
    // Currently only checks silhouette and normal modes
    let scores;
    switch(mode) {
        case 'silhouette':
            scores = silhouetteScores;
            break;
        case 'spotlight':
            scores = spotlightScores;
            break;
        default:
            scores = normalScores;
    }

    if (Object.keys(scores).length === 0) {
        // If there are no scores yet, send a message indicating that
        const noScoresEmbed = new EmbedBuilder()
            .setTitle(':trophy: Leaderboard')
            .setDescription('No scores yet.');

        await interaction.reply({ embeds: [noScoresEmbed] });
        return;
    }

    const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);
    const embed = new EmbedBuilder()
        .setTitle(`${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode Leaderboard`)
        .setColor('Gold');

    for (const [userId, score] of sortedScores.slice(0, 10)) {
        try {
            const member = await interaction.guild.members.fetch(userId);
            const username = member.user.username;
            embed.addFields({ name: username, value: `Wins: ${score}`, inline: false });
        } catch (error) {
            console.error('Could not fetch user:', error);
            embed.addFields({ name: 'Unknown User', value: `Wins: ${score}`, inline: false });
        }
    }

    await interaction.reply({ embeds: [embed] });
}

// Function to save scores to the JSON file
function saveScoresToFile(mode) {
    let scores, filePath;
    switch(mode) {
        case 'silhouette':
            scores = silhouetteScores;
            filePath = silhouetteScoresFilePath;
            break;
        case 'spotlight':
            scores = spotlightScores;
            filePath = spotlightScoresFilePath;
            break;
        default:
            scores = normalScores;
            filePath = normalScoresFilePath;
    }

    fs.writeFile(filePath, JSON.stringify(scores, null, 2), (err) => {
        if (err) {
            console.error('Error saving scores:', err);
        } else {
            console.log('Scores saved successfully.');
        }
    });
}

module.exports = { handleLeaderboard, updateScore };