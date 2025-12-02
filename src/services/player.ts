// File: src/services/player.ts

import {
  AudioPlayer,
  AudioPlayerState,
  AudioPlayerStatus, AudioResource,
  createAudioPlayer,
  createAudioResource, DiscordGatewayAdapterCreator,
  joinVoiceChannel,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import type { Setting } from '@prisma/client';
import shuffle from 'array-shuffle';
import { Message, Snowflake, VoiceChannel } from 'discord.js';
import ffmpeg from 'fluent-ffmpeg';
import { WriteStream } from 'fs-capacitor';
import got from 'got';
import hasha from 'hasha';
import { inject } from 'inversify';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'stream';
import { TYPES } from '../types.js';
import { buildPlayingMessageEmbed } from '../utils/build-embed.js';
import { AUDIO_BITRATE_KBPS, AUDIO_PLAYER_MAX_MISSED_FRAMES, HTTP_STATUS_GONE, NOW_PLAYING_UPDATE_INTERVAL_MS, OPUS_OUTPUT_BITRATE_KBPS, VOLUME_DEFAULT, VOLUME_MAX } from '../utils/constants.js';
import debug from '../utils/debug.js';
import { getGuildSettings } from '../utils/get-guild-settings.js';
import FileCacheProvider from './file-cache.js';
import StarchildAPI from './starchild-api.js';

export enum MediaSource {
  Starchild,
  HLS,
}

export interface QueuedPlaylist {
  title: string;
  source: string;
}

export interface SongMetadata {
  title: string;
  artist: string;
  url: string; // For YT, it's the video ID (not the full URI)
  length: number;
  offset: number;
  playlist: QueuedPlaylist | null;
  isLive: boolean;
  thumbnailUrl: string | null;
  source: MediaSource;
}
export interface QueuedSong extends SongMetadata {
  addedInChannelId: Snowflake;
  requestedBy: string;
}

export enum STATUS {
  PLAYING,
  PAUSED,
  IDLE,
}

export interface PlayerEvents {
  statusChange: (oldStatus: STATUS, newStatus: STATUS) => void;
}


export const DEFAULT_VOLUME = VOLUME_DEFAULT;

export default class {
  public voiceConnection: VoiceConnection | null = null;
  public status = STATUS.PAUSED;
  public guildId: string;
  public loopCurrentSong = false;
  public loopCurrentQueue = false;
  private currentChannel: VoiceChannel | undefined;
  private queue: QueuedSong[] = [];
  private queuePosition = 0;
  private audioPlayer: AudioPlayer | null = null;
  private audioResource: AudioResource | null = null;
  private volume?: number;
  private defaultVolume: number = DEFAULT_VOLUME;
  private nowPlaying: QueuedSong | null = null;
  private playPositionInterval: NodeJS.Timeout | undefined;
  private lastSongURL = '';

  private positionInSeconds = 0;
  private readonly fileCache: FileCacheProvider;
  private readonly starchildAPI: StarchildAPI;
  private disconnectTimer: NodeJS.Timeout | null = null;
  private nowPlayingMessage: Message | null = null;
  private embedUpdateInterval: NodeJS.Timeout | undefined;

  private readonly channelToSpeakingUsers = new Map<string, Set<string>>();

  constructor(fileCache: FileCacheProvider, guildId: string, @inject(TYPES.Services.StarchildAPI) starchildAPI: StarchildAPI) {
    this.fileCache = fileCache;
    this.guildId = guildId;
    this.starchildAPI = starchildAPI;
  }

  async connect(channel: VoiceChannel): Promise<void> {
    // Always get freshest default volume setting value
    const settings = await getGuildSettings(this.guildId);
    const {defaultVolume = DEFAULT_VOLUME} = settings;
    this.defaultVolume = defaultVolume;

    this.voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      selfDeaf: false,
      adapterCreator: channel.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
    });

    const guildSettings = await getGuildSettings(this.guildId);

    // Workaround to disable keepAlive
    this.voiceConnection.on('stateChange', (oldState, newState) => {
      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
      const oldNetworking = Reflect.get(oldState, 'networking');
      const newNetworking = Reflect.get(newState, 'networking');

      const networkStateChangeHandler = (_: unknown, newNetworkState: unknown) => {
        const newUdp = Reflect.get(newNetworkState as Record<string, unknown>, 'udp') as {keepAliveInterval?: NodeJS.Timeout} | undefined;
        if (newUdp?.keepAliveInterval) {
          clearInterval(newUdp.keepAliveInterval);
        }
      };

      oldNetworking?.off('stateChange', networkStateChangeHandler);
      newNetworking?.on('stateChange', networkStateChangeHandler);
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

      this.currentChannel = channel;
      if (newState.status === VoiceConnectionStatus.Ready) {
        this.registerVoiceActivityListener(guildSettings);
      }
    });
  }

  disconnect(): void {
    if (this.voiceConnection) {
      if (this.status === STATUS.PLAYING) {
        this.pause();
      }

      this.loopCurrentSong = false;
      this.voiceConnection.destroy();
      this.audioPlayer?.stop(true);

      this.voiceConnection = null;
      this.audioPlayer = null;
      this.audioResource = null;
    }
    this.stopEmbedUpdates();
  }

  async seek(positionSeconds: number): Promise<void> {
    this.status = STATUS.PAUSED;

    if (this.voiceConnection === null) {
      throw new Error('Not connected to a voice channel.');
    }

    const currentSong = this.getCurrent();

    if (!currentSong) {
      throw new Error('No song currently playing');
    }

    if (positionSeconds > currentSong.length) {
      throw new Error('Seek position is outside the range of the song.');
    }

    let realPositionSeconds = positionSeconds;
    let to: number | undefined;
    if (currentSong.offset !== undefined) {
      realPositionSeconds += currentSong.offset;
      to = currentSong.length + currentSong.offset;
    }

    const stream = await this.getStream(currentSong, {seek: realPositionSeconds, to});
    this.audioPlayer = createAudioPlayer({
      behaviors: {
        // Needs to be somewhat high for livestreams
        maxMissedFrames: AUDIO_PLAYER_MAX_MISSED_FRAMES,
      },
    });
    this.voiceConnection.subscribe(this.audioPlayer);
    this.playAudioPlayerResource(this.createAudioStream(stream));
    this.attachListeners();
    this.startTrackingPosition(positionSeconds);

    this.status = STATUS.PLAYING;
  }

  async forwardSeek(positionSeconds: number): Promise<void> {
    return this.seek(this.positionInSeconds + positionSeconds);
  }

  getPosition(): number {
    return this.positionInSeconds;
  }

  async play(): Promise<void> {
    if (this.voiceConnection === null) {
      throw new Error('Not connected to a voice channel.');
    }

    const currentSong = this.getCurrent();

    if (!currentSong) {
      throw new Error('Queue empty.');
    }

    // Cancel any pending idle disconnection
    if (this.disconnectTimer) {
      clearInterval(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    // Resume from paused state
    if (this.status === STATUS.PAUSED && currentSong.url === this.nowPlaying?.url) {
      if (this.audioPlayer) {
        this.audioPlayer.unpause();
        this.status = STATUS.PLAYING;
        this.startTrackingPosition();
        return;
      }

      // Was disconnected, need to recreate stream
      if (!currentSong.isLive) {
        return this.seek(this.getPosition());
      }
    }

    try {
      let positionSeconds: number | undefined;
      let to: number | undefined;
      if (currentSong.offset !== undefined) {
        positionSeconds = currentSong.offset;
        to = currentSong.length + currentSong.offset;
      }

      const stream = await this.getStream(currentSong, {seek: positionSeconds, to});
      this.audioPlayer = createAudioPlayer({
        behaviors: {
          // Needs to be somewhat high for livestreams
          maxMissedFrames: AUDIO_PLAYER_MAX_MISSED_FRAMES,
        },
      });
      this.voiceConnection.subscribe(this.audioPlayer);
      this.playAudioPlayerResource(this.createAudioStream(stream));

      this.attachListeners();

      this.status = STATUS.PLAYING;
      this.nowPlaying = currentSong;

      // Always reset position when starting a new song
      // If it's the same URL, we're seeking/resuming, so preserve position
      // Otherwise, start from the beginning (or offset)
      if (currentSong.url === this.lastSongURL) {
        // Same song - preserve position (for seeking/resuming)
        this.startTrackingPosition(this.positionInSeconds);
      } else {
        // New song - reset position to start (or offset)
        this.startTrackingPosition(positionSeconds ?? 0);
        this.lastSongURL = currentSong.url;
      }

      // Start updating the embed periodically
      this.startEmbedUpdates();
    } catch (error: unknown) {
      await this.forward(1);

      if (this.isHttpError(error, HTTP_STATUS_GONE) && currentSong) {
        const channelId = currentSong.addedInChannelId;

        if (channelId) {
          debug(`${currentSong.title} is unavailable`);
          return;
        }
      }

      throw error;
    }
  }

  pause(): void {
    if (this.status !== STATUS.PLAYING) {
      throw new Error('Not currently playing.');
    }

    this.status = STATUS.PAUSED;

    if (this.audioPlayer) {
      this.audioPlayer.pause();
    }

    this.stopTrackingPosition();
    this.stopEmbedUpdates();
  }

  async forward(skip: number): Promise<void> {
    this.manualForward(skip);

    try {
      if (this.getCurrent() && this.status !== STATUS.PAUSED) {
        await this.play();
      } else {
        this.status = STATUS.IDLE;
        this.audioPlayer?.stop(true);

        const settings = await getGuildSettings(this.guildId);

        const {secondsToWaitAfterQueueEmpties} = settings;
        if (secondsToWaitAfterQueueEmpties !== 0) {
          this.disconnectTimer = setTimeout(() => {
            // Make sure we are not accidentally playing
            // when disconnecting
            if (this.status === STATUS.IDLE) {
              this.disconnect();
            }
          }, secondsToWaitAfterQueueEmpties * 1000);
        }
      }
    } catch (error: unknown) {
      this.queuePosition--;
      throw error;
    }
  }

  registerVoiceActivityListener(guildSettings: Setting) {
    const {turnDownVolumeWhenPeopleSpeak, turnDownVolumeWhenPeopleSpeakTarget} = guildSettings;
    if (!turnDownVolumeWhenPeopleSpeak || !this.voiceConnection) {
      return;
    }

    this.voiceConnection.receiver.speaking.on('start', (userId: string) => {
      if (!this.currentChannel) {
        return;
      }

      const member = this.currentChannel.members.get(userId);
      const channelId = this.currentChannel?.id;

      if (member) {
        if (!this.channelToSpeakingUsers.has(channelId)) {
          this.channelToSpeakingUsers.set(channelId, new Set());
        }

        this.channelToSpeakingUsers.get(channelId)?.add(member.id);
      }

      this.suppressVoiceWhenPeopleAreSpeaking(turnDownVolumeWhenPeopleSpeakTarget);
    });

    this.voiceConnection.receiver.speaking.on('end', (userId: string) => {
      if (!this.currentChannel) {
        return;
      }

      const member = this.currentChannel.members.get(userId);
      const channelId = this.currentChannel.id;
      if (member) {
        if (!this.channelToSpeakingUsers.has(channelId)) {
          this.channelToSpeakingUsers.set(channelId, new Set());
        }

        this.channelToSpeakingUsers.get(channelId)?.delete(member.id);
      }

      this.suppressVoiceWhenPeopleAreSpeaking(turnDownVolumeWhenPeopleSpeakTarget);
    });
  }

  suppressVoiceWhenPeopleAreSpeaking(turnDownVolumeWhenPeopleSpeakTarget: number): void {
    if (!this.currentChannel) {
      return;
    }

    const speakingUsers = this.channelToSpeakingUsers.get(this.currentChannel.id);
    if (speakingUsers && speakingUsers.size > 0) {
      this.setVolume(turnDownVolumeWhenPeopleSpeakTarget);
    } else {
      this.setVolume(this.defaultVolume);
    }
  }

  canGoForward(skip: number) {
    return (this.queuePosition + skip - 1) < this.queue.length;
  }

  manualForward(skip: number): void {
    if (this.canGoForward(skip)) {
      this.queuePosition += skip;
      this.positionInSeconds = 0;
      this.stopTrackingPosition();
    } else {
      throw new Error('No songs in queue to forward to.');
    }
  }

  canGoBack() {
    return this.queuePosition - 1 >= 0;
  }

  async back(): Promise<void> {
    if (this.canGoBack()) {
      this.queuePosition--;
      this.positionInSeconds = 0;
      this.stopTrackingPosition();

      if (this.status !== STATUS.PAUSED) {
        await this.play();
      }
    } else {
      throw new Error('No songs in queue to go back to.');
    }
  }

  getCurrent(): QueuedSong | null {
    if (this.queue[this.queuePosition]) {
      return this.queue[this.queuePosition];
    }

    return null;
  }

  /**
   * Returns queue, not including the current song.
   * @returns {QueuedSong[]}
   */
  getQueue(): QueuedSong[] {
    return this.queue.slice(this.queuePosition + 1);
  }

  add(song: QueuedSong, {immediate = false} = {}): void {
    if (song.playlist || !immediate) {
      // Add to end of queue
      this.queue.push(song);
    } else {
      // Add as the next song to be played
      const insertAt = this.queuePosition + 1;
      this.queue = [...this.queue.slice(0, insertAt), song, ...this.queue.slice(insertAt)];
    }
  }

  shuffle(): void {
    const shuffledSongs = shuffle(this.queue.slice(this.queuePosition + 1));

    this.queue = [...this.queue.slice(0, this.queuePosition + 1), ...shuffledSongs];
  }

  clear(): void {
    const newQueue = [];

    // Don't clear curently playing song
    const current = this.getCurrent();

    if (current) {
      newQueue.push(current);
    }

    this.queuePosition = 0;
    this.queue = newQueue;
  }

  removeFromQueue(index: number, amount = 1): void {
    this.queue.splice(this.queuePosition + index, amount);
  }

  removeCurrent(): void {
    this.queue = [...this.queue.slice(0, this.queuePosition), ...this.queue.slice(this.queuePosition + 1)];
  }

  queueSize(): number {
    return this.getQueue().length;
  }

  isQueueEmpty(): boolean {
    return this.queueSize() === 0;
  }

  stop(): void {
    this.stopEmbedUpdates();
    this.disconnect();
    this.queuePosition = 0;
    this.queue = [];
  }

  move(from: number, to: number): QueuedSong {
    if (from > this.queueSize() || to > this.queueSize()) {
      throw new Error('Move index is outside the range of the queue.');
    }

    this.queue.splice(this.queuePosition + to, 0, this.queue.splice(this.queuePosition + from, 1)[0]);

    return this.queue[this.queuePosition + to];
  }

  setVolume(level: number): void {
    // Level should be a number between 0 and 100 = 0% => 100%
    this.volume = level;
    this.setAudioPlayerVolume(level);
  }

  getVolume(): number {
    // Only use default volume if player volume is not already set (in the event of a reconnect we shouldn't reset)
    return this.volume ?? this.defaultVolume;
  }

  private getHashForCache(url: string): string {
    return hasha(url);
  }

  /**
   * Downloads and caches MP3 file from Starchild API
   * @param song - The song to download
   * @returns Path to cached MP3 file
   */
  private async downloadAndCacheMP3(song: QueuedSong): Promise<string> {
    const cacheKey = `mp3:${song.url}:${AUDIO_BITRATE_KBPS}`;
    const hash = this.getHashForCache(cacheKey);
    
    // Check if already cached
    const cachedPath = await this.fileCache.getPathFor(hash);
    if (cachedPath) {
      debug(`Using cached MP3 for ${song.title}`);
      return cachedPath;
    }

    // Download MP3 file
    debug(`Downloading MP3 for ${song.title} at ${AUDIO_BITRATE_KBPS}kbps...`);
    const streamUrl = this.starchildAPI.getStreamUrl(song.url, {
      kbps: AUDIO_BITRATE_KBPS as number,
    });

    const writeStream = this.fileCache.createWriteStream(hash);
    const downloadStream = got.stream(streamUrl);

    // Wait for pipeline to complete
    await pipeline(downloadStream, writeStream);
    
    // Wait for the file cache write stream's async close handler to complete
    // The close handler moves the file and creates the DB entry asynchronously
    await new Promise<void>((resolve, reject) => {
      const checkCache = async () => {
        let finalPath = await this.fileCache.getPathFor(hash);
        let retries = 5;
        while (!finalPath && retries > 0) {
          await new Promise(r => setTimeout(r, 200));
          finalPath = await this.fileCache.getPathFor(hash);
          retries--;
        }
        if (finalPath) {
          resolve();
        } else {
          reject(new Error('Failed to cache MP3 file - file may not have been written correctly'));
        }
      };

      if (writeStream.closed) {
        // Stream already closed, wait for async handler
        void checkCache();
      } else {
        writeStream.once('close', () => {
          // Wait for async close handler to complete
          void checkCache();
        });
        writeStream.once('error', reject);
      }
    });
    
    const finalPath = await this.fileCache.getPathFor(hash);
    if (!finalPath) {
      throw new Error('Failed to cache MP3 file - file may not have been written correctly');
    }

    debug(`Cached MP3 for ${song.title}`);
    return finalPath;
  }

  private async getStream(song: QueuedSong, options: {seek?: number; to?: number} = {}): Promise<Readable> {
    if (this.status === STATUS.PLAYING) {
      this.audioPlayer?.stop();
    } else if (this.status === STATUS.PAUSED) {
      this.audioPlayer?.stop(true);
    }

    if (song.source === MediaSource.HLS) {
      return this.createReadStream({url: song.url, cacheKey: song.url});
    }

    // Download and cache MP3 file for higher fidelity
    const mp3Path = await this.downloadAndCacheMP3(song);

    const ffmpegInputOptions: string[] = [];

    if (options.seek) {
      ffmpegInputOptions.push('-ss', options.seek.toString());
    }

    if (options.to) {
      ffmpegInputOptions.push('-to', options.to.toString());
    }

    // Use cached MP3 file as input
    return this.createReadStream({
      url: mp3Path,
      cacheKey: song.url,
      ffmpegInputOptions,
      cache: false, // Already cached as MP3
    });
  }

  private startTrackingPosition(initialPosition?: number): void {
    // Always set position explicitly to ensure it's initialized
    // If no initial position provided, use current position (for resuming)
    if (initialPosition !== undefined) {
      this.positionInSeconds = initialPosition;
    }
    // If position is 0 and no initial position provided, ensure we start tracking from 0
    // This handles the case where we're starting a new song

    if (this.playPositionInterval) {
      clearInterval(this.playPositionInterval);
    }

    // Start interval to increment position every second
    this.playPositionInterval = setInterval(() => {
      if (this.status === STATUS.PLAYING) {
        this.positionInSeconds++;
      }
    }, 1000);
  }

  private stopTrackingPosition(): void {
    if (this.playPositionInterval) {
      clearInterval(this.playPositionInterval);
      this.playPositionInterval = undefined;
    }
  }

  /**
   * Sets the message to update with the now-playing embed
   * @param message - The Discord message to update
   */
  setNowPlayingMessage(message: Message | null): void {
    this.nowPlayingMessage = message;
  }

  /**
   * Starts periodically updating the now-playing embed
   */
  private startEmbedUpdates(): void {
    this.stopEmbedUpdates(); // Clear any existing interval

    this.embedUpdateInterval = setInterval(() => {
      if (this.status === STATUS.PLAYING && this.nowPlayingMessage && this.getCurrent()) {
        // Use void to explicitly discard the promise - we handle errors internally
        void (async () => {
          try {
            await this.nowPlayingMessage!.edit({
              embeds: [buildPlayingMessageEmbed(this)],
            });
          } catch (error: unknown) {
            // Message might have been deleted or bot lost permissions
            const errorMessage = error instanceof Error ? error.message : String(error);
            debug(`Failed to update now-playing embed: ${errorMessage}`);
            // Clear the message reference if we can't update it
            if (this.isHttpError(error, 10008)) { // Unknown Message
              this.nowPlayingMessage = null;
              this.stopEmbedUpdates();
            }
          }
        })();
      }
    }, NOW_PLAYING_UPDATE_INTERVAL_MS);
  }

  /**
   * Stops updating the now-playing embed
   */
  private stopEmbedUpdates(): void {
    if (this.embedUpdateInterval) {
      clearInterval(this.embedUpdateInterval);
      this.embedUpdateInterval = undefined;
    }
  }

  private attachListeners(): void {
    if (!this.voiceConnection) {
      return;
    }

    if (this.voiceConnection.listenerCount(VoiceConnectionStatus.Disconnected) === 0) {
      this.voiceConnection.on(VoiceConnectionStatus.Disconnected, this.onVoiceConnectionDisconnect.bind(this));
    }

    if (!this.audioPlayer) {
      return;
    }

    // Remove any existing listeners before adding new ones to prevent duplicates
    // Wrap async handler to avoid Promise return type error - event listeners expect void
    const idleHandler = (_oldState: AudioPlayerState, newState: AudioPlayerState) => {
      void this.onAudioPlayerIdle(_oldState, newState);
    };
    this.audioPlayer.removeListener(AudioPlayerStatus.Idle, idleHandler);
    this.audioPlayer.on(AudioPlayerStatus.Idle, idleHandler);
  }

  private onVoiceConnectionDisconnect(): void {
    this.disconnect();
  }

  private async onAudioPlayerIdle(_oldState: AudioPlayerState, newState: AudioPlayerState): Promise<void> {
    // Automatically advance queued song at end
    if (this.loopCurrentSong && newState.status === AudioPlayerStatus.Idle && this.status === STATUS.PLAYING) {
      await this.seek(0);
      return;
    }

    // Automatically re-add current song to queue
    if (this.loopCurrentQueue && newState.status === AudioPlayerStatus.Idle && this.status === STATUS.PLAYING) {
      const currentSong = this.getCurrent();

      if (currentSong) {
        this.add(currentSong);
      } else {
        throw new Error('No song currently playing.');
      }
    }

    if (newState.status === AudioPlayerStatus.Idle && this.status === STATUS.PLAYING) {
      await this.forward(1);
      // Auto announce the next song if configured to
      const settings = await getGuildSettings(this.guildId);
      const {autoAnnounceNextSong} = settings;
      if (autoAnnounceNextSong && this.currentChannel) {
        await this.currentChannel.send({
          embeds: this.getCurrent() ? [buildPlayingMessageEmbed(this)] : [],
        });
      }
    }
  }

  private async createReadStream(options: {url: string; cacheKey: string; ffmpegInputOptions?: string[]; cache?: boolean; volumeAdjustment?: string}): Promise<Readable> {
    return new Promise((resolve, reject) => {
      const capacitor = new WriteStream();

      if (options?.cache) {
        const cacheStream = this.fileCache.createWriteStream(this.getHashForCache(options.cacheKey));
        capacitor.createReadStream().pipe(cacheStream as unknown as NodeJS.WritableStream);
      }

      const returnedStream = capacitor.createReadStream();
      let hasReturnedStreamClosed = false;

      // Determine if input is a file path or URL
      const isFile = !options.url.startsWith('http://') && !options.url.startsWith('https://');
      const inputOptions = options?.ffmpegInputOptions ?? (isFile ? [] : ['-re']);
      
      const stream = ffmpeg(options.url)
        .inputOptions(inputOptions)
        .noVideo()
        .audioCodec('libopus')
        .outputFormat('webm')
        .audioBitrate(OPUS_OUTPUT_BITRATE_KBPS as number)
        .addOutputOption(['-filter:a', `volume=${options?.volumeAdjustment ?? '1'}`])
        .on('error', error => {
          if (!hasReturnedStreamClosed) {
            reject(error);
          }
        })
        .on('start', command => {
          debug(`Spawned ffmpeg with ${command}`);
        });

      stream.pipe(capacitor);

      returnedStream.on('close', () => {
        if (!options.cache) {
          stream.kill('SIGKILL');
        }

        hasReturnedStreamClosed = true;
      });

      resolve(returnedStream);
    });
  }

  private createAudioStream(stream: Readable) {
    return createAudioResource(stream, {
      inputType: StreamType.WebmOpus,
      inlineVolume: true,
    });
  }

  private playAudioPlayerResource(resource: AudioResource) {
    if (this.audioPlayer !== null) {
      this.audioResource = resource;
      this.setAudioPlayerVolume();
      this.audioPlayer.play(this.audioResource);
    }
  }

  private setAudioPlayerVolume(level?: number) {
    // Audio resource expects a float between 0 and 1 to represent level percentage
    const volumeLevel = level ?? this.getVolume();
    this.audioResource?.volume?.setVolume(volumeLevel / VOLUME_MAX);
  }

  /**
   * Type guard to check if an error is an HTTP error with a specific status code
   * @param error - The error to check
   * @param statusCode - The HTTP status code to check for
   * @returns True if the error has the specified status code
   */
  private isHttpError(error: unknown, statusCode: number): error is {statusCode: number} {
    return typeof error === 'object' && error !== null && 'statusCode' in error && (error as {statusCode: number}).statusCode === statusCode;
  }
}
