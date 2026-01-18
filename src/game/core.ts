/**
 * 玉盏春夜宴 - 游戏核心逻辑
 *
 * 独立的游戏逻辑模块，不依赖 boardgame.io
 * 可供 simulation.ts 和其他脚本使用
 */

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
  level: number;
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
  snacks?: Card[];
}

export interface PlayerState {
  waitingArea: WaitingItem[];
  personalArea: WaitingItem[];
  offeringArea: WaitingItem[];
  actionPoints: number;
  teaTokens: number;
  teaTokenUsedThisTurn: boolean;
  tasteDoneThisTurn: boolean;
  hasJadeChalice: boolean;
}

export interface GameState {
  snackDeck: Card[];
  tablewareDeck: Card[];
  rewardDeck: Card[];
  publicArea: PublicSlot[];
  players: { [key: string]: PlayerState };
  jadeGiven: boolean;
  currentPlayer: string;
  turn: number;
  endConditionTriggeredAtRound: number | null;
}

// --- Helpers ---

export const getDecks = (): { snackDeck: Card[]; tablewareDeck: Card[] } => {
  return {
    snackDeck: decksData.snackDeck as Card[],
    tablewareDeck: decksData.tablewareDeck as Card[],
  };
};

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// --- Score Logic ---

export const calculateSinglePairingScore = (tableware: Card, snack: Card): number => {
  const p = tableware.attributes;
  const s = snack.attributes;

  let score = 0;

  for (const c of p.colors) {
    if (s.colors.includes(c)) score += 1;
  }

  for (const sh of p.shapes) {
    if (s.shapes.includes(sh)) score += 1;
  }

  for (const t of p.temps) {
    if (s.temps.includes(t)) score += 1;
  }

  return score;
};

export const calculatePairingScore = (item: WaitingItem): number => {
  if (!item.tableware) return 0;
  if (!item.snack) return 0;
  return calculateSinglePairingScore(item.tableware, item.snack);
};

export const calculateFinalScore = (player: PlayerState) => {
  const sumP_ind = player.personalArea.reduce((sum, item) => sum + calculatePairingScore(item), 0);

  let c_off = player.offeringArea.length;
  // 玉盏持有者奉献分翻倍
  if (player.hasJadeChalice) {
    c_off = c_off * 2;
  }

  const c_wait = player.waitingArea.filter((item) => !!item.snack).length;

  const totalScore = sumP_ind + c_off - c_wait * 2;

  return { totalScore, sumP_ind, c_off, c_wait, hasJadeChalice: player.hasJadeChalice };
};

// --- Game State Management ---

export function createInitialState(numPlayers: number): GameState {
  const { snackDeck, tablewareDeck } = getDecks();
  const l1Plates = tablewareDeck.filter((c) => c.level === 1);
  const rewardPlates = tablewareDeck.filter((c) => c.level > 1);

  const players: { [key: string]: PlayerState } = {};
  for (let i = 0; i < numPlayers; i++) {
    players[i.toString()] = {
      waitingArea: [],
      personalArea: [],
      offeringArea: [],
      actionPoints: 3,
      teaTokens: 0,
      teaTokenUsedThisTurn: false,
      tasteDoneThisTurn: false,
      hasJadeChalice: false,
    };
  }

  // 九宫格公共区
  const publicArea: PublicSlot[] = [];
  for (let i = 0; i < 9; i++) {
    publicArea.push({ id: `public-slot-${i}` });
  }

  const state: GameState = {
    snackDeck: shuffle(snackDeck),
    tablewareDeck: shuffle(l1Plates),
    rewardDeck: shuffle(rewardPlates),
    publicArea,
    players,
    jadeGiven: false,
    currentPlayer: "0",
    turn: 0,
    endConditionTriggeredAtRound: null,
  };

  // 初始化：每个玩家一个L1盘
  Object.keys(players).forEach((pid) => {
    if (state.tablewareDeck.length > 0) {
      const plate = state.tablewareDeck.shift()!;
      players[pid].waitingArea.push({
        id: `start-${pid}`,
        tableware: plate,
      });
    }
  });

  // 填充公共区
  state.publicArea.forEach((slot, idx) => {
    if (state.tablewareDeck.length > 0) {
      slot.tableware = state.tablewareDeck.shift();
    }
    if (state.snackDeck.length > 0) {
      slot.snack = state.snackDeck.shift();
    }
  });

  return state;
}

