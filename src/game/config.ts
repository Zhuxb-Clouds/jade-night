import { Game } from "boardgame.io";
import { INVALID_MOVE, Stage } from "boardgame.io/core";
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
  isDeflectedPenalty?: boolean; // 弹回惩罚标记，配对分为-3
}

export interface PlayerState {
  waitingArea: WaitingItem[]; // Cards in waiting area (Max 5)
  personalArea: WaitingItem[];
  offeringArea: WaitingItem[];
  actionPoints: number;
  tasteDoneThisTurn: boolean; // 每回合只能品鉴一次
  hasJadeChalice: boolean; // 是否持有玉盏（可弹回赠尝）
  adjustModeActive: boolean; // 调整模式是否激活（花费1AP激活，回合结束重置）
  adjustModeUsedThisTurn: boolean; // 本回合是否已使用过调整模式
}

export interface NotificationState {
  type: "offering" | "gameover" | "info";
  message: string;
  details?: any; // For displaying calculation breakdowns
  timestamp: number;
}

// 待处理的赠尝请求（仅当目标持有玉盏时创建）
export interface PendingGift {
  fromPlayerId: string;    // 发起者
  toPlayerId: string;      // 接收者
  snack: Card;             // 赠送的点心
  targetSlotId: string;    // 目标槽位
  pairingScore: number;    // 预计配对分
  deflected: boolean;      // 是否已被玉盏弹回
}

