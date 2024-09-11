const { Client, GatewayIntentBits, EmbedBuilder, ChannelType } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
    ]
});

// JSON file paths
const BLACKLIST_FILE = './blacklistedUsers.json';
const CHANNELS_FILE = './channels.json';
const MANAGE_ROLE_FILE = './manageRole.json';

// Load data from JSON files
let blacklistedUsers = loadJSON(BLACKLIST_FILE) || [];
let channels = loadJSON(CHANNELS_FILE) || { sourceChannel: '', destinationChannel: '' };
let manageRole = loadJSON(MANAGE_ROLE_FILE) || { roleId: '' }; // Single management role ID

// Helper function to load JSON
function loadJSON(file) {
    if (fs.existsSync(file)) {
        try {
            const data = fs.readFileSync(file, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading ${file}:`, error);
            return null;
        }
    } else {
        return null;
    }
}

// Helper function to save JSON
function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// Initialize the bot and setup slash commands
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName('sethostchannel')
            .setDescription('Set the host channel in this server.')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('Select the host channel')
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('setrecipientchannel')
            .setDescription('Set the recipient channel in the recipient server.')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('Select the recipient channel')
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('blacklist')
            .setDescription('Manage blacklisted users')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('add')
                    .setDescription('Add a user to the blacklist')
                    .addUserOption(option => option.setName('user').setDescription('User to blacklist').setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('remove')
                    .setDescription('Remove a user from the blacklist')
                    .addUserOption(option => option.setName('user').setDescription('User to remove from the blacklist').setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('View the blacklisted users')),
        new SlashCommandBuilder()
            .setName('setmanagerole')
            .setDescription('Set the manage role for controlling the bot.')
            .addRoleOption(option =>
                option.setName('role')
                    .setDescription('Select the role to manage the bot')
                    .setRequired(true)),
    ].map(command => command.toJSON());

    await client.application.commands.set(commands);
});

// Function to check if the user has the manage role in any of the servers the bot is in
async function userHasManageRoleInAnyServer(user) {
    if (!manageRole.roleId) return false; // No role set yet

    // Check all guilds the bot is connected to
    for (const guild of client.guilds.cache.values()) {
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (member && member.roles.cache.has(manageRole.roleId)) {
            return true;
        }
    }
    return false;
}

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    // First, check if the command is related to setting the manage role
    if (commandName === 'setmanagerole') {
        // Allow setting the manage role only if:
        // 1. No manage role has been set yet (anyone can set it initially)
        // 2. The user has the manage role if it's already set
        if (!manageRole.roleId) {
            // No role has been set, allow setting it
            const role = interaction.options.getRole('role');
            manageRole.roleId = role.id; // Store the manage role
            saveJSON(MANAGE_ROLE_FILE, manageRole);
            return interaction.reply(`Manage role set to ${role.name}`);
        } else {
            // Role is already set, check if the user has the manage role
            const hasManageRole = await userHasManageRoleInAnyServer(interaction.user);
            if (!hasManageRole) {
                return interaction.reply({ content: 'You do not have the required role to change the manage role.', ephemeral: true });
            }

            // Allow user with manage role to change it
            const role = interaction.options.getRole('role');
            manageRole.roleId = role.id; // Update the manage role
            saveJSON(MANAGE_ROLE_FILE, manageRole);
            return interaction.reply(`Manage role updated to ${role.name}`);
        }
    }

    // Check if the user has the manage role in any server
    const hasManageRole = await userHasManageRoleInAnyServer(interaction.user);
    if (!manageRole.roleId) {
        return interaction.reply({ content: 'The manage role has not been set yet. Use /setmanagerole to set a role.', ephemeral: true });
    }
    if (!hasManageRole) {
        return interaction.reply({ content: 'You do not have the required role to use this command.', ephemeral: true });
    }

    // Process other commands after checking for manage role
    if (commandName === 'sethostchannel') {
        const channel = interaction.options.getChannel('channel');
        if (channel.type !== ChannelType.GuildText) {
            return interaction.reply('Please select a text channel.');
        }
        channels.sourceChannel = channel.id;
        saveJSON(CHANNELS_FILE, channels);
        return interaction.reply(`Host channel set to ${channel.name}`);
    } else if (commandName === 'setrecipientchannel') {
        const channel = interaction.options.getChannel('channel');
        if (channel.type !== ChannelType.GuildText) {
            return interaction.reply('Please select a text channel.');
        }
        channels.destinationChannel = channel.id;
        saveJSON(CHANNELS_FILE, channels);
        return interaction.reply(`Recipient channel set to ${channel.name}`);
    } else if (commandName === 'blacklist') {
        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser('user');

        if (subcommand === 'add') {
            if (!blacklistedUsers.includes(user.id)) {
                blacklistedUsers.push(user.id);
                saveJSON(BLACKLIST_FILE, blacklistedUsers);
                return interaction.reply({ content: `${user.username} has been added to the blacklist.`, ephemeral: true });
            } else {
                return interaction.reply({ content: `${user.username} is already blacklisted.`, ephemeral: true });
            }
        } else if (subcommand === 'remove') {
            if (blacklistedUsers.includes(user.id)) {
                blacklistedUsers = blacklistedUsers.filter(id => id !== user.id);
                saveJSON(BLACKLIST_FILE, blacklistedUsers);
                return interaction.reply({ content: `${user.username} has been removed from the blacklist.`, ephemeral: true });
            } else {
                return interaction.reply({ content: `${user.username} is not in the blacklist.`, ephemeral: true });
            }
        } else if (subcommand === 'list') {
            if (blacklistedUsers.length === 0) {
                return interaction.reply({ content: 'The blacklist is empty.', ephemeral: true });
            } else {
                const list = blacklistedUsers.map(id => `<@${id}>`).join('\n');
                return interaction.reply({ content: `Blacklisted users:\n${list}`, ephemeral: true });
            }
        }
    }
});

// Helper function to handle attachments
async function handleAttachments(message, embed, destinationChannel) {
    if (message.attachments.size > 0) {
        let hasImage = false;
        message.attachments.forEach(attachment => {
            if (attachment.contentType.startsWith('image')) {
                embed.setImage(attachment.url);
                hasImage = true;
            } else if (attachment.contentType.startsWith('video')) {
                destinationChannel.send(attachment.url);
            }
        });
        return hasImage;
    }
    return false;
}

// Single event listener for message handling and replies
client.on('messageCreate', async (message) => {
    // Ignore bot messages, blacklisted users, and messages from channels not set
    if (message.author.bot || blacklistedUsers.includes(message.author.id)) return;
    if (!channels.sourceChannel || !channels.destinationChannel) return;

    // Handle source channel messages
    if (message.channel.id === channels.sourceChannel) {
        const member = await message.guild.members.fetch(message.author.id);
        const profilePicture = member.displayAvatarURL({ dynamic: true });
        const embed = new EmbedBuilder()
            .setAuthor({ name: member.nickname || member.user.username, iconURL: profilePicture })
            .setTimestamp(message.createdTimestamp)
            .setFooter({ text: `Posted in ${message.guild.name}` });

        if (message.content.trim().length > 0) {
            embed.setDescription(message.content);
        }

        const destinationChannel = await client.channels.fetch(channels.destinationChannel);
        const hasImage = await handleAttachments(message, embed, destinationChannel);

        if (message.content.trim().length > 0 || hasImage) {
            const sentMessage = await destinationChannel.send({ embeds: [embed] });
            if (sentMessage) {
                messageMap.set(sentMessage.id, { originalMessageId: message.id, originalChannelId: message.channel.id });
            }
        }
    }

    // Handle replies in the destination channel
    if (message.channel.id === channels.destinationChannel && message.reference) {
        const repliedToMessage = await message.channel.messages.fetch(message.reference.messageId);

        if (messageMap.has(repliedToMessage.id)) {
            const { originalMessageId, originalChannelId } = messageMap.get(repliedToMessage.id);
            const originalChannel = await client.channels.fetch(originalChannelId);
            const originalMessage = await originalChannel.messages.fetch(originalMessageId);

            const replyEmbed = new EmbedBuilder()
                .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp(message.createdTimestamp)
                .setFooter({ text: `Reply to your post in ${message.guild.name}` });

            if (message.content.trim().length > 0) {
                replyEmbed.setDescription(message.content);
            }

            const hasImage = await handleAttachments(message, replyEmbed, originalChannel);

            if (message.content.trim().length > 0 || hasImage) {
                originalMessage.reply({ embeds: [replyEmbed] });
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
