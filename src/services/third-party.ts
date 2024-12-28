// File: src/services/third-party.ts
import { inject, injectable } from 'inversify';
import pRetry from 'p-retry';
import SpotifyWebApi from 'spotify-web-api-node';
import { TYPES } from '../types.js';
import { debugSpotify } from '../utils/debug.js'; // Note the .js extension for ES modules
import Config from './config.js';

@injectable()
export default class ThirdParty {
  readonly spotify: SpotifyWebApi;

  private spotifyTokenTimerId?: NodeJS.Timeout;

  constructor(@inject(TYPES.Config) config: Config) {
    debugSpotify(
      `Initializing Spotify with credentials: clientId=${config.SPOTIFY_CLIENT_ID ? 'present' : 'missing'}, clientSecret=${config.SPOTIFY_CLIENT_SECRET ? 'present' : 'missing'}`,
    );

    this.spotify = new SpotifyWebApi({
      clientId: config.SPOTIFY_CLIENT_ID,
      clientSecret: config.SPOTIFY_CLIENT_SECRET,
    });

    void this.refreshSpotifyToken();
  }

  cleanup() {
    if (this.spotifyTokenTimerId) {
      clearTimeout(this.spotifyTokenTimerId);
    }
  }

  private async refreshSpotifyToken() {
    debugSpotify('Attempting to refresh Spotify token');
    await pRetry(
      async () => {
        try {
          const auth = await this.spotify.clientCredentialsGrant();
          debugSpotify('Successfully obtained Spotify token');
          this.spotify.setAccessToken(auth.body.access_token);
          this.spotifyTokenTimerId = setTimeout(this.refreshSpotifyToken.bind(this), (auth.body.expires_in / 2) * 1000);
        } catch (error) {
          debugSpotify('Error refreshing Spotify token:', error);
          throw error; // Ensure error propagates for retry
        }
      },
      { retries: 5 },
    );
  }
}