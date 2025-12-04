// File: src/bot.ts

import { REST } from '@discordjs/rest';
import { generateDependencyReport } from '@discordjs/voice';
import { Routes } from 'discord-api-types/v10';
import { AutocompleteInteraction, ButtonInteraction, ChatInputCommandInteraction, Client, Collection, Interaction, MessageFlags, User } from 'discord.js';
import { inject, injectable } from 'inversify';
import ora from 'ora';
import Command from './commands/index.js';
import handleGuildCreate from './events/guild-create.js';
import handleVoiceStateUpdate from './events/voice-state-update.js';
import container from './inversify.config.js';
import Config from './services/config.js';
import HealthServer from './services/health-server.js';
import { TYPES } from './types.js';
import { isUserInVoice } from './utils/channels.js';
import debug from './utils/debug.js';
import errorMsg from './utils/error-msg.js';
import registerCommandsOnGuild from './utils/register-commands-on-guild.js';

/**
 * Discord API version constant
 */
const DISCORD_API_VERSION = '10' as const;

/**
 * Bot permissions constant (required permissions for the bot)
 * Calculated as: Manage Channels (16) + Connect (1048576) + Speak (2097152) + Use Voice Activity (33554432)
 */
const BOT_REQUIRED_PERMISSIONS = 36700160;

@injectable()
export default class {
  private readonly client: Client;
  private readonly config: Config;
  private readonly shouldRegisterCommandsOnBot: boolean;
  private readonly commandsByName!: Collection<string, Command>;
  private readonly commandsByButtonId!: Collection<string, Command>;

  constructor(@inject(TYPES.Client) client: Client, @inject(TYPES.Config) config: Config) {
    this.client = client;
    this.config = config;
    this.shouldRegisterCommandsOnBot = config.REGISTER_COMMANDS_ON_BOT;
    this.commandsByName = new Collection();
    this.commandsByButtonId = new Collection();
  }

  public async register(): Promise<void> {
    // Load in commands
    for (const command of container.getAll<Command>(TYPES.Command)) {
      // Make sure we can serialize to JSON without errors
      try {
        command.slashCommand.toJSON();
      } catch (error) {
        console.error(error);
        throw new Error(`Could not serialize /${command.slashCommand.name ?? ''} to JSON`);
      }

      if (command.slashCommand.name) {
        this.commandsByName.set(command.slashCommand.name, command);
      }

      if (command.handledButtonIds) {
        for (const buttonId of command.handledButtonIds) {
          this.commandsByButtonId.set(buttonId, command);
        }
      }
    }

    // Register event handlers
    this.client.on('interactionCreate', interaction => this.handleInteraction(interaction));

    const spinner = ora('📡 connecting to Discord...').start();

    this.client.once('ready', async () => {
      debug(generateDependencyReport());

      // Update commands
      const rest = new REST({version: DISCORD_API_VERSION}).setToken(this.config.DISCORD_TOKEN);
      if (this.shouldRegisterCommandsOnBot) {
        spinner.text = '📡 updating commands on bot...';
        await rest.put(
          Routes.applicationCommands(this.client.user!.id),
          {body: this.commandsByName.map(command => command.slashCommand.toJSON())},
        );
      } else {
        spinner.text = '📡 updating commands in all guilds...';

        await Promise.all([
          ...this.client.guilds.cache.map(async guild => {
            await registerCommandsOnGuild({
              rest,
              guildId: guild.id,
              applicationId: this.client.user!.id,
              commands: this.commandsByName.map(c => c.slashCommand),
            });
          }),
          // Remove commands registered on bot (if they exist)
          rest.put(Routes.applicationCommands(this.client.user!.id), {body: []}),
        ],
        );
      }

      this.client.user!.setPresence({
        activities: [
          {
            name: this.config.BOT_ACTIVITY,
            type: this.config.BOT_ACTIVITY_TYPE,
            url: this.config.BOT_ACTIVITY_URL === '' ? undefined : this.config.BOT_ACTIVITY_URL,
          },
        ],
        status: this.config.BOT_STATUS,
      });

      spinner.succeed(`Ready! Invite the bot with https://discordapp.com/oauth2/authorize?client_id=${this.client.user?.id ?? ''}&scope=bot%20applications.commands&permissions=${BOT_REQUIRED_PERMISSIONS}`);
    });

    this.client.on('error', console.error);
    this.client.on('debug', debug);

    this.client.on('guildCreate', handleGuildCreate);
    this.client.on('voiceStateUpdate', handleVoiceStateUpdate);
    await this.client.login();
  }

  /**
   * Handles incoming Discord interactions (commands, buttons, autocomplete)
   * @param interaction - The Discord interaction to handle
   */
  private async handleInteraction(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isCommand() && interaction.isChatInputCommand()) {
        await this.handleCommandInteraction(interaction);
      } else if (interaction.isButton()) {
        await this.handleButtonInteraction(interaction);
      } else if (interaction.isAutocomplete()) {
        await this.handleAutocompleteInteraction(interaction);
      }
    } catch (error: unknown) {
      await this.handleInteractionError(interaction, error);
    }
  }

  /**
   * Handles command interactions
   * @param interaction - The command interaction to handle
   */
  private async handleCommandInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commandsByName.get(interaction.commandName);

    if (!command || !interaction.isChatInputCommand()) {
      return;
    }

    if (!interaction.guild) {
      await interaction.reply(errorMsg('you can\'t use this bot in a DM'));
      return;
    }

    const requiresVC = command.requiresVC instanceof Function ? command.requiresVC(interaction) : command.requiresVC;
    if (requiresVC && interaction.member && !isUserInVoice(interaction.guild, interaction.member.user as User)) {
      await interaction.reply({content: errorMsg('You must be in a voice channel'), flags: MessageFlags.Ephemeral});
      return;
    }

    if (command.execute) {
      await command.execute(interaction);
    }
  }

  /**
   * Handles button interactions
   * @param interaction - The button interaction to handle
   */
  private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    const command = this.commandsByButtonId.get(interaction.customId);

    if (!command) {
      return;
    }

    if (command.handleButtonInteraction) {
      await command.handleButtonInteraction(interaction);
    }
  }

  /**
   * Handles autocomplete interactions
   * @param interaction - The autocomplete interaction to handle
   */
  private async handleAutocompleteInteraction(interaction: AutocompleteInteraction): Promise<void> {
    const command = this.commandsByName.get(interaction.commandName);

    if (!command) {
      return;
    }

    if (command.handleAutocompleteInteraction) {
      await command.handleAutocompleteInteraction(interaction);
    }
  }

  /**
   * Handles errors that occur during interaction processing
   * @param interaction - The interaction that caused the error
   * @param error - The error that occurred
   */
  private async handleInteractionError(interaction: Interaction, error: unknown): Promise<void> {
    debug(error);

    // This can fail if the message was deleted, and we don't want to crash the whole bot
    try {
      const isCommandOrButton = interaction.isCommand() || interaction.isButton();
      const canEdit = isCommandOrButton && (interaction.replied || interaction.deferred);

      if (canEdit) {
        await interaction.editReply(errorMsg(this.normalizeError(error)));
      } else if (isCommandOrButton) {
        await interaction.reply({content: errorMsg(this.normalizeError(error)), flags: MessageFlags.Ephemeral});
      }
    } catch {
      // Silently fail if we can't send error message (e.g., message was deleted)
    }
  }

  /**
   * Normalizes an unknown error to an Error object
   * @param error - The error to normalize
   * @returns An Error object
   */
  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    if (typeof error === 'string') {
      return new Error(error);
    }
    return new Error('Unknown error occurred');
  }
}
