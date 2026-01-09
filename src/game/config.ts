import { Game } from "boardgame.io";
import { INVALID_MOVE } from "boardgame.io/core";
import decksData from "./decks.json";

// --- Card Attributes ---

export type CardType = "Snack" | "Tableware";

export enum CardColor {
  RED = "red",
  GREEN = "green",
  YELLOW = "yellow",
}
export enum CardShape {
  CIRCLE = "circle",
  SQUARE = "square",
  FLOWER = "flower",
}
export enum CardTemp {
  WARM = "warm",
  COLD = "cold",
}

export interface CardAttributes {
  colors: CardColor[];
  shapes: CardShape[];
  temps: CardTemp[];
}

export interface Card {
  id: string;
  type: CardType;
  name: string;
  attributes: CardAttributes;
  level: number; // 1-3 for Snacks and Tableware (higher is better)
  description?: string;
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
  personalArea: WaitingItem[];
  offeringArea: WaitingItem[];
  actionPoints: number;
}

export interface NotificationState {
  type: "offering" | "gameover" | "info";
  message: string;
  details?: any; // For displaying calculation breakdowns
  timestamp: number;
}

export interface JadeNightState {
  snackDeck: Card[];
  tablewareDeck: Card[]; // Public draw pile (L1 only)
  rewardDeck: Card[]; // Rewards for offering (L2, L3)
  publicArea: PublicSlot[];
  players: { [key: string]: PlayerState };
  isGameStarted: boolean;
  notification: NotificationState | null;
}

// --- Helpers ---

export const getGameThresholds = (numPlayers: number) => {
  if (numPlayers === 2) return { endThreshold: 8, jadeThreshold: 5 };
  if (numPlayers === 3) return { endThreshold: 10, jadeThreshold: 6 };
  return { endThreshold: 12, jadeThreshold: 7 }; // 4 or 5 players
};

// Load decks from pre-generated JSON file
const getDecks = (): { snackDeck: Card[]; tablewareDeck: Card[] } => {
  return {
    snackDeck: decksData.snackDeck as Card[],
    tablewareDeck: decksData.tablewareDeck as Card[],
  };
};

// --- Score Logic ---

const calculatePairingScore = (item: WaitingItem): number => {
  if (!item.tableware || !item.snack) return 0;
  const p = item.tableware.attributes;
  const s = item.snack.attributes;

  let score = 0;
  // Color Match
  if (p.colors.some((c) => s.colors.includes(c))) score += 1;
  // Shape Match
  if (p.shapes.some((sh) => s.shapes.includes(sh))) score += 1;
  // Temp Match
  if (p.temps.some((t) => s.temps.includes(t))) score += 1;

  // Level Bonus (Higher level snack = more points)
  if (item.snack.level) {
    score += item.snack.level;
  }

  return score;
};

const calculateFinalScore = (player: PlayerState) => {
  // S = Sum(P_ind) + P_off + C_off - C_wait

  // 1. Personal Area Scores
  const sumP_ind = player.personalArea.reduce((sum, item) => sum + calculatePairingScore(item), 0);

  // 2. Offering Area Scores
  const sumP_off = player.offeringArea.length;

  // 3. Offering Count Bonus (C_off)
  const c_off = player.offeringArea.length;

  // 4. Waiting Area Penalty (C_wait)
  const c_wait = player.waitingArea.length;

  const totalScore = sumP_ind + sumP_off + c_off - c_wait;

  return { totalScore, sumP_ind, sumP_off, c_off, c_wait };
};