/**
 * 九宫格行列刷新机制：
 * - 位置 0,1,2 是第一行
 * - 位置 3,4,5 是第二行
 * - 位置 6,7,8 是第三行
 * - 位置 0,3,6 是第一列
 * - 位置 1,4,7 是第二列
 * - 位置 2,5,8 是第三列
 */
function getRowSlots(slotIdx: number): number[] {
  const row = Math.floor(slotIdx / 3);
  return [row * 3, row * 3 + 1, row * 3 + 2];
}

function getColSlots(slotIdx: number): number[] {
  const col = slotIdx % 3;
  return [col, col + 3, col + 6];
}

/**
 * 惜食机制：拿取盘子后刷新同行列点心
 */
export function refreshRowColSnacks(state: GameState, slotIdx: number): void {
  const rowSlots = getRowSlots(slotIdx);
  const colSlots = getColSlots(slotIdx);
  const affectedSlots = new Set([...rowSlots, ...colSlots]);

  for (const idx of affectedSlots) {
    const slot = state.publicArea[idx];
    if (slot && !slot.snack && state.snackDeck.length > 0) {
      slot.snack = state.snackDeck.shift();
    }
  }
}

/**
 * 惜食机制：拿取盘子后刷新同行列盘子（L1耗尽则用L2）
 */
export function refreshRowColPlates(state: GameState, slotIdx: number): void {
  const rowSlots = getRowSlots(slotIdx);
  const colSlots = getColSlots(slotIdx);
  const affectedSlots = new Set([...rowSlots, ...colSlots]);

  for (const idx of affectedSlots) {
    const slot = state.publicArea[idx];
    if (slot && !slot.tableware) {
      if (state.tablewareDeck.length > 0) {
        slot.tableware = state.tablewareDeck.shift();
      } else if (state.rewardDeck.length > 0) {
        // L1耗尽，使用L2盘
        const l2Plate = state.rewardDeck.find((c) => c.level === 2);
        if (l2Plate) {
          state.rewardDeck = state.rewardDeck.filter((c) => c !== l2Plate);
          slot.tableware = l2Plate;
        }
      }
    }
  }
}

export function nextPlayer(state: GameState): void {
  const pids = Object.keys(state.players).sort();
  const idx = pids.indexOf(state.currentPlayer);
  const nextIdx = (idx + 1) % pids.length;
  state.currentPlayer = pids[nextIdx];

  const player = state.players[state.currentPlayer];
  player.actionPoints = 3;
  player.tasteDoneThisTurn = false;
  player.teaTokenUsedThisTurn = false;

  if (nextIdx === 0) state.turn++;

  // 检查结束条件
  if (state.endConditionTriggeredAtRound === null) {
    const l2PlatesRemaining = state.rewardDeck.filter((c) => c.level === 2).length;
    const allL2Distributed = l2PlatesRemaining === 0;

    if (allL2Distributed) {
      state.endConditionTriggeredAtRound = state.turn;
    }
  }
}

export function isGameOver(state: GameState): boolean {
  if (state.endConditionTriggeredAtRound === null) return false;

  const numPlayers = Object.keys(state.players).length;
  const isStartOfRound = state.currentPlayer === "0";
  const turnsAfterTrigger = state.turn - state.endConditionTriggeredAtRound;

  return isStartOfRound && turnsAfterTrigger >= numPlayers;
}
