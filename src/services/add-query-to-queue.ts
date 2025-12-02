// File: src/services/add-query-to-queue.ts

/* eslint-disable complexity */
import shuffle from 'array-shuffle';
import { ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { inject, injectable } from 'inversify';
import { SponsorBlock } from 'sponsorblock-api';
import PlayerManager from '../managers/player.js';
import GetSongs from '../services/get-songs.js';
import { TYPES } from '../types.js';
import { buildPlayingMessageEmbed } from '../utils/build-embed.js';
import { getMemberVoiceChannel, getMostPopularVoiceChannel } from '../utils/channels.js';
import { ONE_HOUR_IN_SECONDS } from '../utils/constants.js';
import { getGuildSettings } from '../utils/get-guild-settings.js';
import Config from './config.js';
import KeyValueCacheProvider from './key-value-cache.js';
import { MediaSource, STATUS, SongMetadata } from './player.js';

@injectable()
export default class AddQueryToQueue {
  private readonly sponsorBlock?: SponsorBlock;
  private sponsorBlockDisabledUntil?: Date;
  private readonly sponsorBlockTimeoutDelay;
  private readonly cache: KeyValueCacheProvider;

  constructor(@inject(TYPES.Services.GetSongs) private readonly getSongs: GetSongs,
    @inject(TYPES.Managers.Player) private readonly playerManager: PlayerManager,
    @inject(TYPES.Config) private readonly config: Config,
    @inject(TYPES.KeyValueCache) cache: KeyValueCacheProvider) {
    this.sponsorBlockTimeoutDelay = config.SPONSORBLOCK_TIMEOUT;
    this.sponsorBlock = config.ENABLE_SPONSORBLOCK
      ? new SponsorBlock('echo-sb-integration') // UserID matters only for submissions
      : undefined;
    this.cache = cache;
  }

  public async addToQueue({
    query,
    addToFrontOfQueue,
    shuffleAdditions,
    shouldSplitChapters,
    skipCurrentTrack,
    interaction,
  }: {
    query: string;
    addToFrontOfQueue: boolean;
    shuffleAdditions: boolean;
    shouldSplitChapters: boolean;
    skipCurrentTrack: boolean;
    interaction: ChatInputCommandInteraction;
  }): Promise<void> {
    const guildId = interaction.guild!.id;
    const player = this.playerManager.get(guildId);
    const wasPlayingSong = player.getCurrent() !== null;

    const [targetVoiceChannel] = getMemberVoiceChannel(interaction.member as GuildMember) ?? getMostPopularVoiceChannel(interaction.guild!);

    const settings = await getGuildSettings(guildId);

    const {playlistLimit, queueAddResponseEphemeral} = settings;

    await interaction.deferReply({flags: queueAddResponseEphemeral ? MessageFlags.Ephemeral : undefined});

    // For play command, only add one song regardless of playlist limit
    let [newSongs, extraMsg] = await this.getSongs.getSongs(query, 1, shouldSplitChapters);

    if (newSongs.length === 0) {
      throw new Error('no songs found');
    }

    if (shuffleAdditions) {
      newSongs = shuffle(newSongs);
    }

    if (this.config.ENABLE_SPONSORBLOCK) {
      newSongs = await Promise.all(newSongs.map(this.skipNonMusicSegments.bind(this)));
    }

    newSongs.forEach(song => {
      player.add({
        ...song,
        addedInChannelId: interaction.channel!.id,
        requestedBy: interaction.member!.user.id,
      }, {immediate: addToFrontOfQueue ?? false});
    });

    const firstSong = newSongs[0];

    let statusMsg = '';
    let showedEmbed = false;

    if (player.voiceConnection === null) {
      await player.connect(targetVoiceChannel);

      // Resume / start playback
      await player.play();

      if (wasPlayingSong) {
        statusMsg = 'resuming playback';
      }

      const message = await interaction.editReply({
        embeds: [buildPlayingMessageEmbed(player)],
      });
      
      // Set the message for animated progress bar updates
      if (message) {
        player.setNowPlayingMessage(message);
        showedEmbed = true;
      }
    } else if (player.status === STATUS.IDLE) {
      // Player is idle, start playback instead
      await player.play();
    }

    if (skipCurrentTrack) {
      // Only skip if there are more songs in the queue
      if (player.canGoForward(1)) {
        await player.forward(1);
      } else {
        throw new Error('no song to skip to');
      }
    }

    // Build response message
    if (statusMsg !== '') {
      if (extraMsg === '') {
        extraMsg = statusMsg;
      } else {
        extraMsg = `${statusMsg}, ${extraMsg}`;
      }
    }

    if (extraMsg !== '') {
      extraMsg = ` (${extraMsg})`;
    }

    // Only update message if we didn't already show the embed
    // If we showed the embed, keep it animated; otherwise show the text response
    if (!showedEmbed) {
      await interaction.editReply(
        newSongs.length === 1
          ? `**${firstSong.title}** added to the${addToFrontOfQueue ? ' front of the' : ''} queue${skipCurrentTrack ? ' and current track skipped' : ''}${extraMsg}`
          : `**${firstSong.title}** and ${newSongs.length - 1} other songs were added to the queue${skipCurrentTrack ? ' and current track skipped' : ''}${extraMsg}`
      );
    }
  }

  private async skipNonMusicSegments(song: SongMetadata) {
    if (!this.sponsorBlock
          || (this.sponsorBlockDisabledUntil && new Date() < this.sponsorBlockDisabledUntil)
          || song.source !== MediaSource.Starchild
          || !song.url) {
      return song;
    }

    try {
      const segments = await this.cache.wrap(
        async () => this.sponsorBlock?.getSegments(song.url, ['music_offtopic']),
        {
          key: song.url, // Value is too short for hashing
          expiresIn: ONE_HOUR_IN_SECONDS,
        },
      ) ?? [];
      const skipSegments = segments
        .sort((a, b) => a.startTime - b.startTime)
        .reduce((acc: Array<{startTime: number; endTime: number}>, {startTime, endTime}) => {
          const previousSegment = acc[acc.length - 1];
          // If segments overlap merge
          if (previousSegment && previousSegment.endTime > startTime) {
            acc[acc.length - 1].endTime = endTime;
          } else {
            acc.push({startTime, endTime});
          }

          return acc;
        }, []);

      const intro = skipSegments[0];
      const outro = skipSegments.at(-1);
      if (outro && outro?.endTime >= song.length - 2) {
        song.length -= outro.endTime - outro.startTime;
      }

      if (intro?.startTime <= 2) {
        song.offset = Math.floor(intro.endTime);
        song.length -= song.offset;
      }

      return song;
    } catch (e) {
      if (!(e instanceof Error)) {
        console.error('Unexpected event occurred while fetching skip segments : ', e);
        return song;
      }

      if (!e.message.includes('404')) {
        // Don't log 404 response, it just means that there are no segments for given video
        console.warn(`Could not fetch skip segments for "${song.url}" :`, e);
      }

      if (e.message.includes('504')) {
        // Stop fetching SponsorBlock data when servers are down
        this.sponsorBlockDisabledUntil = new Date(new Date().getTime() + (this.sponsorBlockTimeoutDelay * 60_000));
      }

      return song;
    }
  }
}