export const JadeNightGame: Game<JadeNightState> = {
  name: "jade-night",

  minPlayers: 2,
  maxPlayers: 5,

  setup: ({ ctx }) => {
    const { snackDeck, tablewareDeck } = getDecks();

    // Split tablewareDeck into Public (L1) and Reward (L2+)
    const l1Plates = tablewareDeck.filter((c) => c.level === 1);
    const rewardPlates = tablewareDeck.filter((c) => c.level > 1);

    const players: { [key: string]: PlayerState } = {};
    const numPlayers = ctx.numPlayers || 5;
    for (let i = 0; i < numPlayers; i++) {
      players[i.toString()] = {
        waitingArea: [],
        personalArea: [],
        offeringArea: [],
        actionPoints: 0,
      };
    }

    // Initialize 8 public slots
    const publicArea: PublicSlot[] = [];
    for (let i = 0; i < 8; i++) {
      publicArea.push({ id: `public-slot-${i}` });
    }

    return {
      snackDeck,
      tablewareDeck: l1Plates,
      rewardDeck: rewardPlates,
      publicArea,
      players,
      isGameStarted: false,
      notification: null,
    };
  },

  turn: {
    onBegin: ({ G, ctx }) => {
      const player = G.players[ctx.currentPlayer];
      if (player) {
        const personalCount = player.personalArea.length;
        // Base AP = 2. Bonus AP = +1 for every 2 plates in personal area.
        player.actionPoints = 2 + Math.floor(personalCount / 2);
      }
    },
  },

  endIf: ({ G, ctx }) => {
    const numPlayers = ctx.numPlayers || Object.keys(G.players).length || 2;
    const { endThreshold } = getGameThresholds(numPlayers);

    const totalOfferings = Object.values(G.players).reduce(
      (sum, p) => sum + p.offeringArea.length,
      0
    );

    if (totalOfferings >= endThreshold) {
      // Calculate scores
      const scores: Record<string, any> = {};
      let maxScore = -Infinity;
      let winnerId = "";

      // Tie-breaking: 1. C_off, 2. C_wait (less is better) for Personal Area count? Doc says: "Personal Area Count less is better"
      // Doc: "Tie-break: C_off higher wins; if same, Personal Area count LOWER wins."

      Object.keys(G.players).forEach((pid) => {
        const p = G.players[pid];
        const s = calculateFinalScore(p);
        scores[pid] = s;

        if (s.totalScore > maxScore) {
          maxScore = s.totalScore;
          winnerId = pid;
        } else if (s.totalScore === maxScore) {
          // Tie break
          const currentWinner = G.players[winnerId];
          const currentScore = scores[winnerId];

          // 1. C_off higher
          if (s.c_off > currentScore.c_off) {
            winnerId = pid;
          } else if (s.c_off === currentScore.c_off) {
            // 2. Personal Area Count lower
            if (p.personalArea.length < currentWinner.personalArea.length) {
              winnerId = pid;
            }
          }
        }
      });

      return { scores, winnerId, reason: "limit_reached" };
    }
  },

  moves: {
    startGame: ({ G, random, playerID }) => {
      // Only host (player 0) can start
      if (playerID !== "0") return INVALID_MOVE;
      if (G.isGameStarted) return INVALID_MOVE;

      // Shuffle all decks
      G.snackDeck = random.Shuffle(G.snackDeck);
      G.tablewareDeck = random.Shuffle(G.tablewareDeck); // Only L1
      G.rewardDeck = random.Shuffle(G.rewardDeck); // L2 + L3

      // Distribute 1 L1 plate to each player
      Object.keys(G.players).forEach((pid) => {
        if (G.tablewareDeck.length > 0) {
          const plate = G.tablewareDeck.shift();
          if (plate) {
            G.players[pid].waitingArea.push({
              id: `start-plate-${pid}-${Date.now()}`,
              tableware: plate,
              snack: undefined,
            });
          }
        }
      });

      // Fill public area (from remaining L1 deck)
      G.publicArea.forEach((slot) => {
        if (G.tablewareDeck.length > 0) slot.tableware = G.tablewareDeck.shift();
        if (G.snackDeck.length > 0) slot.snack = G.snackDeck.shift();
      });

      // Initialize AP for current player
      const currentPlayer = G.players[playerID];
      if (currentPlayer) currentPlayer.actionPoints = 2;

      G.isGameStarted = true;
    },

    // Take card from public area
    takeCard: (
      { G, playerID, events },
      { cardId, targetSlotId }: { cardId: string; targetSlotId?: string }
    ) => {
      const pid = playerID || "0";
      const player = G.players[pid];

      if (player.actionPoints <= 0) return INVALID_MOVE;

      // Find card in public area
      const slotIndex = G.publicArea.findIndex(
        (s) => s.tableware?.id === cardId || s.snack?.id === cardId
      );
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
        const waitingSlot = player.waitingArea.find((s) => s.id === targetSlotId);
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
          snack: undefined,
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
    },

    taste: ({ G, playerID, events }, { slotId }: { slotId: string }) => {
      const player = G.players[playerID];
      if (player.actionPoints <= 0) return INVALID_MOVE;

      const slotIndex = player.waitingArea.findIndex((s) => s.id === slotId);
      if (slotIndex === -1) return INVALID_MOVE;
      const item = player.waitingArea[slotIndex];

      // Must have plate and snack to taste (according to rules "Plate + Snack")
      // Rule B: "Move a set of 'Plate+Snack' to personal area"
      if (!item.tableware || !item.snack) return INVALID_MOVE;

      // Check Limit for Personal Area (Max 5)
      if (player.personalArea.length >= 5) return INVALID_MOVE;

      // Move to personal area
      player.personalArea.push(item);
      player.waitingArea.splice(slotIndex, 1);

      player.actionPoints -= 1;
      if (player.actionPoints <= 0) events.endTurn();
    },

    offer: ({ G, ctx, events, random }, { slotId }: { slotId: string }) => {
      const player = G.players[ctx.currentPlayer];
      if (player.actionPoints <= 0) return INVALID_MOVE;

      const slotIndex = player.waitingArea.findIndex((s) => s.id === slotId);
      if (slotIndex === -1) return INVALID_MOVE;
      const item = player.waitingArea[slotIndex];

      if (!item.tableware || !item.snack) return INVALID_MOVE;

      // Validation: Material Match (Temp)
      // Rule C: "Material/Temp dimension must match"
      const hasTempMatch = item.tableware.attributes.temps.some((t) =>
        item.snack!.attributes.temps.includes(t)
      );
      // Note: L3 plates might have all temps, so check attribute intersection.

      if (!hasTempMatch) return INVALID_MOVE;

      // Check Limit for Offering Area (Max 5)
      if (player.offeringArea.length >= 5) return INVALID_MOVE;

      // Move to offering area
      player.offeringArea.push(item);
      player.waitingArea.splice(slotIndex, 1);

      // --- Loyalty Reward Logic ---
      const numPlayers = ctx.numPlayers || Object.keys(G.players).length || 2;
      const { jadeThreshold } = getGameThresholds(numPlayers);
      // Note: totalOfferings should include the one just added? Yes.
      const totalOfferings = Object.values(G.players).reduce(
        (sum, p) => sum + p.offeringArea.length,
        0
      );

      let rewardMessage = "";
      let jadeResult = null;
      let grantStandardReward = true;

      // 1. Jade Chalice Judgement
      // Condition: Total Offerings >= Jade Threshold
      // BUT, Jade Chalice is a unique item. We should only give it if not already given?
      // Or can multiple be given? Doc says "The Jade Chalice". Implying one.
      // Assuming unique for now, but implementation below allows multiple if not checked.
      // To prevent duplicate: check if any player has "Jade Chalice".
      const jadeAlreadyGiven = Object.values(G.players).some(
        (p) =>
          p.waitingArea.some((w) => w.tableware?.name === "玉盏") ||
          p.personalArea.some((w) => w.tableware?.name === "玉盏") ||
          p.offeringArea.some((w) => w.tableware?.name === "玉盏")
      );

      if (totalOfferings >= jadeThreshold && !jadeAlreadyGiven) {
        const n_component = totalOfferings - (jadeThreshold - 1); // e.g. Threshold 10. Curr 10 => 10-(9) = 1.
        const p_offerings = player.offeringArea.length;
        const pair_score = calculatePairingScore(item); // item is what we just offered

        const T = n_component + p_offerings + pair_score;

        const d1 = random.D6();
        const d2 = random.D6();
        const roll = d1 + d2;
        const success = roll < T;

        jadeResult = {
          threshold: T,
          roll: roll,
          dice: [d1, d2],
          components: { n: n_component, p: p_offerings, s: pair_score },
          success,
        };

        if (success) {
          // Grant Jade Chalice
          const jadeChalice: Card = {
            id: `jade-chalice-${Date.now()}`,
            type: "Tableware",
            name: "玉盏",
            attributes: {
              colors: Object.values(CardColor),
              shapes: Object.values(CardShape),
              temps: Object.values(CardTemp),
            },
            level: 4, // Legendary
            description: "玉盏",
          };

          player.waitingArea.push({
            id: `jade-card-${Date.now()}`,
            tableware: jadeChalice,
            snack: undefined,
          });

          rewardMessage = "判定成功！获得【玉盏】！";
          grantStandardReward = false; // Jade replaces standard reward
        } else {
          rewardMessage = "判定未通过。";
          // Fallback to standard reward
          grantStandardReward = true;
        }
      }

      // 2. Regular Upgrade (Standard Reward)
      if (grantStandardReward) {
        const currentLevel = item.tableware.level;
        const targetLevel = currentLevel + 1;
        const rewardIndex = G.rewardDeck.findIndex((c) => c.level === targetLevel);

        if (rewardIndex !== -1) {
          const rewardPlate = G.rewardDeck.splice(rewardIndex, 1)[0];
          // Add to waiting area
          player.waitingArea.push({
            id: `reward-plate-${Date.now()}`,
            tableware: rewardPlate,
            snack: undefined,
          });
          rewardMessage += ` 获得升级食盘 (L${targetLevel})。`;
        } else {
          // No suitable plate? Just get nothing (or maybe score points? implied).
          if (currentLevel < 3) rewardMessage += ` 牌堆无L${targetLevel}食盘。`;
          else rewardMessage += ` 已达最高等级。`;
        }
      }

      player.actionPoints -= 1;

      // Set Notification for UI
      G.notification = {
        type: "offering",
        message: rewardMessage,
        details: jadeResult,
        timestamp: Date.now(),
      };

      if (player.actionPoints <= 0) events.endTurn();
    },
  },
};
