import { Game } from 'boardgame.io';

export interface JadeNightState {
  players: {
    [key: string]: {
      position: number;
    };
  };
}

export const JadeNightGame: Game<JadeNightState> = {
  name: 'jade-night',

  setup: () => ({
    players: {
      '0': { position: 0 },
      '1': { position: 0 },
    },
  }),

  moves: {
    move: ({ G, playerID }, amount: number) => {
      const pid = playerID || '0';
      G.players[pid].position += amount;
    },
  },

  endIf: ({ G }) => {
    if (G.players['0'].position >= 10) {
      return { winner: '0' };
    }
    if (G.players['1'].position >= 10) {
      return { winner: '1' };
    }
  },
};
