require('dotenv').config();
const { REST, Routes } = require('discord.js');

const commands = [
    {
        name: 'poke',
        description: 'Pokemon Guessing Game',
        options: [
            {
                name: 'generation',
                description: 'Generation Number (1-8)',
                type: 4,
                choices: [
                    { name: 'random', value: 0 }, // Add this line
                    { name: 'one', value: 1 },
                    { name: 'two', value: 2 },
                    { name: 'three', value: 3 },
                    { name: 'four', value: 4 },
                    { name: 'five', value: 5 },
                    { name: 'six', value: 6 },
                    { name: 'seven', value: 7 },
                    { name: 'eight', value: 8 }
                ],
                required: true,
            },
            {
                name: 'rounds',
                description: 'Number of Rounds',
                type: 4,
                choices: [
                    { name: '5', value: 5 },
                    { name: '10', value: 10 },
                    { name: '15', value: 15 },
                    { name: '20', value: 20 },
                    { name: '25', value: 25 },
                ],
                required: true,
            },
            {
                name: 'silhouette',
                description: 'Guess pokemons based only on their silhouette',
                type: 5, // Set type to 5 for boolean option
                required: false,
            },
        ],
    },
    {
        name: 'leaderboard',
        description: 'Displays the leaderboard of total wins',
        type: 1,
        options: [
            {
                name: 'mode',
                description: 'Game mode',
                type: 3, // STRING
                required: true,
                choices: [
                    { name: 'Normal', value: 'normal' },
                    { name: 'Silhouette', value: 'silhouette' }
                ]
            }
        ]
    },
    {
        name: 'stop',
        description: 'Force stop any active Pokémon game',
        type: 1
    },
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log('Commands registered successfully.');
    } catch (error) {
        console.error(`Error registering commands: ${error.message}`);
    }
})();