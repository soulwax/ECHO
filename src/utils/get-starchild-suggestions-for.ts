// File: src/utils/get-starchild-suggestions-for.ts

import { APIApplicationCommandOptionChoice } from 'discord-api-types/v10';
import StarchildAPI from '../services/starchild-api.js';

const getStarchildSuggestionsFor = async (query: string, starchildAPI: StarchildAPI, limit = 10): Promise<APIApplicationCommandOptionChoice[]> => {
  const songs = await starchildAPI.search(query, limit);

  return songs.map(song => ({
    name: `${song.title} - ${song.artist}`,
    value: `${song.title} ${song.artist}`,
  }));
};

export default getStarchildSuggestionsFor;

