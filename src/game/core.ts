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
  snack?: Card; // 公共区只有点心槽位，盘子从单独的抽取堆获取
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
  adjustModeActive: boolean; // 调整模式是否激活
  adjustModeUsedThisTurn: boolean; // 本回合是否已使用过调整模式
}

export interface GameState {
  snackDeck: Card[];
  tablewareDeck: Card[];
  l2Deck: Card[]; // L2 盘子牌堆（奉献L1的奖励，L1用完后玩家也可抽取）
  l3Deck: Card[]; // L3 盘子牌堆（奉献L2的奖励）
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

  // 公式: S = Sum(P_ind) + C_off + T_remain - C_wait * 2
  const teaTokens = player.teaTokens;
  const totalScore = sumP_ind + c_off + teaTokens - c_wait * 2;

  return { totalScore, sumP_ind, c_off, teaTokens, c_wait, hasJadeChalice: player.hasJadeChalice };
};

// --- Game State Management ---

export function createInitialState(numPlayers: number): GameState {
  const { snackDeck, tablewareDeck } = getDecks();
  const l1Plates = tablewareDeck.filter((c) => c.level === 1);
  const l2Plates = tablewareDeck.filter((c) => c.level === 2);
  const l3Plates = tablewareDeck.filter((c) => c.level === 3);

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
      adjustModeActive: false,
      adjustModeUsedThisTurn: false,
    };
  }

  // 文档规定：公共区牌列设置为5个槽位
  const publicArea: PublicSlot[] = [];
  for (let i = 0; i < 5; i++) {
    publicArea.push({ id: `public-slot-${i}` });
  }

  const state: GameState = {
    snackDeck: shuffle(snackDeck),
    tablewareDeck: shuffle(l1Plates),
    l2Deck: shuffle(l2Plates),
    l3Deck: shuffle(l3Plates),
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

  // 填充公共区点心（盘子从单独的抽取堆获取）
  state.publicArea.forEach((slot) => {
    if (state.snackDeck.length > 0) {
      slot.snack = state.snackDeck.shift();
    }
  });

  return state;
}

/**
 * 从公共区抽取盘子（先L1，L1用完后L2）
 */
export function drawTableware(state: GameState): Card | undefined {
  if (state.tablewareDeck.length > 0) {
    return state.tablewareDeck.shift();
  }
  // L1用完，抽取L2
  if (state.l2Deck.length > 0) {
    return state.l2Deck.shift();
  }
  return undefined;
}

/**
 * 补充公共区点心槽位
 */
export function refillPublicSnacks(state: GameState): void {
  state.publicArea.forEach((slot) => {
    if (!slot.snack && state.snackDeck.length > 0) {
      slot.snack = state.snackDeck.shift();
    }
  });
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
  player.adjustModeActive = false; // 重置调整模式
  player.adjustModeUsedThisTurn = false; // 重置调整模式使用记录

  if (nextIdx === 0) state.turn++;

  // 检查结束条件
  if (state.endConditionTriggeredAtRound === null) {
    const allL2Distributed = state.l2Deck.length === 0;

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
