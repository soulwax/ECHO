// File: src/scripts/tests/spotify-play-tests.ts
// src/scripts/tests/spotify-play-test.ts
import { container } from '../../inversify.config.js';
import GetSongs from '../../services/get-songs.js';
import { TYPES } from '../../types.js';
import { debugSpotify } from '../../utils/debug.js';

async function testSpotifyPlayFlow() {
  debugSpotify('Starting Spotify play flow test');

  const getSongs = container.get<GetSongs>(TYPES.Services.GetSongs);

  try {
    debugSpotify('Testing with a Spotify track URL');
    const [songs, extraMsg] = await getSongs.getSongs(
      'spotify:track:4iV5W9uYEdYUVa79Axb7Rh', // Your test track
      50, // playlistLimit
      false, // shouldSplitChapters
    );

    debugSpotify('Got songs: %O', songs);
    debugSpotify('Extra message: %s', extraMsg);

    process.exit(0);
  } catch (error) {
    debugSpotify('Test failed: %O', error);
    process.exit(1);
  }
}

testSpotifyPlayFlow().catch(console.error);
