// File: src/commands/play.ts

import {AutocompleteInteraction, ChatInputCommandInteraction} from 'discord.js';
import {URL} from 'url';
import {SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder} from '@discordjs/builders';
import {inject, injectable} from 'inversify';
import Command from './index.js';
import {TYPES} from '../types.js';
import KeyValueCacheProvider from '../services/key-value-cache.js';
import {ONE_HOUR_IN_SECONDS} from '../utils/constants.js';
import AddQueryToQueue from '../services/add-query-to-queue.js';
import StarchildAPI, {StarchildTrack} from '../services/starchild-api.js';
import {truncate} from '../utils/string.js';

@injectable()
export default class implements Command {
  public readonly slashCommand: Partial<SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder> & Pick<SlashCommandBuilder, 'toJSON'>;

  public requiresVC = true;

  private readonly starchildAPI: StarchildAPI;
  private readonly cache: KeyValueCacheProvider;
  private readonly addQueryToQueue: AddQueryToQueue;

  constructor(@inject(TYPES.Services.StarchildAPI) starchildAPI: StarchildAPI, @inject(TYPES.KeyValueCache) cache: KeyValueCacheProvider, @inject(TYPES.Services.AddQueryToQueue) addQueryToQueue: AddQueryToQueue) {
    this.starchildAPI = starchildAPI;
    this.cache = cache;
    this.addQueryToQueue = addQueryToQueue;

    const queryDescription = 'Track ID, Deezer URL, or search query';

    this.slashCommand = new SlashCommandBuilder()
      .setName('play')
      .setDescription('play a song')
      .addStringOption(option => option
        .setName('query')
        .setDescription(queryDescription)
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

    const suggestionChoices = await this.cache.wrap(
      async (searchQuery: string, limit: number) => this.buildSuggestions(searchQuery, limit),
      query,
      10,
      {
        expiresIn: ONE_HOUR_IN_SECONDS,
        key: `autocomplete:${query}`,
      });

    await interaction.respond(suggestionChoices);
  }

  private async buildSuggestions(query: string, limit: number) {
    const tracks = await this.starchildAPI.searchTracks(query, limit);

    return tracks.map(track => ({
      name: this.formatSuggestion(track),
      value: track.id,
    }));
  }

  private formatSuggestion(track: StarchildTrack) {
    const base = `${track.title} — ${track.artist}`;
    return truncate(base, 100);
  }
}
