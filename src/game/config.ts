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
  snack?: Card; // For normal plates (single snack)
  snacks?: Card[]; // For Jade Chalice (multiple snacks)
}

export interface PlayerState {
  waitingArea: WaitingItem[]; // Cards in waiting area (Max 5)
  personalArea: WaitingItem[];
  offeringArea: WaitingItem[];
  actionPoints: number;
  teaTokens: number; // Tea tokens earned from personal area snacks
  teaTokenUsedThisTurn: boolean; // Whether tea token has been used this turn
  tasteDoneThisTurn: boolean; // 每回合只能品鉴一次
}

export interface NotificationState {
  type: "offering" | "gameover" | "info";
  message: string;
  details?: any; // For displaying calculation breakdowns
  timestamp: number;
}

// L3奉献时的选择状态
export interface L3ChoicePending {
  playerId: string;
  slotId: string; // 被奉献的物品ID（已移入奉献区）
}

export interface JadeNightState {
  snackDeck: Card[];
  tablewareDeck: Card[]; // Public draw pile (L1 only)
  rewardDeck: Card[]; // Rewards for offering (L2, L3)
  publicArea: PublicSlot[];
  players: { [key: string]: PlayerState };
  isGameStarted: boolean;
  notification: NotificationState | null;
  l3ChoicePending: L3ChoicePending | null; // L3奉献等待玩家选择
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

// Calculate score for a single snack pairing
// 规则：盘子上的每一个'圈'若被'点'填满，每个填满的圈产生1点配对分
// 例如：双色盘[红+绿]配双色点心[红+绿]，颜色维度得2分
const calculateSinglePairingScore = (tableware: Card, snack: Card): number => {
  const p = tableware.attributes;
  const s = snack.attributes;

  let score = 0;
  
  // Color Match: 每个被点心填满的颜色圈得1分
  for (const c of p.colors) {
    if (s.colors.includes(c)) score += 1;
  }
  
  // Shape Match: 每个被点心填满的形状圈得1分
  for (const sh of p.shapes) {
    if (s.shapes.includes(sh)) score += 1;
  }
  
  // Temp Match: 每个被点心填满的温度圈得1分
  for (const t of p.temps) {
    if (s.temps.includes(t)) score += 1;
  }

  return score;
};

const calculatePairingScore = (item: WaitingItem): number => {
  if (!item.tableware) return 0;

  // Check if this is a Jade Chalice with multiple snacks
  const isJadeChalice = item.tableware.name === "玉盏";

  if (isJadeChalice && item.snacks && item.snacks.length > 0) {
    // 玉盏特殊计分：所有点心的配对分去重后求和
    // 每个点心最多3分（颜色+形状+温度各1分）
    // 同分值只计一次，鼓励收集不同种类的点心
    const uniqueScores = new Set<number>();
    for (const snack of item.snacks) {
      const score = calculateSinglePairingScore(item.tableware, snack);
      uniqueScores.add(score);
    }
    // Sum of unique scores
    let totalScore = 0;
    uniqueScores.forEach((s) => (totalScore += s));
    return totalScore;
  }

  // Normal plate with single snack
  if (!item.snack) return 0;
  return calculateSinglePairingScore(item.tableware, item.snack);
};

const calculateFinalScore = (player: PlayerState) => {
  // S = Sum(P_ind) + Sum(P_off) - C_wait * 2

  // 1. Personal Area Scores (pairing scores)
  const sumP_ind = player.personalArea.reduce((sum, item) => sum + calculatePairingScore(item), 0);

  // 2. Offering Area Scores (pairing scores too)
  const sumP_off = player.offeringArea.reduce((sum, item) => sum + calculatePairingScore(item), 0);

  // 3. Waiting Area Penalty (C_wait) - 只计算有点心的盘子
  const c_wait = player.waitingArea.filter(item => {
    const isJadeChalice = item.tableware?.name === "玉盏";
    return isJadeChalice ? (item.snacks && item.snacks.length > 0) : !!item.snack;
  }).length;

  // 公式: S = Sum(P_ind) + Sum(P_off) - C_wait * 2
  const totalScore = sumP_ind + sumP_off - c_wait * 2;

  return { totalScore, sumP_ind, sumP_off, c_wait };
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
        teaTokens: 0,
        teaTokenUsedThisTurn: false,
        tasteDoneThisTurn: false,
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
      l3ChoicePending: null,
    };
  },

  turn: {
    order: {
      // Custom turn order that only cycles through existing players
      first: () => 0,
      next: ({ G, ctx }) => {
        const playerIds = Object.keys(G.players)
          .map(Number)
          .sort((a, b) => a - b);
        const currentIndex = playerIds.indexOf(Number(ctx.currentPlayer));
        const nextIndex = (currentIndex + 1) % playerIds.length;
        return playerIds[nextIndex];
      },
    },
    onBegin: ({ G, ctx }) => {
      const player = G.players[ctx.currentPlayer];
      if (player) {
        // Base AP = 3. Tea tokens can be used for +1 AP (max 1 per turn).
        player.actionPoints = 3;
        player.teaTokenUsedThisTurn = false; // Reset tea token usage for new turn
        player.tasteDoneThisTurn = false; // 重置每回合品鉴限制
      }
    },
  },

  endIf: ({ G, ctx }) => {
    // Check if Jade Chalice has been distributed
    const jadeDistributed = Object.values(G.players).some(
      (p) =>
        p.waitingArea.some((w) => w.tableware?.name === "玉盏") ||
        p.personalArea.some((w) => w.tableware?.name === "玉盏") ||
        p.offeringArea.some((w) => w.tableware?.name === "玉盏")
    );

    // Check if all L3 plates have been distributed (none left in reward deck)
    const l3PlatesRemaining = G.rewardDeck.filter((c) => c.level === 3).length;
    const allL3Distributed = l3PlatesRemaining === 0;

    // Game ends when both Jade Chalice and all L3 plates are distributed,
    // and we complete a fair round (back to player 0)
    const endConditionMet = jadeDistributed && allL3Distributed;
    const isStartOfRound = ctx.currentPlayer === "0";

    if (endConditionMet && isStartOfRound) {
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

          // 1. C_off higher (奉献区盘数更多者胜)
          const currentC_off = currentWinner.offeringArea.length;
          const newC_off = p.offeringArea.length;
          if (newC_off > currentC_off) {
            winnerId = pid;
          } else if (newC_off === currentC_off) {
            // 2. Personal Area Count lower (个人区盘子数更少者胜)
            if (p.personalArea.length < currentWinner.personalArea.length) {
              winnerId = pid;
            }
          }
        }
      });

      return { scores, winnerId, reason: "jade_and_l3_distributed" };
    }
  },

  moves: {
    // Manual end turn
    endTurn: ({ events }) => {
      events.endTurn();
    },

    // Use a tea token to gain +1 AP (max 1 per turn)
    useTeaToken: ({ G, playerID }) => {
      const player = G.players[playerID];
      if (!player) return INVALID_MOVE;

      // Check if player has tea tokens
      if (player.teaTokens <= 0) return INVALID_MOVE;

      // Check if already used tea token this turn
      if (player.teaTokenUsedThisTurn) return INVALID_MOVE;

      // Use the tea token
      player.teaTokens -= 1;
      player.actionPoints += 1;
      player.teaTokenUsedThisTurn = true;
    },

    startGame: ({ G, random, playerID }, actualPlayerCount?: number) => {
      // Only host (player 0) can start
      if (playerID !== "0") return INVALID_MOVE;
      if (G.isGameStarted) return INVALID_MOVE;

      // Adjust players if count provided
      if (actualPlayerCount && actualPlayerCount >= 2 && actualPlayerCount <= 5) {
        // Remove players > count-1 (since 0-indexed)
        // e.g. Count=3 (0,1,2). Remove 3,4.
        const allIds = Object.keys(G.players).sort();
        allIds.forEach((pid) => {
          if (parseInt(pid) >= actualPlayerCount) {
            delete G.players[pid];
          }
        });
      }

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

      // Initialize AP for current player (基础行动点为3)
      const currentPlayer = G.players[playerID];
      if (currentPlayer) currentPlayer.actionPoints = 3;

      G.isGameStarted = true;
    },

    // Take card from public area
    takeCard: (
      { G, playerID, events },
      { cardId, targetSlotId }: { cardId: string; targetSlotId?: string }
    ) => {
      const pid = playerID || "0";
      const player = G.players[pid];

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

      if (player.actionPoints <= 0) return INVALID_MOVE;

      // Logic for placing card
      if (targetSlotId) {
        // Placing on existing slot (must be Snack on Tableware)
        const waitingSlot = player.waitingArea.find((s) => s.id === targetSlotId);
        if (!waitingSlot) return INVALID_MOVE;

        // Check if this is a Jade Chalice (can stack up to 3 snacks)
        const isJadeChalice = waitingSlot.tableware?.name === "玉盏";

        if (isSnack && waitingSlot.tableware) {
          if (isJadeChalice) {
            // Jade Chalice: can stack up to 3 snacks
            if (!waitingSlot.snacks) {
              waitingSlot.snacks = [];
            }
            // 玉盏最多堆叠3盘点心
            if (waitingSlot.snacks.length >= 3) return INVALID_MOVE;
            waitingSlot.snacks.push(card);
          } else {
            // Normal plate: can only have one snack
            if (waitingSlot.snack) return INVALID_MOVE;
            waitingSlot.snack = card;
          }
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
        if (G.tablewareDeck.length > 0) {
          slot.tableware = G.tablewareDeck.shift();
        }
        // Only add snack if there's a plate to put it on
        if (slot.tableware && G.snackDeck.length > 0) {
          slot.snack = G.snackDeck.shift();
        }
      }

      // Deduct AP
      player.actionPoints -= 1;

      // End turn if no AP
      if (player.actionPoints <= 0) {
        events.endTurn();
      }
    },

    taste: ({ G, playerID, events }, { slotId }: { slotId: string }) => {
      const player = G.players[playerID];
      if (player.actionPoints <= 0) return INVALID_MOVE;

      // 每回合只能品鉴一次点心
      if (player.tasteDoneThisTurn) return INVALID_MOVE;

      const slotIndex = player.waitingArea.findIndex((s) => s.id === slotId);
      if (slotIndex === -1) return INVALID_MOVE;
      const item = player.waitingArea[slotIndex];

      // Must have plate and at least one snack to taste
      const isJadeChalice = item.tableware?.name === "玉盏";
      const hasSnack = isJadeChalice ? item.snacks && item.snacks.length > 0 : !!item.snack;

      if (!item.tableware || !hasSnack) return INVALID_MOVE;

      // Move to personal area
      player.personalArea.push(item);
      player.waitingArea.splice(slotIndex, 1);

      // Tea Token reward: every 2 snacks in personal area grants 1 tea token
      // Check if this completes a pair (2nd, 4th snack)
      if (player.personalArea.length % 2 === 0) {
        player.teaTokens += 1;
      }

      player.actionPoints -= 1;
      player.tasteDoneThisTurn = true; // 标记本回合已品鉴
      if (player.actionPoints <= 0) events.endTurn();
    },

    offer: ({ G, ctx, events, random }, { slotId }: { slotId: string }) => {
      const player = G.players[ctx.currentPlayer];
      if (player.actionPoints <= 0) return INVALID_MOVE;

      // 如果有未完成的L3选择，不允许进行新的奉献
      if (G.l3ChoicePending) return INVALID_MOVE;

      const slotIndex = player.waitingArea.findIndex((s) => s.id === slotId);
      if (slotIndex === -1) return INVALID_MOVE;
      const item = player.waitingArea[slotIndex];

      // Check if this is a Jade Chalice with multiple snacks
      const isJadeChalice = item.tableware?.name === "玉盏";
      const hasSnack = isJadeChalice ? item.snacks && item.snacks.length > 0 : !!item.snack;

      if (!item.tableware || !hasSnack) return INVALID_MOVE;

      // 奉献不需要温度匹配限制

      const currentLevel = item.tableware.level;

      // Move to offering area
      const offeredItemId = item.id;
      player.offeringArea.push(item);
      player.waitingArea.splice(slotIndex, 1);

      player.actionPoints -= 1;

      // 检查是否是L3奉献 - 需要玩家选择
      if (currentLevel === 3) {
        // 检查玉盏是否已经发放
        const jadeAlreadyGiven = Object.values(G.players).some(
          (p) =>
            p.waitingArea.some((w) => w.tableware?.name === "玉盏") ||
            p.personalArea.some((w) => w.tableware?.name === "玉盏") ||
            p.offeringArea.some((w) => w.tableware?.name === "玉盏")
        );

        if (jadeAlreadyGiven) {
          // 玉盏已发放，L3奉献只能获得2茶券
          player.teaTokens += 2;
          G.notification = {
            type: "offering",
            message: "奉献珍宝盘！玉盏已被获取，获得 2枚茶券。",
            details: null,
            timestamp: Date.now(),
          };
          if (player.actionPoints <= 0) events.endTurn();
        } else {
          // 玉盏未发放，设置等待选择状态
          G.l3ChoicePending = {
            playerId: ctx.currentPlayer,
            slotId: offeredItemId,
          };
          G.notification = {
            type: "info",
            message: "奉献珍宝盘！请选择奖励：稳健赏赐(2茶券) 或 博取玉盏(骰子判定)",
            details: null,
            timestamp: Date.now(),
          };
          // 不结束回合，等待选择
        }
        return;
      }

      // --- 非L3奉献的常规奖励逻辑 ---
      const totalOfferings = Object.values(G.players).reduce(
        (sum, p) => sum + p.offeringArea.length,
        0
      );

      let rewardMessage = "";
      let jadeResult = null;
      let grantStandardReward = true;

      // 1. Jade Chalice Judgement
      // Trigger every time total offerings reaches a multiple of 5 (5, 10, 15...)
      // Only if Jade Chalice hasn't been given yet
      const jadeAlreadyGiven = Object.values(G.players).some(
        (p) =>
          p.waitingArea.some((w) => w.tableware?.name === "玉盏") ||
          p.personalArea.some((w) => w.tableware?.name === "玉盏") ||
          p.offeringArea.some((w) => w.tableware?.name === "玉盏")
      );

      // Check if this offering triggers a jade judgment (every 5 offerings)
      const triggersJadeJudgment = totalOfferings > 0 && totalOfferings % 5 === 0;

      if (triggersJadeJudgment && !jadeAlreadyGiven) {
        // Roll 2d6 + C_off >= 12 to succeed (C_off = player's offering count)
        const p_offerings = player.offeringArea.length;

        const d1 = random.D6();
        const d2 = random.D6();
        const baseRoll = d1 + d2;
        const modifiedRoll = baseRoll + p_offerings;
        const success = modifiedRoll >= 12;

        jadeResult = {
          targetScore: 12,
          baseRoll: baseRoll,
          modifier: p_offerings,
          modifiedRoll: modifiedRoll,
          dice: [d1, d2],
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
            description: "玉盏 - 可堆叠三盘点心，同一配对分只计一次",
          };

          player.waitingArea.push({
            id: `jade-card-${Date.now()}`,
            tableware: jadeChalice,
            snack: undefined,
            snacks: [],
          });

          rewardMessage = "判定成功！获得【玉盏】！可在其上堆叠三盘点心。";
          grantStandardReward = false;
        } else {
          rewardMessage = "判定未通过。";
          grantStandardReward = true;
        }
      }

      // 2. Regular Upgrade (Standard Reward)
      if (grantStandardReward) {
        const targetLevel = currentLevel + 1;
        const rewardIndex = G.rewardDeck.findIndex((c) => c.level === targetLevel);

        if (rewardIndex !== -1) {
          const rewardPlate = G.rewardDeck.splice(rewardIndex, 1)[0];
          player.waitingArea.push({
            id: `reward-plate-${Date.now()}`,
            tableware: rewardPlate,
            snack: undefined,
          });
          rewardMessage += ` 获得升级食盘 (L${targetLevel})。`;
        } else {
          if (currentLevel < 3) rewardMessage += ` 牌堆无L${targetLevel}食盘。`;
          else rewardMessage += ` 已达最高等级。`;
        }
      }

      G.notification = {
        type: "offering",
        message: rewardMessage,
        details: jadeResult,
        timestamp: Date.now(),
      };

      if (player.actionPoints <= 0) events.endTurn();
    },

    // L3奉献选择：稳健赏赐（获得2茶券）
    l3ChooseTeaTokens: ({ G, ctx, events }) => {
      if (!G.l3ChoicePending) return INVALID_MOVE;
      if (G.l3ChoicePending.playerId !== ctx.currentPlayer) return INVALID_MOVE;

      const player = G.players[ctx.currentPlayer];
      player.teaTokens += 2;

      G.l3ChoicePending = null;
      G.notification = {
        type: "offering",
        message: "选择稳健赏赐！获得 2枚茶券。",
        details: null,
        timestamp: Date.now(),
      };

      if (player.actionPoints <= 0) events.endTurn();
    },

    // L3奉献选择：博取玉盏（进行骰子判定）
    l3ChooseJadeRoll: ({ G, ctx, events, random }) => {
      if (!G.l3ChoicePending) return INVALID_MOVE;
      if (G.l3ChoicePending.playerId !== ctx.currentPlayer) return INVALID_MOVE;

      const player = G.players[ctx.currentPlayer];
      const p_offerings = player.offeringArea.length;

      const d1 = random.D6();
      const d2 = random.D6();
      const baseRoll = d1 + d2;
      const modifiedRoll = baseRoll + p_offerings;
      const success = modifiedRoll >= 12;

      const jadeResult = {
        targetScore: 12,
        baseRoll: baseRoll,
        modifier: p_offerings,
        modifiedRoll: modifiedRoll,
        dice: [d1, d2],
        success,
      };

      let rewardMessage = "";

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
          level: 4,
          description: "玉盏 - 可堆叠三盘点心，同一配对分只计一次",
        };

        player.waitingArea.push({
          id: `jade-card-${Date.now()}`,
          tableware: jadeChalice,
          snack: undefined,
          snacks: [],
        });

        rewardMessage = "博取玉盏成功！获得【玉盏】！";
      } else {
        rewardMessage = "博取玉盏失败，判定未通过。";
      }

      G.l3ChoicePending = null;
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
