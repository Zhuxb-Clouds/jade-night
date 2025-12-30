import { Game } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import cardsData from '../../cards.json';

export type CardType = 'Snack' | 'Tableware';

export interface Card {
  id: string;
  type: CardType;
  name: string;
  // Visual pattern for matching: [Color, Shape, Material]
  // 1 means present (Dot for Snack, Circle for Tableware), 0 means absent
  pattern: [number, number, number]; 
}

export interface PublicSlot {
  id: string;
  tableware?: Card;
  snack?: Card;
}

export interface WaitingItem {
  id: string;
  tableware?: Card;
  snack?: Card;
}

export interface PlayerState {
  waitingArea: WaitingItem[]; // Cards in waiting area (Max 5)
  personalArea: any[];
  offeringArea: any[];
  actionPoints: number;
}

export interface JadeNightState {
  snackDeck: Card[];
  tablewareDeck: Card[];
  publicArea: PublicSlot[];
  players: { [key: string]: PlayerState };
  isGameStarted: boolean;
}

// Helper to generate decks
const generateDecks = () => {
  const snackDeck: Card[] = [];
  const tablewareDeck: Card[] = [];
  const patterns = cardsData.patterns as [number, number, number][];

  let idCounter = 0;

  // Generate Snacks (Dots)
  patterns.forEach(p => {
      cardsData.types.Snack.forEach(snackTemplate => {
          snackDeck.push({
              id: `snack-${idCounter++}`,
              type: 'Snack',
              name: snackTemplate.name,
              pattern: p
          });
      });
  });

  // Generate Tableware (Circles)
  patterns.forEach(p => {
      cardsData.types.Tableware.forEach(plateTemplate => {
          tablewareDeck.push({
              id: `plate-${idCounter++}`,
              type: 'Tableware',
              name: plateTemplate.name,
              pattern: p
          });
      });
  });

  return { snackDeck, tablewareDeck };
};

export const JadeNightGame: Game<JadeNightState> = {
  name: 'jade-night',

  minPlayers: 2,
  maxPlayers: 5,

  setup: ({ ctx }) => {
    const { snackDeck, tablewareDeck } = generateDecks();
    
    const players: { [key: string]: PlayerState } = {};
    const numPlayers = ctx.numPlayers || 5;
    for (let i = 0; i < numPlayers; i++) {
        players[i.toString()] = {
            waitingArea: [],
            personalArea: [],
            offeringArea: [],
            actionPoints: 0
        };
    }

    // Initialize 8 public slots
    const publicArea: PublicSlot[] = [];
    for (let i = 0; i < 8; i++) {
        publicArea.push({ id: `public-slot-${i}` });
    }

    return {
      snackDeck,
      tablewareDeck,
      publicArea,
      players,
      isGameStarted: false,
    };
  },

  turn: {
      onBegin: ({ G, ctx }) => {
          G.players[ctx.currentPlayer].actionPoints = 2;
      }
  },

  moves: {
    startGame: ({ G, random, playerID }) => {
        // Only host (player 0) can start
        if (playerID !== '0') return INVALID_MOVE;
        if (G.isGameStarted) return INVALID_MOVE;
        
        // Shuffle decks
        G.snackDeck = random.Shuffle(G.snackDeck);
        G.tablewareDeck = random.Shuffle(G.tablewareDeck);
        
        // Distribute 1 plate to each player
        Object.keys(G.players).forEach(pid => {
            if (G.tablewareDeck.length > 0) {
                const plate = G.tablewareDeck.shift();
                if (plate) {
                    G.players[pid].waitingArea.push({
                        id: `start-plate-${pid}-${Date.now()}`,
                        tableware: plate,
                        snack: undefined
                    });
                }
            }
        });

        // Fill public area
        G.publicArea.forEach(slot => {
            if (G.tablewareDeck.length > 0) slot.tableware = G.tablewareDeck.shift();
            if (G.snackDeck.length > 0) slot.snack = G.snackDeck.shift();
        });
        
        // Initialize AP for current player (since onBegin might have run before start)
        // Actually, onBegin runs when turn starts. If we start game, we might need to set AP manually if turn doesn't change.
        // But usually startGame is a move in the first turn.
        // Let's ensure current player has AP.
        const currentPlayer = G.players[playerID];
        if (currentPlayer) currentPlayer.actionPoints = 2;
        
        G.isGameStarted = true;
    },
    
    // Take card from public area
    takeCard: ({ G, playerID, events }, { cardId, targetSlotId }: { cardId: string, targetSlotId?: string }) => {
        const pid = playerID || '0';
        const player = G.players[pid];
        
        if (player.actionPoints <= 0) return INVALID_MOVE;

        // Find card in public area
        const slotIndex = G.publicArea.findIndex(s => s.tableware?.id === cardId || s.snack?.id === cardId);
        if (slotIndex === -1) return INVALID_MOVE;
        const slot = G.publicArea[slotIndex];
        
        let card: Card | undefined;
        let isSnack = false;

        // Logic: Must take Snack first if present
        if (slot.snack && slot.snack.id === cardId) {
            card = slot.snack;
            isSnack = true;
        } else if (!slot.snack && slot.tableware && slot.tableware.id === cardId) {
            card = slot.tableware;
            isSnack = false;
        } else {
            // Trying to take Tableware while Snack is present
            return INVALID_MOVE;
        }

        if (!card) return INVALID_MOVE;

        // Logic for placing card
        if (targetSlotId) {
            // Placing on existing slot (must be Snack on Tableware)
            const waitingSlot = player.waitingArea.find(s => s.id === targetSlotId);
            if (!waitingSlot) return INVALID_MOVE;
            
            // Can only place Snack on empty Tableware
            if (isSnack && waitingSlot.tableware && !waitingSlot.snack) {
                waitingSlot.snack = card;
            } else {
                return INVALID_MOVE;
            }
        } else {
            // Placing in new slot
            // Constraint: Snack CANNOT be placed in new slot (must go to existing plate)
            if (isSnack) return INVALID_MOVE;

            if (player.waitingArea.length >= 5) return INVALID_MOVE;
            
            const newItem: WaitingItem = {
                id: `slot-${Date.now()}-${Math.random()}`,
                tableware: card,
                snack: undefined
            };
            player.waitingArea.push(newItem);
        }

        // Remove from public slot
        if (isSnack) {
            slot.snack = undefined;
        } else {
            slot.tableware = undefined;
        }

        // Refresh slot if empty
        if (!slot.snack && !slot.tableware) {
            if (G.tablewareDeck.length > 0) slot.tableware = G.tablewareDeck.shift();
            if (G.snackDeck.length > 0) slot.snack = G.snackDeck.shift();
        }

        // Deduct AP
        player.actionPoints -= 1;

        // End turn if AP is 0
        if (player.actionPoints <= 0) {
            events.endTurn();
        }
    }
  },
};
