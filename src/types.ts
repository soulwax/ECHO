// File: src/types.ts

export const TYPES = {
  Bot: Symbol('Bot'),
  KeyValueCache: Symbol('KeyValueCache'),
  FileCache: Symbol('FileCache'),
  Client: Symbol('Client'),
  Config: Symbol('Config'),
  Command: Symbol('Command'),
  Managers: {
    Player: Symbol('PlayerManager'),
  },
  Services: {
    AddQueryToQueue: Symbol('AddQueryToQueue'),
    GetSongs: Symbol('GetSongs'),
    StarchildAPI: Symbol('StarchildAPI'),
  },
};
