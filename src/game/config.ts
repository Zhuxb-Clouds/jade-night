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
  snack?: Card; // 公共区只有点心槽位，盘子从单独的抽取堆获取
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
  hasJadeChalice: boolean; // 是否持有玉盏
}

export interface NotificationState {
  type: "offering" | "gameover" | "info";
  message: string;
  details?: any; // For displaying calculation breakdowns
  timestamp: number;
}

// L3奉献时的选择状态 - 不再需要，改为敬茶机制
// export interface L3ChoicePending {
//   playerId: string;
//   slotId: string;
// }

export interface JadeNightState {
  snackDeck: Card[];
  tablewareDeck: Card[]; // Public draw pile (L1 only)
  rewardDeck: Card[]; // Rewards for offering (L2, L3)
  publicArea: PublicSlot[];
  players: { [key: string]: PlayerState };
  isGameStarted: boolean;
  notification: NotificationState | null;
  jadeGiven: boolean; // 玉盏是否已被发放
  endConditionTriggeredAtRound: number | null; // 结束条件触发时的回合数，用于公平轮判定
}

// --- Helpers ---

export const getGameThresholds = (numPlayers: number) => {
  if (numPlayers === 2) return { endThreshold: 8, jadeThreshold: 5 };
  if (numPlayers === 3) return { endThreshold: 10, jadeThreshold: 6 };
  return { endThreshold: 12, jadeThreshold: 7 }; // 4 or 5 players
};

// Load decks from pre-generated JSON file
export const getDecks = (): { snackDeck: Card[]; tablewareDeck: Card[] } => {
  return {
    snackDeck: decksData.snackDeck as Card[],
    tablewareDeck: decksData.tablewareDeck as Card[],
  };
};

// --- Score Logic ---

