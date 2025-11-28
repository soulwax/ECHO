// File: src/services/starchild-api.ts

import got, { Got } from 'got';
import { inject, injectable } from 'inversify';
import { TYPES } from '../types.js';
import { ONE_HOUR_IN_SECONDS } from '../utils/constants.js';
import Config from './config.js';
import KeyValueCacheProvider from './key-value-cache.js';
import { MediaSource, SongMetadata } from './player.js';

interface DeezerSearchResult {
  id: number;
  title: string;
  title_short: string;
  duration: number;
  artist: {
    id: number;
    name: string;
  };
  album: {
    id: number;
    title: string;
    cover: string;
    cover_medium: string;
    cover_big: string;
  };
  preview?: string;
  link: string;
}

interface DeezerSearchResponse {
  data: DeezerSearchResult[];
  total: number;
  next?: string;
}

@injectable()
export default class {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly httpClient: Got;
  private readonly cache: KeyValueCacheProvider;

  constructor(@inject(TYPES.Config) config: Config, @inject(TYPES.KeyValueCache) cache: KeyValueCacheProvider) {
    this.apiKey = config.STARCHILD_API_KEY;
    this.baseUrl = config.STARCHILD_BASE_URL ?? 'https://api.starchildmusic.com';
    this.cache = cache;

    this.httpClient = got.extend({
      prefixUrl: this.baseUrl,
      timeout: {
        request: 30000,
      },
    });
  }

  async search(query: string, limit = 10): Promise<SongMetadata[]> {
    return this.cache.wrap(
      async (q: string, lim: number) => {
        const response = await this.httpClient.get<DeezerSearchResponse>('music/search', {
          searchParams: {
            q,
            offset: 0,
          },
        }).json<DeezerSearchResponse>();

        return response.data.slice(0, lim).map((track) => ({
          title: track.title,
          artist: track.artist.name,
          url: track.id.toString(), // Use Deezer ID for streaming
          length: track.duration,
          offset: 0,
          playlist: null,
          isLive: false,
          thumbnailUrl: track.album.cover_medium || track.album.cover || null,
          source: MediaSource.Starchild,
        }));
      },
      query,
      limit,
      {
        key: `starchild:search:${query}:${limit}`,
        expiresIn: ONE_HOUR_IN_SECONDS,
      },
    );
  }

  getStreamUrl(trackId: string, options?: { kbps?: number; offset?: number }): string {
    const params = new URLSearchParams({
      key: this.apiKey,
      id: trackId,
    });

    if (options?.kbps) {
      params.set('kbps', options.kbps.toString());
    }

    if (options?.offset) {
      params.set('offset', options.offset.toString());
    }

    return `${this.baseUrl}/music/stream?${params.toString()}`;
  }
}

