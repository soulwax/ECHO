// File: src/managers/player.ts

import { inject, injectable } from 'inversify';
import FileCacheProvider from '../services/file-cache.js';
import Player from '../services/player.js';
import StarchildAPI from '../services/starchild-api.js';
import { TYPES } from '../types.js';

@injectable()
export default class {
  private readonly guildPlayers: Map<string, Player>;
  private readonly fileCache: FileCacheProvider;
  private readonly starchildAPI: StarchildAPI;

  constructor(@inject(TYPES.FileCache) fileCache: FileCacheProvider, @inject(TYPES.Services.StarchildAPI) starchildAPI: StarchildAPI) {
    this.guildPlayers = new Map();
    this.fileCache = fileCache;
    this.starchildAPI = starchildAPI;
  }

  get(guildId: string): Player {
    let player = this.guildPlayers.get(guildId);

    if (!player) {
      player = new Player(this.fileCache, guildId, this.starchildAPI);

      this.guildPlayers.set(guildId, player);
    }

    return player;
  }
}