export interface JadeNightState {
  snackDeck: Card[];
  tablewareDeck: Card[]; // Public draw pile (L1 only)
  l2Deck: Card[]; // L2 盘子牌堆（奉献L1的奖励，L1用完后玩家也可抽取）
  l3Deck: Card[]; // L3 盘子牌堆（奉献L2的奖励）
  publicArea: PublicSlot[];
  players: { [key: string]: PlayerState };
  isGameStarted: boolean;
  notification: NotificationState | null;
  jadeGiven: boolean; // 玉盏是否已被发放
  endConditionTriggeredAtRound: number | null; // 结束条件触发时的回合数，用于公平轮判定
  pendingGift: PendingGift | null; // 待处理的赠尝请求
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
// 新规则：
// 基础分 = 匹配的维度数（0-3分）
// 完美奖励 = 3个维度全匹配时 +1分
// 最终配对分 = 基础分 + 完美奖励
// 可能的分值：0, 1, 2, 4分（没有3分）
export const calculateSinglePairingScore = (tableware: Card, snack: Card): number => {
  const p = tableware.attributes;
  const s = snack.attributes;

  let matchedDimensions = 0;

  // Color Match: 颜色维度是否匹配（只要有一个颜色匹配即算匹配）
  const colorMatch = p.colors.some(c => s.colors.includes(c));
  if (colorMatch) matchedDimensions += 1;

  // Shape Match: 形状维度是否匹配
  const shapeMatch = p.shapes.some(sh => s.shapes.includes(sh));
  if (shapeMatch) matchedDimensions += 1;

  // Temp Match: 材质维度是否匹配
  const tempMatch = p.temps.some(t => s.temps.includes(t));
  if (tempMatch) matchedDimensions += 1;

  // 完美奖励：3个维度全匹配时 +1分
  const perfectBonus = matchedDimensions === 3 ? 1 : 0;

  return matchedDimensions + perfectBonus;
};

export const calculatePairingScore = (item: WaitingItem): number => {
  // 弹回惩罚：背面朝上的点心，记-3分
  if (item.isDeflectedPenalty) return -3;
  
  if (!item.tableware) return 0;

  // Normal plate with single snack
  if (!item.snack) return 0;
  return calculateSinglePairingScore(item.tableware, item.snack);
};

export const calculateFinalScore = (player: PlayerState) => {
  // S = Sum(P_ind) + C_off - C_wait * 2
  // 文档公式：个人区配对分 + 奉献区得分 - 滞留惩罚

  // 1. Personal Area Scores (pairing scores，含完美奖励)
  const sumP_ind = player.personalArea.reduce((sum, item) => sum + calculatePairingScore(item), 0);

  // 2. Offering Area Score (按食器等级计分：L1=1, L2=2, L3=3)
  const c_off = player.offeringArea.reduce((sum, item) => {
    const level = item.tableware?.level || 1;
    return sum + level;
  }, 0);

  // 3. Waiting Area Penalty (C_wait) - 只计算有点心的盘子
  const c_wait = player.waitingArea.filter((item) => {
    return !!item.snack;
  }).length;

  // 公式: S = Sum(P_ind) + C_off - C_wait * 2
  const totalScore = sumP_ind + c_off - c_wait * 2;

  return { totalScore, sumP_ind, c_off, c_wait, hasJadeChalice: player.hasJadeChalice };
};

export const JadeNightGame: Game<JadeNightState> = {
  name: "jade-night",

  minPlayers: 2,
  maxPlayers: 5,

  setup: ({ ctx }) => {
    const { snackDeck, tablewareDeck } = getDecks();

    // Split tablewareDeck into 3 separate decks by level
    const l1Plates = tablewareDeck.filter((c) => c.level === 1);
    const l2Plates = tablewareDeck.filter((c) => c.level === 2);
    const l3Plates = tablewareDeck.filter((c) => c.level === 3);

    const players: { [key: string]: PlayerState } = {};
    const numPlayers = ctx.numPlayers || 5;
    for (let i = 0; i < numPlayers; i++) {
      players[i.toString()] = {
        waitingArea: [],
        personalArea: [],
        offeringArea: [],
        actionPoints: 0,
        tasteDoneThisTurn: false,
        hasJadeChalice: false,
        adjustModeActive: false,
        adjustModeUsedThisTurn: false,
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
      l2Deck: l2Plates,
      l3Deck: l3Plates,
      publicArea,
      players,
      isGameStarted: false,
      notification: null,
      jadeGiven: false,
      endConditionTriggeredAtRound: null,
      pendingGift: null,
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
        player.actionPoints = 3;
        player.tasteDoneThisTurn = false; // 重置每回合品鉴限制
        player.adjustModeActive = false; // 重置调整模式
        player.adjustModeUsedThisTurn = false; // 重置调整模式使用记录
      }

      // 检查结束条件是否触发，如果是则记录当前回合数
      if (G.endConditionTriggeredAtRound === null) {
        const allL2Distributed = G.l2Deck.length === 0;
        const endConditionMet = allL2Distributed;

        if (endConditionMet) {
          // 记录结束条件触发时的回合数
          G.endConditionTriggeredAtRound = ctx.turn;
        }
      }
    },
    // 关键配置：允许所有玩家在任何时候执行 moves
    // 这对于赠尝响应机制至关重要：被赠尝的玩家需要在不是自己回合时响应
    // Stage.NULL 表示不限制在特定 stage，玩家可以执行顶层 moves
    activePlayers: { all: Stage.NULL },
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
    // Manual end turn - 只有当前回合玩家可以结束回合
    endTurn: ({ ctx, playerID, events }) => {
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      events.endTurn();
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
      G.tablewareDeck = random.Shuffle(G.tablewareDeck); // L1
      G.l2Deck = random.Shuffle(G.l2Deck); // L2
      G.l3Deck = random.Shuffle(G.l3Deck); // L3

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
      { G, ctx, playerID, events },
      { snackId, targetSlotId }: { snackId: string; targetSlotId: string },
    ) => {
      // 只有当前回合玩家可以拿取点心
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      
      const pid = playerID || "0";
      const player = G.players[pid];

      if (player.actionPoints <= 0) return INVALID_MOVE;
      if (player.adjustModeActive) return INVALID_MOVE; // 调整模式中不能进行其他行动

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
    takeTableware: ({ G, ctx, playerID, events }) => {
      // 只有当前回合玩家可以抽取食器
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      
      const pid = playerID || "0";
      const player = G.players[pid];

      if (player.actionPoints <= 0) return INVALID_MOVE;
      if (player.adjustModeActive) return INVALID_MOVE; // 调整模式中不能进行其他行动

      // 等待区上限为5
      if (player.waitingArea.length >= 5) return INVALID_MOVE;

      // 先从L1牌堆抽取，L1消耗完后从L2牌堆抽取
      let tableware: Card | undefined;
      if (G.tablewareDeck.length > 0) {
        tableware = G.tablewareDeck.shift();
      } else if (G.l2Deck.length > 0) {
        // L1用完，抽取L2
        tableware = G.l2Deck.shift();
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

    // 激活调整模式 (1 AP)
    // 花费1AP激活调整模式，在本回合内可以任意调整等待区点心位置
    // 每回合只能使用一次，必须关闭后才能进行其他行动
    activateAdjustMode: ({ G, ctx, playerID }) => {
      // 只有当前回合玩家可以激活调整模式
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      
      const pid = playerID || "0";
      const player = G.players[pid];

      if (player.actionPoints <= 0) return INVALID_MOVE;
      if (player.adjustModeActive) return INVALID_MOVE; // 已经激活
      if (player.adjustModeUsedThisTurn) return INVALID_MOVE; // 本回合已使用过

      player.adjustModeActive = true;
      player.adjustModeUsedThisTurn = true; // 标记本回合已使用
      player.actionPoints -= 1;

      // 调整模式不自动结束回合，必须手动关闭
    },

    // 关闭调整模式 (0 AP)
    // 关闭调整模式后才能继续其他行动
    deactivateAdjustMode: ({ G, ctx, playerID, events }) => {
      // 只有当前回合玩家可以关闭调整模式
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      
      const pid = playerID || "0";
      const player = G.players[pid];

      if (!player.adjustModeActive) return INVALID_MOVE; // 未激活

      player.adjustModeActive = false;

      // 关闭后检查是否还有AP
      if (player.actionPoints <= 0) {
        events.endTurn();
      }
    },

    // 调整等待区点心位置 (0 AP，需要先激活调整模式)
    // 在调整模式下，可以任意移动等待区点心的位置，不消耗AP
    adjustSnack: (
      { G, ctx, playerID },
      { fromSlotId, toSlotId }: { fromSlotId: string; toSlotId: string },
    ) => {
      // 只有当前回合玩家可以调整点心
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      
      const pid = playerID || "0";
      const player = G.players[pid];

      // 必须先激活调整模式
      if (!player.adjustModeActive) return INVALID_MOVE;

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

    // 重新整理等待区 (1 AP)
    // 花费1AP，可以任意交换等待区中两个槽位的全部内容（包括盘子和点心）
    rearrangeWaitingArea: (
      { G, ctx, playerID, events },
      { slotId1, slotId2 }: { slotId1: string; slotId2: string },
    ) => {
      // 只有当前回合玩家可以重新整理
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      
      const pid = playerID || "0";
      const player = G.players[pid];

      if (player.actionPoints <= 0) return INVALID_MOVE;
      if (slotId1 === slotId2) return INVALID_MOVE;

      const slot1Index = player.waitingArea.findIndex((s) => s.id === slotId1);
      const slot2Index = player.waitingArea.findIndex((s) => s.id === slotId2);

      if (slot1Index === -1 || slot2Index === -1) return INVALID_MOVE;

      // 交换两个槽位的全部内容（盘子和点心）
      const temp = { ...player.waitingArea[slot1Index] };
      player.waitingArea[slot1Index] = {
        ...player.waitingArea[slot2Index],
        id: slotId1, // 保持原槽位ID
      };
      player.waitingArea[slot2Index] = {
        ...temp,
        id: slotId2, // 保持原槽位ID
      };

      // 消耗1 AP
      player.actionPoints -= 1;

      // End turn if no AP
      if (player.actionPoints <= 0) {
        events.endTurn();
      }
    },

    taste: ({ G, ctx, playerID, events }, { slotId }: { slotId: string }) => {
      // 只有当前回合玩家可以品鉴
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      
      const player = G.players[playerID];
      if (player.actionPoints <= 0) return INVALID_MOVE;
      if (player.adjustModeActive) return INVALID_MOVE; // 调整模式中不能进行其他行动

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

      player.actionPoints -= 1;
      player.tasteDoneThisTurn = true; // 标记本回合已品鉴
      if (player.actionPoints <= 0) events.endTurn();
    },

    offer: ({ G, ctx, playerID, events }, { slotId }: { slotId: string }) => {
      // 只有当前回合玩家可以奉献
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      
      const player = G.players[ctx.currentPlayer];
      if (player.actionPoints <= 0) return INVALID_MOVE;
      if (player.adjustModeActive) return INVALID_MOVE; // 调整模式中不能进行其他行动

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

      // 流动的玉盏：奉献L3食器即可获得/夺取玉盏
      if (currentLevel === 3) {
        if (!player.hasJadeChalice) {
          // 从其他玩家手中夺取玉盏
          for (const pid of Object.keys(G.players)) {
            if (G.players[pid].hasJadeChalice) {
              G.players[pid].hasJadeChalice = false;
              rewardMessage += `夺取了玩家 ${pid} 的【玉盏】！`;
              break;
            }
          }
          player.hasJadeChalice = true;
          G.jadeGiven = true;
          rewardMessage += " 获得【玉盏】！";
        }
      }

      // 奖励逻辑：根据食器等级获得升级
      // L1 -> 获得 L2
      // L2 -> 获得 L3
      // L3 -> 获得玉盏（上方已处理）
      if (currentLevel === 1) {
        // 从L2牌堆获取奖励
        if (G.l2Deck.length > 0) {
          const rewardPlate = G.l2Deck.shift()!;
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
        // 从L3牌堆获取奖励
        if (G.l3Deck.length > 0) {
          const rewardPlate = G.l3Deck.shift()!;
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
            for (let i = 0; i < 2 && G.l2Deck.length > 0; i++) {
              const l2Plate = G.l2Deck.shift()!;
              player.waitingArea.push({
                id: `reward-plate-${Date.now()}-${i}`,
                tableware: l2Plate,
                snack: undefined,
              });
              l2Count++;
            }
            if (l2Count > 0) {
              rewardMessage += ` L3已空，获得${l2Count}个L2食器。`;
            } else {
              rewardMessage += ` 牌堆无L3或L2食器可领取。`;
            }
          } else if (waitingAreaSpace === 1) {
            // 只有一个空位，返回一个L2盘子
            if (G.l2Deck.length > 0) {
              const l2Plate = G.l2Deck.shift()!;
              player.waitingArea.push({
                id: `reward-plate-${Date.now()}`,
                tableware: l2Plate,
                snack: undefined,
              });
              rewardMessage += ` L3已空，等待区仅1空位，获得1个L2食器。`;
            } else {
              rewardMessage += ` L3已空且无L2可领取。`;
            }
          } else {
            rewardMessage += ` L3已空且等待区已满，无法获取食器。`;
          }
        }
      } else if (currentLevel === 3) {
        rewardMessage += ` 奉献珍宝盘。`;
      }

      G.notification = {
        type: "offering",
        message: rewardMessage || "奉献成功！",
        details: { pairingScore },
        timestamp: Date.now(),
      };

      if (player.actionPoints <= 0) events.endTurn();
    },

    // 赠尝：将公共区点心放到任意玩家（包括自己）的合法空盘子里
    // 规则：消耗1 AP，配对分≥1即为合法，必须接受不能拒绝
    // 特殊：如果目标持有玉盏（且不是自己），目标可以选择弹回
    giftSnack: (
      { G, ctx, playerID, events },
      { snackId, targetPlayerId, targetSlotId }: { snackId: string; targetPlayerId: string; targetSlotId: string },
    ) => {
      // 只有当前回合玩家可以发起赠尝
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      
      const pid = playerID || "0";
      const player = G.players[pid];

      if (player.actionPoints <= 0) return INVALID_MOVE;
      if (player.adjustModeActive) return INVALID_MOVE; // 调整模式中不能进行其他行动
      if (G.pendingGift) return INVALID_MOVE; // 已有待处理的赠尝

      // 目标玩家必须存在
      const targetPlayer = G.players[targetPlayerId];
      if (!targetPlayer) return INVALID_MOVE;

      // 从公共区找到点心
      const slotIndex = G.publicArea.findIndex((s) => s.snack?.id === snackId);
      if (slotIndex === -1) return INVALID_MOVE;
      const slot = G.publicArea[slotIndex];
      const snack = slot.snack;
      if (!snack) return INVALID_MOVE;

      // 目标玩家等待区找到对应槽位
      const targetSlot = targetPlayer.waitingArea.find((s) => s.id === targetSlotId);
      if (!targetSlot) return INVALID_MOVE;
      if (!targetSlot.tableware) return INVALID_MOVE; // 必须有食器
      if (targetSlot.snack) return INVALID_MOVE; // 食器上不能已有点心

      // 配对分≥1才合法
      const tempItem: WaitingItem = {
        id: "temp",
        tableware: targetSlot.tableware,
        snack: snack,
      };
      const pairingScore = calculatePairingScore(tempItem);
      if (pairingScore < 1) return INVALID_MOVE;

      // 从公共区移除点心并补充
      slot.snack = undefined;
      if (G.snackDeck.length > 0) {
        slot.snack = G.snackDeck.shift();
      }

      // 消耗1 AP
      player.actionPoints -= 1;

      // 如果目标是自己，或目标没有玉盏：直接放置（不可拒绝）
      if (targetPlayerId === pid || !targetPlayer.hasJadeChalice) {
        targetSlot.snack = snack;
        const targetLabel = targetPlayerId === pid ? "自己" : `玩家 ${targetPlayerId}`;
        G.notification = {
          type: "info",
          message: `赠尝成功：「${snack.name}」放入${targetLabel}的盘中 (+${pairingScore}分)`,
          details: { pairingScore },
          timestamp: Date.now(),
        };

        if (player.actionPoints <= 0) events.endTurn();
      } else {
        // 目标持有玉盏，创建待处理请求（等待弹回决定）
        G.pendingGift = {
          fromPlayerId: pid,
          toPlayerId: targetPlayerId,
          snack: snack,
          targetSlotId: targetSlotId,
          pairingScore: pairingScore,
          deflected: false,
        };

        G.notification = {
          type: "info",
          message: `赠尝请求：玩家 ${pid} 想将「${snack.name}」(${pairingScore}分) 送给玩家 ${targetPlayerId}（持有🏆玉盏，可弹回）`,
          details: { pairingScore },
          timestamp: Date.now(),
        };
      }
    },

    // 接受赠尝（仅玉盏持有者需要主动接受，其他玩家自动接受）
    acceptGift: ({ G, playerID, ctx, events }) => {
      if (!G.pendingGift) return INVALID_MOVE;
      if (G.pendingGift.deflected) return INVALID_MOVE; // 已弹回状态不能接受
      
      const pid = playerID || "0";
      // 只有被赠尝的玩家可以响应
      if (G.pendingGift.toPlayerId !== pid) return INVALID_MOVE;

      const targetPlayer = G.players[pid];
      const targetSlot = targetPlayer.waitingArea.find((s) => s.id === G.pendingGift!.targetSlotId);
      
      if (!targetSlot || !targetSlot.tableware || targetSlot.snack) {
        G.notification = {
          type: "info",
          message: `赠尝失效：目标槽位状态已改变，「${G.pendingGift.snack.name}」被弃置`,
          timestamp: Date.now(),
        };
        G.pendingGift = null;
        return;
      }

      // 放置点心
      targetSlot.snack = G.pendingGift.snack;

      G.notification = {
        type: "info",
        message: `玩家 ${pid} 接受了赠尝：「${G.pendingGift.snack.name}」(+${G.pendingGift.pairingScore}分)`,
        details: { pairingScore: G.pendingGift.pairingScore },
        timestamp: Date.now(),
      };

      G.pendingGift = null;

      // 检查发起者是否需要结束回合
      const sender = G.players[ctx.currentPlayer];
      if (sender && sender.actionPoints <= 0) events.endTurn();
    },

    // 弹回赠尝（玉盏持有者专属能力）
    // 玉盏转移给发起者，发起者必须将点心放在自己的盘中
    deflectGift: ({ G, playerID }) => {
      if (!G.pendingGift) return INVALID_MOVE;
      if (G.pendingGift.deflected) return INVALID_MOVE; // 已弹回不能再弹
      
      const pid = playerID || "0";
      if (G.pendingGift.toPlayerId !== pid) return INVALID_MOVE;

      const targetPlayer = G.players[pid];
      if (!targetPlayer.hasJadeChalice) return INVALID_MOVE; // 必须持有玉盏

      // 玉盏转移给发起者
      targetPlayer.hasJadeChalice = false;
      const sender = G.players[G.pendingGift.fromPlayerId];
      sender.hasJadeChalice = true;

      // 标记为已弹回，等待发起者放置
      G.pendingGift.deflected = true;

      G.notification = {
        type: "info",
        message: `玩家 ${pid} 使用【玉盏】弹回了赠尝！「${G.pendingGift.snack.name}」返还给玩家 ${G.pendingGift.fromPlayerId}，🏆玉盏转移！`,
        timestamp: Date.now(),
      };
    },

    // 发起者放置被弹回的点心到自己的盘中
    // 可以选择任意有盘子的槽位，如果已有点心则弃置原点心
    resolveDeflectedGift: (
      { G, playerID, ctx, events },
      { targetSlotId }: { targetSlotId: string },
    ) => {
      if (!G.pendingGift) return INVALID_MOVE;
      if (!G.pendingGift.deflected) return INVALID_MOVE;
      
      const pid = playerID || "0";
      if (G.pendingGift.fromPlayerId !== pid) return INVALID_MOVE;

      const player = G.players[pid];
      const targetSlot = player.waitingArea.find((s) => s.id === targetSlotId);
      
      if (!targetSlot) return INVALID_MOVE;
      if (!targetSlot.tableware) return INVALID_MOVE;

      // 如果槽位已有点心，弃置原点心
      const discardedSnack = targetSlot.snack;
      const discardMsg = discardedSnack ? `，弃置了「${discardedSnack.name}」` : "";

      // 放置弹回的点心
      targetSlot.snack = G.pendingGift.snack;
      const pairingScore = calculatePairingScore(targetSlot);

      G.notification = {
        type: "info",
        message: `玩家 ${pid} 将弹回的「${G.pendingGift.snack.name}」放入自己的盘中 (${pairingScore}分)${discardMsg}`,
        details: { pairingScore },
        timestamp: Date.now(),
      };

      G.pendingGift = null;

      // 检查是否需要结束回合
      const currentPlayer = G.players[ctx.currentPlayer];
      if (currentPlayer && currentPlayer.actionPoints <= 0) events.endTurn();
    },

    // 发起者等待区没有任何盘子时，点心背面朝上放入个人区，记-3分
    discardDeflectedGift: ({ G, playerID, ctx, events }) => {
      if (!G.pendingGift) return INVALID_MOVE;
      if (!G.pendingGift.deflected) return INVALID_MOVE;
      
      const pid = playerID || "0";
      if (G.pendingGift.fromPlayerId !== pid) return INVALID_MOVE;

      const player = G.players[pid];
      // 只有当等待区完全没有盘子时才能调用
      const hasAnyPlate = player.waitingArea.some((s) => s.tableware);
      if (hasAnyPlate) return INVALID_MOVE; // 有盘子必须选择放置

      // 点心背面朝上放入个人区，记-3分
      player.personalArea.push({
        id: `penalty-${Date.now()}`,
        snack: G.pendingGift.snack,
        isDeflectedPenalty: true,
      });

      G.notification = {
        type: "info",
        message: `玩家 ${pid} 等待区无盘子，「${G.pendingGift.snack.name}」背面朝上放入个人区，记 -3 分`,
        timestamp: Date.now(),
      };

      G.pendingGift = null;

      // 检查是否需要结束回合
      const currentPlayer = G.players[ctx.currentPlayer];
      if (currentPlayer && currentPlayer.actionPoints <= 0) events.endTurn();
    },
  },
};
