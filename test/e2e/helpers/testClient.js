const { Client, GatewayIntentBits, Partials } = require("discord.js");
const mongoose = require("mongoose");

/**
* Logs a real discord.js Client in against the test bot token. Uses the same
* privileged intents the production bot requests (GuildMembers, MessageContent)
* since the jail commands rely on them (role reads/writes, transcript logging).
*
* @param {string} token
* @returns {Promise<import("discord.js").Client>}
*/
async function createTestClient(token) {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],
        partials: [Partials.GuildMember, Partials.Channel, Partials.Message],
    });

    const ready = new Promise((resolve, reject) => {
        client.once("ready", () => resolve());
        client.once("error", reject);
    });

    await client.login(token);
    await ready;

    return client;
}

/**
* @param {string} mongoUrl
*/
async function connectMongo(mongoUrl) {
    await mongoose.connect(mongoUrl);
    return mongoose;
}

module.exports = { createTestClient, connectMongo };