// Calculate score for a single snack pairing
// 规则：盘子上的每一个'圈'若被'点'填满，每个填满的圈产生1点配对分
// 例如：双色盘[红+绿]配双色点心[红+绿]，颜色维度得2分
export const calculateSinglePairingScore = (tableware: Card, snack: Card): number => {
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

export const calculatePairingScore = (item: WaitingItem): number => {
  if (!item.tableware) return 0;

  // Normal plate with single snack
  if (!item.snack) return 0;
  return calculateSinglePairingScore(item.tableware, item.snack);
};

export const calculateFinalScore = (player: PlayerState) => {
  // S = Sum(P_ind) + C_off + teaTokens - C_wait * 2
  // 文档公式：个人区配对分 + 奉献区数量 + 剩余茶券 - 滞留惩罚
  // 如果有玉盏，则C_off*2

  // 1. Personal Area Scores (pairing scores)
  const sumP_ind = player.personalArea.reduce((sum, item) => sum + calculatePairingScore(item), 0);

  // 2. Offering Area Count (只计数量，不计配对分)
  let c_off = player.offeringArea.length;
  // 玉盏持有者奉献分翻倍
  if (player.hasJadeChalice) {
    c_off = c_off * 2;
  }

  // 3. Remaining Tea Tokens
  const teaTokens = player.teaTokens;

  // 4. Waiting Area Penalty (C_wait) - 只计算有点心的盘子
  const c_wait = player.waitingArea.filter((item) => {
    return !!item.snack;
  }).length;

  // 公式: S = Sum(P_ind) + C_off + teaTokens - C_wait * 2
  const totalScore = sumP_ind + c_off + teaTokens - c_wait * 2;

  return { totalScore, sumP_ind, c_off, teaTokens, c_wait, hasJadeChalice: player.hasJadeChalice };
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
        hasJadeChalice: false,
      };
    }

    // Initialize 5 public slots (文档规定：公共区牌列设置为5个槽位)
    const publicArea: PublicSlot[] = [];
    for (let i = 0; i < 5; i++) {
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
      jadeGiven: false,
      endConditionTriggeredAtRound: null,
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

      // 检查结束条件是否触发，如果是则记录当前回合数
      if (G.endConditionTriggeredAtRound === null) {
        const l2PlatesRemaining = G.rewardDeck.filter((c) => c.level === 2).length;
        const allL2Distributed = l2PlatesRemaining === 0;
        const endConditionMet = allL2Distributed;

        if (endConditionMet) {
          // 记录结束条件触发时的回合数
          G.endConditionTriggeredAtRound = ctx.turn;
        }
      }
    },
  },

  endIf: ({ G, ctx }) => {
    // 公平轮逻辑：结束条件触发后，需要完成当前轮次（所有玩家都行动一次）后才结束游戏
    // endConditionTriggeredAtRound 记录了条件触发时的回合数

    if (G.endConditionTriggeredAtRound === null) {
      // 结束条件尚未触发，游戏继续
      return;
    }

    // 计算玩家数量
    const numPlayers = Object.keys(G.players).length;

    // 结束条件已触发，检查是否完成了公平轮
    // 公平轮：从触发时刻开始，每个玩家再行动一次后，回到玩家0时结束
    const isStartOfRound = ctx.currentPlayer === "0";
    const turnsAfterTrigger = ctx.turn - G.endConditionTriggeredAtRound;

    // 需要至少经过一轮（numPlayers个回合）才能结束
    if (isStartOfRound && turnsAfterTrigger >= numPlayers) {
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

      // Use the tea token
      player.teaTokens -= 1;
      player.actionPoints += 1;
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

      // Fill public area with snacks only (plates drawn separately)
      G.publicArea.forEach((slot) => {
        if (G.snackDeck.length > 0) slot.snack = G.snackDeck.shift();
      });

      // Initialize AP for current player (基础行动点为3)
      const currentPlayer = G.players[playerID];
      if (currentPlayer) currentPlayer.actionPoints = 3;

      G.isGameStarted = true;
    },

    // 从公共区拿取点心 (1 AP)
    // 文档规定：从公共区拿取一张点心，放置在等待区中有空位的食器上
    takeSnack: (
      { G, playerID, events },
      { snackId, targetSlotId }: { snackId: string; targetSlotId: string },
    ) => {
      const pid = playerID || "0";
      const player = G.players[pid];

      if (player.actionPoints <= 0) return INVALID_MOVE;

      // 等待区上限为5
      if (player.waitingArea.length >= 5) return INVALID_MOVE;

      // Find snack in public area
      const slotIndex = G.publicArea.findIndex((s) => s.snack?.id === snackId);
      if (slotIndex === -1) return INVALID_MOVE;
      const slot = G.publicArea[slotIndex];

      const snack = slot.snack;
      if (!snack) return INVALID_MOVE;

      // 点心必须放置在等待区中有空位的食器上
      const waitingSlot = player.waitingArea.find((s) => s.id === targetSlotId);
      if (!waitingSlot) return INVALID_MOVE;
      if (!waitingSlot.tableware) return INVALID_MOVE; // 必须有食器
      if (waitingSlot.snack) return INVALID_MOVE; // 食器上不能已有点心

      // 放置点心
      waitingSlot.snack = snack;

      // Remove snack from public slot
      slot.snack = undefined;

      // 立即从牌堆补充点心
      if (G.snackDeck.length > 0) {
        slot.snack = G.snackDeck.shift();
      }

      // Deduct AP
      player.actionPoints -= 1;

      // End turn if no AP
      if (player.actionPoints <= 0) {
        events.endTurn();
      }
    },

    // 从公共区抽取食器 (1 AP)
    // 文档规定：公共区域还有一个抽取盘子的槽位，先抽取L1,L1消耗完后抽取L2
    takeTableware: ({ G, playerID, events }) => {
      const pid = playerID || "0";
      const player = G.players[pid];

      if (player.actionPoints <= 0) return INVALID_MOVE;

      // 等待区上限为5
      if (player.waitingArea.length >= 5) return INVALID_MOVE;

      // 先从L1牌堆抽取，L1消耗完后从奖励牌堆抽取L2
      let tableware: Card | undefined;
      if (G.tablewareDeck.length > 0) {
        tableware = G.tablewareDeck.shift();
      } else {
        // L1用完，抽取L2
        const l2Index = G.rewardDeck.findIndex((c) => c.level === 2);
        if (l2Index !== -1) {
          tableware = G.rewardDeck.splice(l2Index, 1)[0];
        }
      }

      if (!tableware) return INVALID_MOVE; // 没有可用的盘子

      // 放入等待区
      player.waitingArea.push({
        id: `tableware-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tableware: tableware,
        snack: undefined,
      });

      // Deduct AP
      player.actionPoints -= 1;

      // End turn if no AP
      if (player.actionPoints <= 0) {
        events.endTurn();
      }
    },

    // 调整等待区点心位置 (0 AP)
    // 文档规定：在你的回合，你可以任意调整等待区点心的位置，不消耗AP
    adjustSnack: (
      { G, playerID },
      { fromSlotId, toSlotId }: { fromSlotId: string; toSlotId: string },
    ) => {
      const pid = playerID || "0";
      const player = G.players[pid];

      if (fromSlotId === toSlotId) return INVALID_MOVE;

      const fromSlot = player.waitingArea.find((s) => s.id === fromSlotId);
      const toSlot = player.waitingArea.find((s) => s.id === toSlotId);

      if (!fromSlot || !toSlot) return INVALID_MOVE;
      if (!fromSlot.snack) return INVALID_MOVE; // 源槽位必须有点心
      if (!toSlot.tableware) return INVALID_MOVE; // 目标槽位必须有食器
      if (toSlot.snack) return INVALID_MOVE; // 目标槽位不能已有点心

      // 移动点心
      toSlot.snack = fromSlot.snack;
      fromSlot.snack = undefined;

      // 不消耗AP
    },

    taste: ({ G, playerID, events }, { slotId }: { slotId: string }) => {
      const player = G.players[playerID];
      if (player.actionPoints <= 0) return INVALID_MOVE;

      // 每回合只能品鉴一次点心
      if (player.tasteDoneThisTurn) return INVALID_MOVE;

      const slotIndex = player.waitingArea.findIndex((s) => s.id === slotId);
      if (slotIndex === -1) return INVALID_MOVE;
      const item = player.waitingArea[slotIndex];

      // Must have plate and snack to taste
      if (!item.tableware || !item.snack) return INVALID_MOVE;

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

    offer: ({ G, ctx, events }, { slotId }: { slotId: string }) => {
      const player = G.players[ctx.currentPlayer];
      if (player.actionPoints <= 0) return INVALID_MOVE;

      const slotIndex = player.waitingArea.findIndex((s) => s.id === slotId);
      if (slotIndex === -1) return INVALID_MOVE;
      const item = player.waitingArea[slotIndex];

      if (!item.tableware || !item.snack) return INVALID_MOVE;

      // 文档规定：奉献的点心的配对分至少要>=2点
      const pairingScore = calculatePairingScore(item);
      if (pairingScore < 2) return INVALID_MOVE;

      const currentLevel = item.tableware.level;

      // Move to offering area
      player.offeringArea.push(item);
      player.waitingArea.splice(slotIndex, 1);

      player.actionPoints -= 1;

      let rewardMessage = "";

      // 文档规定：若奉献的点心配对分>=3点，则额外获得一枚茶券
      if (pairingScore >= 3) {
        player.teaTokens += 1;
        rewardMessage += "配对分≥3，额外获得1枚茶券！";
      }

      // 奖励逻辑：根据食器等级获得升级
      // L1 -> 获得 L2
      // L2 -> 获得 L3
      // L3 -> 获得两个茶券
      if (currentLevel === 1) {
        const rewardIndex = G.rewardDeck.findIndex((c) => c.level === 2);
        if (rewardIndex !== -1) {
          const rewardPlate = G.rewardDeck.splice(rewardIndex, 1)[0];
          player.waitingArea.push({
            id: `reward-plate-${Date.now()}`,
            tableware: rewardPlate,
            snack: undefined,
          });
          rewardMessage += ` 获得升级食器 (L2)。`;
        } else {
          rewardMessage += ` 牌堆无L2食器可领取。`;
        }
      } else if (currentLevel === 2) {
        const rewardIndex = G.rewardDeck.findIndex((c) => c.level === 3);
        if (rewardIndex !== -1) {
          const rewardPlate = G.rewardDeck.splice(rewardIndex, 1)[0];
          player.waitingArea.push({
            id: `reward-plate-${Date.now()}`,
            tableware: rewardPlate,
            snack: undefined,
          });
          rewardMessage += ` 获得升级食器 (L3)。`;
        } else {
          // L3用完，返回两个L2盘子（或根据等待区空位调整）
          const waitingAreaSpace = 5 - player.waitingArea.length;

          if (waitingAreaSpace >= 2) {
            // 有两个以上空位，返回两个L2盘子
            let l2Count = 0;
            for (let i = 0; i < 2; i++) {
              const l2Index = G.rewardDeck.findIndex((c) => c.level === 2);
              if (l2Index !== -1) {
                const l2Plate = G.rewardDeck.splice(l2Index, 1)[0];
                player.waitingArea.push({
                  id: `reward-plate-${Date.now()}-${i}`,
                  tableware: l2Plate,
                  snack: undefined,
                });
                l2Count++;
              }
            }
            if (l2Count > 0) {
              rewardMessage += ` L3已空，获得${l2Count}个L2食器。`;
            } else {
              rewardMessage += ` 牌堆无L3或L2食器可领取。`;
            }
          } else if (waitingAreaSpace === 1) {
            // 只有一个空位，返回一个L2盘子加1茶券
            const l2Index = G.rewardDeck.findIndex((c) => c.level === 2);
            if (l2Index !== -1) {
              const l2Plate = G.rewardDeck.splice(l2Index, 1)[0];
              player.waitingArea.push({
                id: `reward-plate-${Date.now()}`,
                tableware: l2Plate,
                snack: undefined,
              });
              player.teaTokens += 1;
              rewardMessage += ` L3已空，等待区仅1空位，获得1个L2食器+1茶券。`;
            } else {
              // 无L2盘子，只给茶券
              player.teaTokens += 2;
              rewardMessage += ` L3已空且无L2，获得2茶券。`;
            }
          } else {
            // 没有空位，给2茶券
            player.teaTokens += 2;
            rewardMessage += ` L3已空且等待区已满，获得2茶券。`;
          }
        }
      } else if (currentLevel === 3) {
        // L3奉献获得2茶券
        player.teaTokens += 2;
        rewardMessage += ` 奉献珍宝盘，获得2枚茶券。`;
      }

      G.notification = {
        type: "offering",
        message: rewardMessage || "奉献成功！",
        details: { pairingScore },
        timestamp: Date.now(),
      };

      if (player.actionPoints <= 0) events.endTurn();
    },

    // 敬茶：获取玉盏的唯一方式
    // 条件：消耗9个茶券，奉献区每1盘减少1个茶券，消耗3AP
    // 玉盏不占用区域，只作为标识物
    serveTea: ({ G, ctx, events }) => {
      const player = G.players[ctx.currentPlayer];
      // 获取玉盏需要消耗3AP
      if (player.actionPoints < 3) return INVALID_MOVE;

      // 检查玉盏是否已被发放
      if (G.jadeGiven) return INVALID_MOVE;

      // 计算实际需要的茶券数量：基础9个，每1个奉献减少1个
      const baseCost = 9;
      const discount = player.offeringArea.length;
      const actualCost = Math.max(0, baseCost - discount);

      // 检查茶券是否足够
      if (player.teaTokens < actualCost) return INVALID_MOVE;

      // 消耗茶券和AP
      player.teaTokens -= actualCost;
      player.actionPoints -= 3;

      // 玉盏只作为标识物，不占用等待区/个人区/奉献区
      player.hasJadeChalice = true;
      G.jadeGiven = true;

      G.notification = {
        type: "offering",
        message: "敬茶成功！获得【玉盏】！奉献区分数将翻倍计算。",
        details: { actualCost },
        timestamp: Date.now(),
      };

      if (player.actionPoints <= 0) events.endTurn();
    },
  },
};
