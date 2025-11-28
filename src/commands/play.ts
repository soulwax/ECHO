// File: src/commands/play.ts

import { SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from '@discordjs/builders';
import { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import { URL } from 'url';
import AddQueryToQueue from '../services/add-query-to-queue.js';
import KeyValueCacheProvider from '../services/key-value-cache.js';
import StarchildAPI from '../services/starchild-api.js';
import { TYPES } from '../types.js';
import { ONE_HOUR_IN_SECONDS } from '../utils/constants.js';
import getStarchildSuggestionsFor from '../utils/get-starchild-suggestions-for.js';
import Command from './index.js';

@injectable()
export default class implements Command {
  public readonly slashCommand: (SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder) & Pick<SlashCommandBuilder, 'toJSON'>;

  public requiresVC = true;

  private readonly cache: KeyValueCacheProvider;
  private readonly addQueryToQueue: AddQueryToQueue;
  private readonly starchildAPI: StarchildAPI;

  constructor(@inject(TYPES.KeyValueCache) cache: KeyValueCacheProvider, @inject(TYPES.Services.AddQueryToQueue) addQueryToQueue: AddQueryToQueue, @inject(TYPES.Services.StarchildAPI) starchildAPI: StarchildAPI) {
    this.cache = cache;
    this.addQueryToQueue = addQueryToQueue;
    this.starchildAPI = starchildAPI;

    this.slashCommand = new SlashCommandBuilder()
      .setName('play')
      .setDescription('play a song')
      .addStringOption(option => option
        .setName('query')
        .setDescription('search query or HLS stream URL')
        .setAutocomplete(true)
        .setRequired(true))
      .addBooleanOption(option => option
        .setName('immediate')
        .setDescription('add track to the front of the queue'))
      .addBooleanOption(option => option
        .setName('shuffle')
        .setDescription('shuffle the input if you\'re adding multiple tracks'))
      .addBooleanOption(option => option
        .setName('split')
        .setDescription('if a track has chapters, split it'))
      .addBooleanOption(option => option
        .setName('skip')
        .setDescription('skip the currently playing track'));
  }

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const query = interaction.options.getString('query')!;

    await this.addQueryToQueue.addToQueue({
      interaction,
      query: query.trim(),
      addToFrontOfQueue: interaction.options.getBoolean('immediate') ?? false,
      shuffleAdditions: interaction.options.getBoolean('shuffle') ?? false,
      shouldSplitChapters: interaction.options.getBoolean('split') ?? false,
      skipCurrentTrack: interaction.options.getBoolean('skip') ?? false,
    });
  }

  public async handleAutocompleteInteraction(interaction: AutocompleteInteraction): Promise<void> {
    const query = interaction.options.getString('query')?.trim();

    if (!query || query.length === 0) {
      await interaction.respond([]);
      return;
    }

    try {
      // Don't return suggestions for URLs
      // eslint-disable-next-line no-new
      new URL(query);
      await interaction.respond([]);
      return;
    } catch {}

    const suggestions = await this.cache.wrap(
      getStarchildSuggestionsFor,
      query,
      this.starchildAPI,
      10,
      {
        expiresIn: ONE_HOUR_IN_SECONDS,
        key: `autocomplete:${query}`,
      });

    await interaction.respond(suggestions);
  }
}
