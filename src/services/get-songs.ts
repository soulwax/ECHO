// File: src/services/get-songs.ts

import {inject, injectable} from 'inversify';
import ffmpeg from 'fluent-ffmpeg';
import {URL} from 'node:url';
import {SongMetadata, MediaSource} from './player.js';
import {TYPES} from '../types.js';
import StarchildAPI, {StarchildTrack} from './starchild-api.js';

@injectable()
export default class {
  constructor(@inject(TYPES.Services.StarchildAPI) private readonly starchildAPI: StarchildAPI) {}

  async getSongs(query: string, playlistLimit: number, _shouldSplitChapters?: boolean): Promise<[SongMetadata[], string]> {
    const trimmedQuery = query.trim();
    let extraMsg = '';

    const directTrackId = this.extractTrackId(trimmedQuery);

    if (directTrackId) {
      const tracks = await this.starchildAPI.getTracksByIds([directTrackId]);

      if (tracks.length === 0) {
        throw new Error('that doesn\'t exist');
      }

      return [[this.toSongMetadata(tracks[0])], extraMsg];
    }

    // See if it's a URL pointing to a stream
    try {
      const url = new URL(trimmedQuery);
      const deezerId = this.extractTrackIdFromUrl(url);

      if (deezerId) {
        const tracks = await this.starchildAPI.getTracksByIds([deezerId]);

        if (tracks.length === 0) {
          throw new Error('that doesn\'t exist');
        }

        return [[this.toSongMetadata(tracks[0])], extraMsg];
      }

      const stream = await this.httpLiveStream(trimmedQuery);
      return [[stream], extraMsg];
    } catch {
      // fall through to search
    }

    const searchResults = await this.starchildAPI.searchTracks(trimmedQuery, playlistLimit);

    if (searchResults.length === 0) {
      throw new Error('that doesn\'t exist');
    }

    return [searchResults.map(track => this.toSongMetadata(track)), extraMsg];
  }

  private async httpLiveStream(url: string): Promise<SongMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg(url).ffprobe(err => {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          url,
          source: MediaSource.HLS,
          streamUrl: url,
          externalUrl: url,
          isLive: true,
          title: url,
          artist: url,
          length: 0,
          offset: 0,
          playlist: null,
          thumbnailUrl: null,
        });
      });
    });
  }

  private toSongMetadata(track: StarchildTrack): SongMetadata {
    return {
      title: track.title,
      artist: track.artist,
      url: track.id,
      streamUrl: this.starchildAPI.buildStreamUrl(track.id),
      externalUrl: track.link ?? null,
      length: track.duration,
      offset: 0,
      playlist: null,
      isLive: false,
      thumbnailUrl: track.coverUrl ?? null,
      source: MediaSource.Starchild,
    };
  }

  private extractTrackId(query: string): string | null {
    if (/^\d+$/.test(query)) {
      return query;
    }

    return null;
  }

  private extractTrackIdFromUrl(url: URL): string | null {
    if (url.hostname.includes('deezer.com')) {
      const segments = url.pathname.split('/').filter(Boolean);
      const trackIndex = segments.findIndex(segment => segment === 'track');

      if (trackIndex !== -1 && segments[trackIndex + 1]) {
        return segments[trackIndex + 1];
      }
    }

    const streamId = url.searchParams.get('id');
    if (streamId && /^\d+$/.test(streamId)) {
      return streamId;
    }

    return null;
  }
}
