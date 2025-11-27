import {inject, injectable} from 'inversify';
import got, {Got} from 'got';
import {TYPES} from '../types.js';
import Config from './config.js';

export interface StarchildTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  album?: string;
  coverUrl?: string | null;
  link?: string | null;
}

interface DeezerSearchTrack {
  id: number | string;
  title: string;
  artist: {
    name: string;
  };
  duration: number;
  album?: {
    title?: string;
    cover_xl?: string;
    cover_big?: string;
    cover_medium?: string;
  };
  link?: string;
}

interface DeezerBatchTrack {
  id: string;
  title: string;
  titleShort?: string;
  artistName: string;
  albumTitle?: string;
  duration: number;
  coverXl?: string;
  coverBig?: string;
  coverMedium?: string;
  link?: string;
}

@injectable()
export default class StarchildAPI {
  private readonly client: Got;
  private readonly streamingKey: string;
  private readonly apiUrl: string;

  constructor(@inject(TYPES.Config) config: Config) {
    this.streamingKey = config.STREAMING_KEY;
    this.apiUrl = config.API_URL;
    this.client = got.extend({
      prefixUrl: this.apiUrl,
      responseType: 'json',
      timeout: {
        request: 15000,
      },
    });
  }

  async searchTracks(query: string, limit: number): Promise<StarchildTrack[]> {
    if (!query) {
      return [];
    }

    const response = await this.client
      .get('music/search', {
        searchParams: {
          q: query,
        },
      })
      .json<{data?: DeezerSearchTrack[]}>();

    const results = response.data ?? [];
    return results.slice(0, limit).map(track => this.normalizeSearchTrack(track));
  }

  async getTracksByIds(ids: string[]): Promise<StarchildTrack[]> {
    if (ids.length === 0) {
      return [];
    }

    const response = await this.client
      .get('music/tracks/batch', {
        searchParams: {
          ids: ids.join(','),
        },
      })
      .json<DeezerBatchTrack[]>();

    return response.map(track => this.normalizeBatchTrack(track));
  }

  buildStreamUrl(trackId: string, options: {offset?: number; kbps?: number} = {}): string {
    const url = new URL('music/stream', this.apiUrl);
    url.searchParams.set('key', this.streamingKey);
    url.searchParams.set('id', trackId);

    if (typeof options.kbps === 'number') {
      url.searchParams.set('kbps', String(options.kbps));
    }

    if (typeof options.offset === 'number') {
      url.searchParams.set('offset', String(options.offset));
    }

    return url.toString();
  }

  private normalizeSearchTrack(track: DeezerSearchTrack): StarchildTrack {
    return {
      id: String(track.id),
      title: track.title,
      artist: track.artist.name,
      duration: track.duration,
      album: track.album?.title,
      coverUrl: track.album?.cover_xl ?? track.album?.cover_big ?? track.album?.cover_medium ?? null,
      link: track.link ?? null,
    };
  }

  private normalizeBatchTrack(track: DeezerBatchTrack): StarchildTrack {
    return {
      id: track.id,
      title: track.title ?? track.titleShort ?? 'Unknown title',
      artist: track.artistName,
      duration: track.duration,
      album: track.albumTitle,
      coverUrl: track.coverXl ?? track.coverBig ?? track.coverMedium ?? null,
      link: track.link ?? null,
    };
  }
}

