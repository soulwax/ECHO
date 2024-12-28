// File: src/scripts/tests/spotify-test.ts
import debug from 'debug';
import dotenv from 'dotenv';
import 'reflect-metadata';
import SpotifyWebApi from 'spotify-web-api-node';
import { debugSpotify, enableAllDebug } from '../../utils/debug.js';
enableAllDebug();

// Enable debug logs to console
debug.enable('*');

// Load environment variables
dotenv.config();

debugSpotify('Environment loaded: %O', {
  clientId: process.env.SPOTIFY_CLIENT_ID ? 'present' : 'missing',
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET ? 'present' : 'missing',
});

async function testSpotifyConnection() {
  debugSpotify('Starting Spotify connection test');

  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    debugSpotify('Missing Spotify credentials');
    process.exit(1);
  }

  const spotify = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });

  try {
    debugSpotify('Initiating credentials grant request');
    const auth = await spotify.clientCredentialsGrant().catch((error) => {
      debugSpotify('Credentials grant failed: %O', error);
      throw error;
    });

    debugSpotify('Got auth response: %O', {
      expires_in: auth.body.expires_in,
      token_type: auth.body.token_type,
    });

    spotify.setAccessToken(auth.body.access_token);

    debugSpotify('Token set, attempting track fetch');
    const result = await spotify.getTrack('4iV5W9uYEdYUVa79Axb7Rh').catch((error) => {
      debugSpotify('Track fetch failed: %O', error);
      throw error;
    });

    debugSpotify('Track fetch successful');
    debugSpotify('Track data: %O', result.body);

    process.exit(0);
  } catch (error) {
    debugSpotify('Test failed with error: %O', error);
    process.exit(1);
  }
}

// Run the test
testSpotifyConnection().catch((error) => {
  debugSpotify('Unhandled error in test: %O', error);
  process.exit(1);
});