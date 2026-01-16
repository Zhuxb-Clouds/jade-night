/**
 * 玉盏春夜宴 - 蒙特卡洛模拟测试模块
 *
 * 用于测试游戏平衡性、策略有效性和统计分析
 *
 * 运行方式: npx tsx scripts/simulation.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============== 类型定义 ==============

enum CardColor {
  RED = "red",
  GREEN = "green",
  YELLOW = "yellow",
}

enum CardShape {
  CIRCLE = "circle",
  SQUARE = "square",
  FLOWER = "flower",
}

enum CardTemp {
  WARM = "warm",
  COLD = "cold",
}

interface CardAttributes {
  colors: CardColor[];
  shapes: CardShape[];
  temps: CardTemp[];
}

interface Card {
  id: string;
  type: "Snack" | "Tableware";
  name: string;
  attributes: CardAttributes;
  level: number;
}

interface WaitingItem {
  id: string;
  tableware?: Card;
  snack?: Card;
  snacks?: Card[];
}

interface PlayerState {
  waitingArea: WaitingItem[];
  personalArea: WaitingItem[];
  offeringArea: WaitingItem[];
  actionPoints: number;
  teaTokens: number;
  tasteDoneThisTurn: boolean;
}

interface PublicSlot {
  id: string;
  tableware?: Card;
  snack?: Card;
}

interface GameState {
  snackDeck: Card[];
  tablewareDeck: Card[];
  rewardDeck: Card[];
  publicArea: PublicSlot[];
  players: { [key: string]: PlayerState };
  jadeGiven: boolean;
  currentPlayer: string;
  turn: number;
}

// AI 策略类型
type AIStrategy = "random" | "greedy" | "balanced" | "offering_focused" | "jade_rush";

interface SimulationConfig {
  numGames: number;
  numPlayers: number;
  strategies: AIStrategy[];
  verbose: boolean;
}

interface GameResult {
  winnerId: string;
  scores: Record<string, number>;
  turns: number;
  jadeOwner: string | null;
  strategies: Record<string, AIStrategy>;
}

interface SimulationStats {
  totalGames: number;
  winsByStrategy: Record<AIStrategy, number>;
  avgScoreByStrategy: Record<AIStrategy, number>;
  avgTurns: number;
  jadeWinRate: number;
  avgScoreByPosition: Record<string, number>;
}

// ============== 工具函数 ==============

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ============== 牌组生成 ==============

function generateDecks(): { snackDeck: Card[]; tablewareDeck: Card[] } {
  const snackDeck: Card[] = [];
  const tablewareDeck: Card[] = [];
  let idCounter = 0;

  const colors = Object.values(CardColor);
  const shapes = Object.values(CardShape);
  const temps = Object.values(CardTemp);

  // 基础点心 (36张)
  for (let r = 0; r < 2; r++) {
    for (const c of colors) {
      for (const s of shapes) {
        for (const t of temps) {
          snackDeck.push({
            id: `snack-${idCounter++}`,
            type: "Snack",
            name: "点心",
            attributes: { colors: [c], shapes: [s], temps: [t] },
            level: 1,
          });
        }
      }
    }
  }

  // 稀有点心 - 双色 (6张)
  const twinColors: [CardColor, CardColor][] = [
    [CardColor.RED, CardColor.GREEN],
    [CardColor.RED, CardColor.YELLOW],
    [CardColor.GREEN, CardColor.YELLOW],
  ];
  twinColors.forEach(([c1, c2], idx) => {
    for (let r = 0; r < 2; r++) {
      snackDeck.push({
        id: `snack-twin-c-${idCounter++}`,
        type: "Snack",
        name: "双色点心",
        attributes: {
          colors: [c1, c2],
          shapes: [shapes[(idx + r) % 3]],
          temps: [temps[(idx + r) % 2]],
        },
        level: 2,
      });
    }
  });

  // 稀有点心 - 双形 (6张)
  const twinShapes: [CardShape, CardShape][] = [
    [CardShape.CIRCLE, CardShape.SQUARE],
    [CardShape.CIRCLE, CardShape.FLOWER],
    [CardShape.SQUARE, CardShape.FLOWER],
  ];
  twinShapes.forEach(([s1, s2], idx) => {
    for (let r = 0; r < 2; r++) {
      snackDeck.push({
        id: `snack-twin-s-${idCounter++}`,
        type: "Snack",
        name: "双形点心",
        attributes: {
          colors: [colors[(idx + r) % 3]],
          shapes: [s1, s2],
          temps: [temps[(idx + r) % 2]],
        },
        level: 2,
      });
    }
  });

  // 顶级点心 (6张)
  for (let i = 0; i < 2; i++) {
    snackDeck.push({
      id: `snack-epic-${idCounter++}`,
      type: "Snack",
      name: "顶级点心",
      attributes: {
        colors: [colors[i % 3], colors[(i + 1) % 3]],
        shapes: [shapes[i % 3], shapes[(i + 1) % 3]],
        temps: [temps[i % 2]],
      },
      level: 3,
    });
  }
  for (let i = 0; i < 2; i++) {
    snackDeck.push({
      id: `snack-triple-c-${idCounter++}`,
      type: "Snack",
      name: "三色点心",
      attributes: {
        colors: Object.values(CardColor),
        shapes: [shapes[i % 3]],
        temps: [temps[i % 2]],
      },
      level: 3,
    });
  }
  for (let i = 0; i < 2; i++) {
    snackDeck.push({
      id: `snack-triple-s-${idCounter++}`,
      type: "Snack",
      name: "三形点心",
      attributes: {
        colors: [colors[i % 3]],
        shapes: Object.values(CardShape),
        temps: [temps[i % 2]],
      },
      level: 3,
    });
  }

  // L1 食器 (20张)
  for (const c of colors) {
    for (const s of shapes) {
      for (const t of temps) {
        tablewareDeck.push({
          id: `plate-L1-${idCounter++}`,
          type: "Tableware",
          name: "L1盘",
          attributes: { colors: [c], shapes: [s], temps: [t] },
          level: 1,
        });
      }
    }
  }
  // 额外2张L1
  tablewareDeck.push({
    id: `plate-L1-extra-${idCounter++}`,
    type: "Tableware",
    name: "L1盘",
    attributes: { colors: [CardColor.RED], shapes: [CardShape.CIRCLE], temps: [CardTemp.WARM] },
    level: 1,
  });
  tablewareDeck.push({
    id: `plate-L1-extra-${idCounter++}`,
    type: "Tableware",
    name: "L1盘",
    attributes: { colors: [CardColor.GREEN], shapes: [CardShape.SQUARE], temps: [CardTemp.COLD] },
    level: 1,
  });

  // L2 食器 (16张)
  const l2ColorCombos: CardColor[][] = [
    [CardColor.RED, CardColor.GREEN],
    [CardColor.GREEN, CardColor.YELLOW],
    [CardColor.YELLOW, CardColor.RED],
  ];
  for (let i = 0; i < 6; i++) {
    tablewareDeck.push({
      id: `plate-L2-C-${idCounter++}`,
      type: "Tableware",
      name: "L2双色盘",
      attributes: { colors: l2ColorCombos[i % 3], shapes: [shapes[i % 3]], temps: [temps[i % 2]] },
      level: 2,
    });
  }
  const l2ShapeCombos: CardShape[][] = [
    [CardShape.CIRCLE, CardShape.SQUARE],
    [CardShape.SQUARE, CardShape.FLOWER],
    [CardShape.FLOWER, CardShape.CIRCLE],
  ];
  for (let i = 0; i < 6; i++) {
    tablewareDeck.push({
      id: `plate-L2-S-${idCounter++}`,
      type: "Tableware",
      name: "L2双形盘",
      attributes: { colors: [colors[i % 3]], shapes: l2ShapeCombos[i % 3], temps: [temps[i % 2]] },
      level: 2,
    });
  }
  for (let i = 0; i < 4; i++) {
    tablewareDeck.push({
      id: `plate-L2-T-${idCounter++}`,
      type: "Tableware",
      name: "L2全温盘",
      attributes: {
        colors: [colors[i % 3]],
        shapes: [shapes[i % 3]],
        temps: [CardTemp.WARM, CardTemp.COLD],
      },
      level: 2,
    });
  }

  // L3 食器 (6张)
  for (let i = 0; i < 3; i++) {
    tablewareDeck.push({
      id: `plate-L3-C-${idCounter++}`,
      type: "Tableware",
      name: "L3全色盘",
      attributes: {
        colors: Object.values(CardColor),
        shapes: [shapes[i % 3]],
        temps: [temps[i % 2]],
      },
      level: 3,
    });
  }
  for (let i = 0; i < 3; i++) {
    tablewareDeck.push({
      id: `plate-L3-S-${idCounter++}`,
      type: "Tableware",
      name: "L3全形盘",
      attributes: {
        colors: [colors[i % 3]],
        shapes: Object.values(CardShape),
        temps: [temps[i % 2]],
      },
      level: 3,
    });
  }

  return { snackDeck, tablewareDeck };
}

// ============== 计分逻辑 ==============

function calculateSinglePairingScore(tableware: Card, snack: Card): number {
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
}

function calculatePairingScore(item: WaitingItem): number {
  if (!item.tableware) return 0;
  const isJade = item.tableware.name === "玉盏";

  // 玉盏特殊计分：统计所有点心属性的并集（相同属性不重复计分）
  // 最高得分：3色 + 3形 + 2温 = 8分
  if (isJade && item.snacks && item.snacks.length > 0) {
    const matchedColors = new Set<CardColor>();
    const matchedShapes = new Set<CardShape>();
    const matchedTemps = new Set<CardTemp>();

    for (const snack of item.snacks) {
      // 玉盏是全属性兼容，直接把点心的属性加入集合
      snack.attributes.colors.forEach((c) => matchedColors.add(c));
      snack.attributes.shapes.forEach((s) => matchedShapes.add(s));
      snack.attributes.temps.forEach((t) => matchedTemps.add(t));
    }

    // 总分 = 颜色数 + 形状数 + 温度数
    return matchedColors.size + matchedShapes.size + matchedTemps.size;
  }

  if (!item.snack) return 0;
  return calculateSinglePairingScore(item.tableware, item.snack);
}

/**
 * 计算向玉盏添加某点心后的分数增益
 * 用于 AI 策略判断是否值得堆叠
 */
function calculateJadeScoreGain(item: WaitingItem, newSnack: Card): number {
  if (!item.tableware || item.tableware.name !== "玉盏") return 0;

  const existingSnacks = item.snacks || [];
  const existingColors = new Set<CardColor>();
  const existingShapes = new Set<CardShape>();
  const existingTemps = new Set<CardTemp>();

  for (const snack of existingSnacks) {
    snack.attributes.colors.forEach((c) => existingColors.add(c));
    snack.attributes.shapes.forEach((s) => existingShapes.add(s));
    snack.attributes.temps.forEach((t) => existingTemps.add(t));
  }

  const oldScore = existingColors.size + existingShapes.size + existingTemps.size;

  // 模拟添加新点心
  newSnack.attributes.colors.forEach((c) => existingColors.add(c));
  newSnack.attributes.shapes.forEach((s) => existingShapes.add(s));
  newSnack.attributes.temps.forEach((t) => existingTemps.add(t));

  const newScore = existingColors.size + existingShapes.size + existingTemps.size;

  return newScore - oldScore;
}

function calculateFinalScore(player: PlayerState): number {
  const sumP = player.personalArea.reduce((s, i) => s + calculatePairingScore(i), 0);
  const cOff = player.offeringArea.length;
  const cWait = player.waitingArea.filter((i) => {
    const isJade = i.tableware?.name === "玉盏";
    return isJade ? i.snacks && i.snacks.length > 0 : !!i.snack;
  }).length;

  return sumP + cOff - cWait * 2;
}

// ============== 游戏模拟器 ==============

export class GameSimulator {
  private state: GameState;
  private strategies: Record<string, AIStrategy>;
  private maxTurns = 200; // 防止无限循环

  constructor(numPlayers: number, strategies: AIStrategy[]) {
    const { snackDeck, tablewareDeck } = generateDecks();
    const l1Plates = tablewareDeck.filter((c) => c.level === 1);
    const rewardPlates = tablewareDeck.filter((c) => c.level > 1);

    const players: { [key: string]: PlayerState } = {};
    this.strategies = {};

    for (let i = 0; i < numPlayers; i++) {
      const pid = i.toString();
      players[pid] = {
        waitingArea: [],
        personalArea: [],
        offeringArea: [],
        actionPoints: 3,
        teaTokens: 0,
        tasteDoneThisTurn: false,
      };
      this.strategies[pid] = strategies[i % strategies.length];
    }

    const publicArea: PublicSlot[] = [];
    for (let i = 0; i < 5; i++) {
      publicArea.push({ id: `slot-${i}` });
    }

    this.state = {
      snackDeck: shuffle(snackDeck),
      tablewareDeck: shuffle(l1Plates),
      rewardDeck: shuffle(rewardPlates),
      publicArea,
      players,
      jadeGiven: false,
      currentPlayer: "0",
      turn: 0,
    };

    // 初始化：每个玩家一个L1盘
    Object.keys(players).forEach((pid) => {
      if (this.state.tablewareDeck.length > 0) {
        const plate = this.state.tablewareDeck.shift()!;
        players[pid].waitingArea.push({
          id: `start-${pid}`,
          tableware: plate,
        });
      }
    });

    // 填充公共区
    this.state.publicArea.forEach((slot) => {
      if (this.state.tablewareDeck.length > 0) {
        slot.tableware = this.state.tablewareDeck.shift();
      }
      if (this.state.snackDeck.length > 0) {
        slot.snack = this.state.snackDeck.shift();
      }
    });
  }

  /**
   * 公共区流转机制：当某个槽位空了，高位卡牌向低位流动
   */
  private flowPublicArea(): void {
    let changed = true;
    while (changed) {
      changed = false;
      // 找到第一个空槽位（盘子和点心都没有）
      for (let i = 0; i < this.state.publicArea.length; i++) {
        const slot = this.state.publicArea[i];
        if (!slot.tableware && !slot.snack) {
          // 检查后面是否有非空槽位
          let hasContentBehind = false;
          for (let k = i + 1; k < this.state.publicArea.length; k++) {
            if (this.state.publicArea[k].tableware || this.state.publicArea[k].snack) {
              hasContentBehind = true;
              break;
            }
          }

          if (hasContentBehind) {
            // 将后面的槽位内容向前移动
            for (let j = i; j < this.state.publicArea.length - 1; j++) {
              this.state.publicArea[j].tableware = this.state.publicArea[j + 1].tableware;
              this.state.publicArea[j].snack = this.state.publicArea[j + 1].snack;
              this.state.publicArea[j + 1].tableware = undefined;
              this.state.publicArea[j + 1].snack = undefined;
            }
            changed = true;
          }
          break;
        }
      }
    }

    // 在最后的空槽位补充新牌
    const lastSlot = this.state.publicArea[this.state.publicArea.length - 1];
    if (!lastSlot.tableware && this.state.tablewareDeck.length > 0) {
      lastSlot.tableware = this.state.tablewareDeck.shift();
    }
    if (!lastSlot.snack && this.state.snackDeck.length > 0) {
      lastSlot.snack = this.state.snackDeck.shift();
    }
  }

  /**
   * 补充单个槽位的点心（不触发流转）
   */
  private refillSnack(slot: PublicSlot): void {
    if (!slot.snack && this.state.snackDeck.length > 0) {
      slot.snack = this.state.snackDeck.shift();
    }
  }

  private isGameOver(): boolean {
    // 原始结束条件：玉盏已发放且L3奖励耗尽
    const l3Remaining = this.state.rewardDeck.filter((c) => c.level === 3).length;
    if (this.state.jadeGiven && l3Remaining === 0) return true;

    // 主要结束条件：点心牌库耗尽
    if (this.state.snackDeck.length === 0) return true;

    // 备用结束条件：食器牌库也耗尽
    if (this.state.tablewareDeck.length === 0 && this.state.snackDeck.length < 5) {
      return true;
    }

    return false;
  }

  private nextPlayer(): void {
    const pids = Object.keys(this.state.players).sort();
    const idx = pids.indexOf(this.state.currentPlayer);
    const nextIdx = (idx + 1) % pids.length;
    this.state.currentPlayer = pids[nextIdx];

    const player = this.state.players[this.state.currentPlayer];
    player.actionPoints = 3;
    player.tasteDoneThisTurn = false;

    if (nextIdx === 0) this.state.turn++;
  }

  private getAvailableActions(pid: string): string[] {
    const player = this.state.players[pid];
    const actions: string[] = [];

    if (player.actionPoints <= 0) return ["endTurn"];

    // 【惜食】Slot 0 (即 Slot 1) 可以1AP同时拿取盘子和点心
    const slot0 = this.state.publicArea[0];
    if (slot0.tableware && slot0.snack && player.waitingArea.length < 5) {
      actions.push("takeCombo:slot-0");
    }

    // 拿取点心 - 放到有空位的盘子上
    for (const slot of this.state.publicArea) {
      if (slot.snack) {
        for (const item of player.waitingArea) {
          // 普通盘子：没有点心时可以放
          if (item.tableware && !item.snack && !item.snacks) {
            actions.push(`takeSnack:${slot.id}:${item.id}`);
          }
          // 玉盏：可以堆叠最多3个点心
          if (item.tableware?.name === "玉盏" && item.snacks && item.snacks.length < 3) {
            actions.push(`takeSnackToJade:${slot.id}:${item.id}`);
          }
        }
      }
    }

    // 拿取食器 - 必须先拿走上面的点心
    for (const slot of this.state.publicArea) {
      if (slot.tableware && !slot.snack && player.waitingArea.length < 5) {
        actions.push(`takeTableware:${slot.id}`);
      }
    }

    // 品鉴 - 每回合只能一次
    if (!player.tasteDoneThisTurn) {
      for (const item of player.waitingArea) {
        // 普通盘子有点心
        if (item.tableware && item.snack) {
          actions.push(`taste:${item.id}`);
        }
        // 玉盏有点心
        if (item.tableware?.name === "玉盏" && item.snacks && item.snacks.length > 0) {
          actions.push(`taste:${item.id}`);
        }
      }
    }

    // 奉献 - 配对分≥1
    for (const item of player.waitingArea) {
      if (item.tableware && item.snack) {
        const score = calculatePairingScore(item);
        if (score >= 1) {
          actions.push(`offer:${item.id}`);
        }
      }
    }

    // 敬茶 - 4次奉献+3茶券
    if (!this.state.jadeGiven && player.offeringArea.length >= 4 && player.teaTokens >= 3) {
      actions.push("serveTea");
    }

    // 【调整】弃置点心（解套用）
    for (const item of player.waitingArea) {
      if (item.snack) {
        actions.push(`discard:${item.id}`);
      }
    }

    // 【调整】移动点心到空盘
    for (const source of player.waitingArea) {
      if (source.snack) {
        for (const target of player.waitingArea) {
          if (target.tableware && !target.snack && target.id !== source.id && !target.snacks) {
            actions.push(`moveSnack:${source.id}:${target.id}`);
          }
        }
      }
    }

    // 使用茶券
    if (player.teaTokens > 0 && player.actionPoints < 5) {
      actions.push("useTeaToken");
    }

    actions.push("endTurn");
    return actions;
  }

  private executeAction(pid: string, action: string): void {
    const player = this.state.players[pid];
    const parts = action.split(":");

    switch (parts[0]) {
      // 【惜食】Slot 0 同时拿取盘子和点心
      case "takeCombo": {
        const slot = this.state.publicArea[0];
        if (slot.tableware && slot.snack && player.waitingArea.length < 5) {
          player.waitingArea.push({
            id: `item-${Date.now()}-${Math.random()}`,
            tableware: slot.tableware,
            snack: slot.snack,
          });
          slot.tableware = undefined;
          slot.snack = undefined;
          player.actionPoints--;
          // 触发流转
          this.flowPublicArea();
        }
        break;
      }

      case "takeSnack": {
        const slotId = parts[1];
        const targetId = parts[2];
        const slot = this.state.publicArea.find((s) => s.id === slotId);
        const target = player.waitingArea.find((i) => i.id === targetId);

        if (slot?.snack && target?.tableware && !target.snack) {
          target.snack = slot.snack;
          slot.snack = undefined;
          player.actionPoints--;
          // 补充点心（不流转）
          this.refillSnack(slot);
        }
        break;
      }

      // 玉盏专用：堆叠点心
      case "takeSnackToJade": {
        const slotId = parts[1];
        const targetId = parts[2];
        const slot = this.state.publicArea.find((s) => s.id === slotId);
        const target = player.waitingArea.find((i) => i.id === targetId);

        if (
          slot?.snack &&
          target?.tableware?.name === "玉盏" &&
          target.snacks &&
          target.snacks.length < 3
        ) {
          target.snacks.push(slot.snack);
          slot.snack = undefined;
          player.actionPoints--;
          this.refillSnack(slot);
        }
        break;
      }

      case "takeTableware": {
        const slotId = parts[1];
        const slot = this.state.publicArea.find((s) => s.id === slotId);

        if (slot?.tableware && !slot.snack && player.waitingArea.length < 5) {
          player.waitingArea.push({
            id: `item-${Date.now()}-${Math.random()}`,
            tableware: slot.tableware,
          });
          slot.tableware = undefined;
          player.actionPoints--;
          // 触发流转
          this.flowPublicArea();
        }
        break;
      }

      // 【调整】弃置点心
      case "discard": {
        const itemId = parts[1];
        const target = player.waitingArea.find((i) => i.id === itemId);
        if (target?.snack) {
          target.snack = undefined;
          player.actionPoints--;
        }
        break;
      }

      // 【调整】移动点心到另一个空盘
      case "moveSnack": {
        const sourceId = parts[1];
        const targetId = parts[2];
        const source = player.waitingArea.find((i) => i.id === sourceId);
        const target = player.waitingArea.find((i) => i.id === targetId);
        if (source?.snack && target?.tableware && !target.snack) {
          target.snack = source.snack;
          source.snack = undefined;
          player.actionPoints--;
        }
        break;
      }

      case "taste": {
        const itemId = parts[1];
        const idx = player.waitingArea.findIndex((i) => i.id === itemId);
        if (idx !== -1 && !player.tasteDoneThisTurn) {
          const item = player.waitingArea.splice(idx, 1)[0];
          player.personalArea.push(item);
          player.actionPoints--;
          player.tasteDoneThisTurn = true;

          // 茶券奖励
          if (player.personalArea.length % 2 === 0) {
            player.teaTokens++;
          }
        }
        break;
      }

      case "offer": {
        const itemId = parts[1];
        const idx = player.waitingArea.findIndex((i) => i.id === itemId);
        if (idx !== -1) {
          const item = player.waitingArea[idx];
          const score = calculatePairingScore(item);

          if (score >= 1) {
            const level = item.tableware!.level;
            player.waitingArea.splice(idx, 1);
            player.offeringArea.push(item);
            player.actionPoints--;

            // 额外茶券
            if (score >= 2) player.teaTokens++;

            // 奖励
            if (level === 1) {
              const reward = this.state.rewardDeck.find((c) => c.level === 2);
              if (reward) {
                this.state.rewardDeck = this.state.rewardDeck.filter((c) => c !== reward);
                player.waitingArea.push({
                  id: `reward-${Date.now()}-${Math.random()}`,
                  tableware: reward,
                });
              }
            } else if (level === 2) {
              const reward = this.state.rewardDeck.find((c) => c.level === 3);
              if (reward) {
                this.state.rewardDeck = this.state.rewardDeck.filter((c) => c !== reward);
                player.waitingArea.push({
                  id: `reward-${Date.now()}-${Math.random()}`,
                  tableware: reward,
                });
              }
            } else if (level === 3) {
              player.teaTokens += 2;
            }
          }
        }
        break;
      }

      case "serveTea": {
        if (!this.state.jadeGiven && player.offeringArea.length >= 4 && player.teaTokens >= 3) {
          player.teaTokens -= 3;
          player.actionPoints--;

          const jade: Card = {
            id: `jade-${Date.now()}-${Math.random()}`,
            type: "Tableware",
            name: "玉盏",
            attributes: {
              colors: Object.values(CardColor),
              shapes: Object.values(CardShape),
              temps: Object.values(CardTemp),
            },
            level: 4,
          };

          player.waitingArea.push({
            id: `jade-item-${Date.now()}-${Math.random()}`,
            tableware: jade,
            snacks: [],
          });

          this.state.jadeGiven = true;
        }
        break;
      }

      case "useTeaToken": {
        if (player.teaTokens > 0) {
          player.teaTokens--;
          player.actionPoints++;
        }
        break;
      }

      case "endTurn":
        player.actionPoints = 0;
        break;
    }
  }

  // AI 策略选择行动
  private chooseAction(pid: string): string {
    const strategy = this.strategies[pid];
    const actions = this.getAvailableActions(pid);

    if (actions.length === 1) return actions[0];

    switch (strategy) {
      case "random": {
        // 排除 endTurn 除非没有其他选项
        const validActions = actions.filter((a) => a !== "endTurn");
        if (validActions.length === 0) return "endTurn";
        return validActions[Math.floor(Math.random() * validActions.length)];
      }

      case "greedy":
        return this.greedyStrategy(pid, actions);

      case "balanced":
        return this.balancedStrategy(pid, actions);

      case "offering_focused":
        return this.offeringFocusedStrategy(pid, actions);

      case "jade_rush":
        return this.jadeRushStrategy(pid, actions);

      default:
        return actions[0];
    }
  }

  /**
   * 智能选择玉盏堆叠动作：找能增加分数的点心
   */
  private findBestJadeAction(player: PlayerState, jadeActions: string[]): string | null {
    let bestAction: string | null = null;
    let bestGain = 0;

    for (const action of jadeActions) {
      const [, slotId, targetId] = action.split(":");
      const slot = this.state.publicArea.find((s) => s.id === slotId);
      const target = player.waitingArea.find((i) => i.id === targetId);

      if (slot?.snack && target) {
        const gain = calculateJadeScoreGain(target, slot.snack);
        if (gain > bestGain) {
          bestGain = gain;
          bestAction = action;
        }
      }
    }

    // 只返回能增加分数的动作
    return bestGain > 0 ? bestAction : null;
  }

  /**
   * 兜底行动：当没有最优解时，总得干点什么
   * 避免空过回合导致的资源浪费
   */
  private fallbackAction(actions: string[], player: PlayerState): string {
    const validActions = actions.filter((a) => a !== "endTurn");
    if (validActions.length === 0) return "endTurn";

    // 优先级1：如果等待区快满了（>=4），积极清理
    if (player.waitingArea.length >= 4) {
      // 先尝试奉献任意能奉献的
      const offer = validActions.find((a) => a.startsWith("offer:"));
      if (offer) return offer;
      // 再尝试品鉴任意能品鉴的
      const taste = validActions.find((a) => a.startsWith("taste:"));
      if (taste) return taste;
      // 最后弃牌腾位置
      const discard = validActions.find((a) => a.startsWith("discard:"));
      if (discard) return discard;
    }

    // 优先级2：惜食（1AP双收益）
    if (validActions.includes("takeCombo:slot-0")) {
      return "takeCombo:slot-0";
    }

    // 优先级3：拿点心（推进游戏）
    const takeSnack = validActions.filter(
      (a) => a.startsWith("takeSnack:") && !a.startsWith("takeSnackToJade:")
    );
    if (takeSnack.length > 0) {
      return takeSnack[Math.floor(Math.random() * takeSnack.length)];
    }

    // 优先级4：品鉴任意（清库存拿茶券）
    const taste = validActions.find((a) => a.startsWith("taste:"));
    if (taste) return taste;

    // 优先级5：奉献任意（清库存升级盘）
    const offer = validActions.find((a) => a.startsWith("offer:"));
    if (offer) return offer;

    // 优先级6：拿盘子（但要控制数量）
    if (player.waitingArea.length < 4) {
      const takeTableware = validActions.find((a) => a.startsWith("takeTableware:"));
      if (takeTableware) return takeTableware;
    }

    // 优先级7：弃牌
    const discard = validActions.find((a) => a.startsWith("discard:"));
    if (discard) return discard;

    // 实在没办法，随机选一个
    return validActions[Math.floor(Math.random() * validActions.length)] || "endTurn";
  }

  private greedyStrategy(pid: string, actions: string[]): string {
    const player = this.state.players[pid];

    // 惜食优先 (1AP拿两张)
    if (actions.includes("takeCombo:slot-0")) {
      return "takeCombo:slot-0";
    }

    // 优先品鉴高分配对
    const tasteActions = actions.filter((a) => a.startsWith("taste:"));
    if (tasteActions.length > 0) {
      let bestTaste = tasteActions[0];
      let bestScore = 0;
      for (const action of tasteActions) {
        const itemId = action.split(":")[1];
        const item = player.waitingArea.find((i) => i.id === itemId);
        if (item) {
          const score = calculatePairingScore(item);
          if (score > bestScore) {
            bestScore = score;
            bestTaste = action;
          }
        }
      }
      // 降低门槛：>=1分就品鉴（清库存比追求高分重要）
      if (bestScore >= 1) return bestTaste;
    }

    // 玉盏堆叠点心 - 智能选择能增加分数的点心
    const jadeActions = actions.filter((a) => a.startsWith("takeSnackToJade:"));
    if (jadeActions.length > 0) {
      const bestJadeAction = this.findBestJadeAction(player, jadeActions);
      if (bestJadeAction) return bestJadeAction;
    }

    // 拿取点心
    const takeSnackActions = actions.filter(
      (a) => a.startsWith("takeSnack:") && !a.startsWith("takeSnackToJade:")
    );
    if (takeSnackActions.length > 0) {
      return takeSnackActions[Math.floor(Math.random() * takeSnackActions.length)];
    }

    // 拿取食器（控制数量，避免囤积）
    const takeTablewareActions = actions.filter((a) => a.startsWith("takeTableware:"));
    if (takeTablewareActions.length > 0 && player.waitingArea.length < 3) {
      return takeTablewareActions[0];
    }

    // 如果有品鉴，执行（任意分数都可以）
    if (tasteActions.length > 0) return tasteActions[0];

    // 奉献（清库存）
    const offerActions = actions.filter((a) => a.startsWith("offer:"));
    if (offerActions.length > 0) return offerActions[0];

    // 兜底行动
    return this.fallbackAction(actions, player);
  }

  private balancedStrategy(pid: string, actions: string[]): string {
    const player = this.state.players[pid];

    // 敬茶优先
    if (actions.includes("serveTea")) return "serveTea";

    // 惜食优先
    if (actions.includes("takeCombo:slot-0")) {
      return "takeCombo:slot-0";
    }

    // 玉盏堆叠点心 - 智能选择
    const jadeActions = actions.filter((a) => a.startsWith("takeSnackToJade:"));
    if (jadeActions.length > 0) {
      const bestJadeAction = this.findBestJadeAction(player, jadeActions);
      if (bestJadeAction) return bestJadeAction;
    }

    // 奉献高分配对
    const offerActions = actions.filter((a) => a.startsWith("offer:"));
    for (const action of offerActions) {
      const itemId = action.split(":")[1];
      const item = player.waitingArea.find((i) => i.id === itemId);
      if (item) {
        const score = calculatePairingScore(item);
        if (score >= 2) return action;
      }
    }

    // 品鉴高分配对
    const tasteActions = actions.filter((a) => a.startsWith("taste:"));
    for (const action of tasteActions) {
      const itemId = action.split(":")[1];
      const item = player.waitingArea.find((i) => i.id === itemId);
      if (item) {
        const score = calculatePairingScore(item);
        if (score >= 2) return action;
      }
    }

    // 拿取点心
    const takeSnackActions = actions.filter(
      (a) => a.startsWith("takeSnack:") && !a.startsWith("takeSnackToJade:")
    );
    if (takeSnackActions.length > 0) {
      return takeSnackActions[Math.floor(Math.random() * takeSnackActions.length)];
    }

    const takeTablewareActions = actions.filter((a) => a.startsWith("takeTableware:"));
    if (takeTablewareActions.length > 0 && player.waitingArea.length < 3) {
      return takeTablewareActions[0];
    }

    // 奉献任意（清库存比追求高分重要）
    if (offerActions.length > 0) return offerActions[0];

    // 品鉴任意
    if (tasteActions.length > 0) return tasteActions[0];

    // 兜底行动
    return this.fallbackAction(actions, player);
  }

  private offeringFocusedStrategy(pid: string, actions: string[]): string {
    const player = this.state.players[pid];

    // 敬茶优先
    if (actions.includes("serveTea")) return "serveTea";

    // 惜食优先
    if (actions.includes("takeCombo:slot-0")) {
      return "takeCombo:slot-0";
    }

    // 优先奉献（核心策略）
    const offerActions = actions.filter((a) => a.startsWith("offer:"));
    if (offerActions.length > 0) {
      // 优先奉献L1/L2以升级
      for (const action of offerActions) {
        const itemId = action.split(":")[1];
        const item = player.waitingArea.find((i) => i.id === itemId);
        if (item?.tableware && item.tableware.level < 3) {
          return action;
        }
      }
      return offerActions[0];
    }

    // 拿取点心凑配对
    const takeSnackActions = actions.filter(
      (a) => a.startsWith("takeSnack:") && !a.startsWith("takeSnackToJade:")
    );
    if (takeSnackActions.length > 0) {
      return takeSnackActions[Math.floor(Math.random() * takeSnackActions.length)];
    }

    // 拿取食器（控制数量）
    const takeTablewareActions = actions.filter((a) => a.startsWith("takeTableware:"));
    if (takeTablewareActions.length > 0 && player.waitingArea.length < 3) {
      return takeTablewareActions[0];
    }

    // 品鉴（清库存）
    const tasteActions = actions.filter((a) => a.startsWith("taste:"));
    if (tasteActions.length > 0) return tasteActions[0];

    // 兜底行动
    return this.fallbackAction(actions, player);
  }

  private jadeRushStrategy(pid: string, actions: string[]): string {
    const player = this.state.players[pid];

    // 敬茶最高优先
    if (actions.includes("serveTea")) return "serveTea";

    // 惜食优先（高效拿牌）
    if (actions.includes("takeCombo:slot-0")) {
      return "takeCombo:slot-0";
    }

    // 玉盏堆叠点心 - 智能选择 (获得玉盏后优先堆叠高分点心)
    const jadeActions = actions.filter((a) => a.startsWith("takeSnackToJade:"));
    if (jadeActions.length > 0) {
      const bestJadeAction = this.findBestJadeAction(player, jadeActions);
      if (bestJadeAction) return bestJadeAction;
      // 玉盏冲刺策略更激进
      return jadeActions[Math.floor(Math.random() * jadeActions.length)];
    }

    // 快速奉献积累资历（优先低级盘子，高效升级）
    const offerActions = actions.filter((a) => a.startsWith("offer:"));
    if (offerActions.length > 0 && player.offeringArea.length < 4) {
      // 优先奉献低级盘以获取高级盘
      for (const action of offerActions) {
        const itemId = action.split(":")[1];
        const item = player.waitingArea.find((i) => i.id === itemId);
        if (item?.tableware && item.tableware.level === 1) {
          return action;
        }
      }
      return offerActions[0];
    }

    // 拿取点心
    const takeSnackActions = actions.filter(
      (a) => a.startsWith("takeSnack:") && !a.startsWith("takeSnackToJade:")
    );
    if (takeSnackActions.length > 0) {
      return takeSnackActions[Math.floor(Math.random() * takeSnackActions.length)];
    }

    // 品鉴获取茶券（每2盘1券）
    const tasteActions = actions.filter((a) => a.startsWith("taste:"));
    if (tasteActions.length > 0) {
      return tasteActions[0];
    }

    // 使用茶券加速（但要留3个用于敬茶）
    if (player.teaTokens > 4 && actions.includes("useTeaToken")) {
      return "useTeaToken";
    }

    // 拿取食器（控制数量）
    const takeTablewareActions = actions.filter((a) => a.startsWith("takeTableware:"));
    if (takeTablewareActions.length > 0 && player.waitingArea.length < 3) {
      return takeTablewareActions[0];
    }

    // 如果凑够了敬茶条件后还有多余的奉献机会
    if (offerActions.length > 0) return offerActions[0];

    // 兜底行动
    return this.fallbackAction(actions, player);
  }

  public simulate(debug = false): GameResult {
    let actionCount = 0;
    const maxActions = this.maxTurns * Object.keys(this.state.players).length * 10;
    const pids = Object.keys(this.state.players).sort();
    let isLastRound = false;
    let lastRoundStartPlayer: string | null = null;

    if (debug) {
      console.log(`初始点心数: ${this.state.snackDeck.length}`);
      console.log(`初始食器数: ${this.state.tablewareDeck.length}`);
    }

    while (actionCount < maxActions) {
      const pid = this.state.currentPlayer;
      const player = this.state.players[pid];

      // 检查是否是公平轮的结束点
      if (isLastRound && pid === lastRoundStartPlayer) {
        // 所有玩家都完成了最后一轮
        break;
      }

      while (player.actionPoints > 0 && actionCount < maxActions) {
        const apBefore = player.actionPoints;
        const action = this.chooseAction(pid);
        if (debug && actionCount < 50) {
          console.log(
            `[${actionCount}] P${pid}: ${action} (点心剩余: ${this.state.snackDeck.length}, AP: ${apBefore})`
          );
        }
        this.executeAction(pid, action);
        actionCount++;

        // 防止无限循环：如果动作没有消耗AP（执行失败），强制减少AP
        if (player.actionPoints === apBefore && action !== "useTeaToken") {
          if (debug) {
            console.log(`  [警告] 动作 ${action} 执行失败，强制消耗1AP`);
          }
          player.actionPoints--;
        }

        if (action === "endTurn") break;
      }

      // 检查游戏是否结束 (触发公平轮)
      if (!isLastRound && this.isGameOver()) {
        isLastRound = true;
        // 下一个玩家开始公平轮，当轮回到触发结束的下一个玩家时结束
        const currentIdx = pids.indexOf(pid);
        lastRoundStartPlayer = pids[(currentIdx + 1) % pids.length];
        if (debug) {
          console.log(`触发结束条件! 进入公平轮，结束于玩家 ${lastRoundStartPlayer}`);
        }
      }

      this.nextPlayer();
    }

    if (debug) {
      console.log(
        `游戏结束! 回合: ${this.state.turn}, 行动: ${actionCount}, 点心剩余: ${this.state.snackDeck.length}`
      );
    }

    // 计算结果
    const scores: Record<string, number> = {};
    let maxScore = -Infinity;
    let winnerId = "0";
    let jadeOwner: string | null = null;

    for (const [pid, player] of Object.entries(this.state.players)) {
      scores[pid] = calculateFinalScore(player);
      if (scores[pid] > maxScore) {
        maxScore = scores[pid];
        winnerId = pid;
      }

      // 检查玉盏
      if (
        player.waitingArea.some((i) => i.tableware?.name === "玉盏") ||
        player.personalArea.some((i) => i.tableware?.name === "玉盏")
      ) {
        jadeOwner = pid;
      }
    }

    return {
      winnerId,
      scores,
      turns: this.state.turn,
      jadeOwner,
      strategies: { ...this.strategies },
    };
  }
}

// ============== 统计分析 ==============

function runSimulation(config: SimulationConfig): SimulationStats {
  const results: GameResult[] = [];
  let highTurnGames = 0;

  console.log(`\n🎲 开始蒙特卡洛模拟...`);
  console.log(`   游戏数: ${config.numGames}`);
  console.log(`   玩家数: ${config.numPlayers}`);
  console.log(`   策略: ${config.strategies.join(", ")}\n`);

  const startTime = Date.now();

  for (let i = 0; i < config.numGames; i++) {
    const sim = new GameSimulator(config.numPlayers, config.strategies);
    const result = sim.simulate();
    results.push(result);

    if (result.turns > 100 && highTurnGames < 3) {
      // 重新运行这个游戏并打印调试
      console.log(`\n[调试高回合数游戏 #${i}]`);
      const debugSim = new GameSimulator(config.numPlayers, config.strategies);
      debugSim.simulate(true);
    }

    if (result.turns > 100) {
      highTurnGames++;
    }

    if (config.verbose && (i + 1) % 100 === 0) {
      console.log(`   已完成 ${i + 1}/${config.numGames} 局`);
    }
  }

  const duration = (Date.now() - startTime) / 1000;
  console.log(`\n✅ 模拟完成! 用时 ${duration.toFixed(2)}s`);
  if (highTurnGames > 0) {
    console.log(`   ⚠️ 高回合数游戏(>100): ${highTurnGames}/${config.numGames}`);
  }

  // 统计分析
  const winsByStrategy: Record<AIStrategy, number> = {
    random: 0,
    greedy: 0,
    balanced: 0,
    offering_focused: 0,
    jade_rush: 0,
  };

  const scoresByStrategy: Record<AIStrategy, number[]> = {
    random: [],
    greedy: [],
    balanced: [],
    offering_focused: [],
    jade_rush: [],
  };

  const scoresByPosition: Record<string, number[]> = {};
  let totalTurns = 0;
  let jadeWins = 0;

  for (const result of results) {
    totalTurns += result.turns;

    // 胜者策略
    const winnerStrategy = result.strategies[result.winnerId];
    winsByStrategy[winnerStrategy]++;

    // 玉盏胜率
    if (result.jadeOwner === result.winnerId) {
      jadeWins++;
    }

    // 分数统计
    for (const [pid, score] of Object.entries(result.scores)) {
      const strategy = result.strategies[pid];
      scoresByStrategy[strategy].push(score);

      if (!scoresByPosition[pid]) scoresByPosition[pid] = [];
      scoresByPosition[pid].push(score);
    }
  }

  const avgScoreByStrategy: Record<AIStrategy, number> = {} as any;
  for (const [strategy, scores] of Object.entries(scoresByStrategy)) {
    avgScoreByStrategy[strategy as AIStrategy] =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }

  const avgScoreByPosition: Record<string, number> = {};
  for (const [pid, scores] of Object.entries(scoresByPosition)) {
    avgScoreByPosition[pid] = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  return {
    totalGames: config.numGames,
    winsByStrategy,
    avgScoreByStrategy,
    avgTurns: totalTurns / config.numGames,
    jadeWinRate: jadeWins / results.filter((r) => r.jadeOwner !== null).length,
    avgScoreByPosition,
  };
}

function printStats(stats: SimulationStats): void {
  console.log("\n" + "=".repeat(60));
  console.log("                    📊 模拟统计结果");
  console.log("=".repeat(60));

  console.log(`\n📈 总体数据:`);
  console.log(`   总游戏数: ${stats.totalGames}`);
  console.log(`   平均回合数: ${stats.avgTurns.toFixed(1)}`);
  console.log(`   玉盏持有者胜率: ${(stats.jadeWinRate * 100).toFixed(1)}%`);

  console.log(`\n🏆 策略胜率:`);
  const sortedStrategies = Object.entries(stats.winsByStrategy)
    .filter(([_, wins]) => wins > 0)
    .sort((a, b) => b[1] - a[1]);

  for (const [strategy, wins] of sortedStrategies) {
    const winRate = (wins / stats.totalGames) * 100;
    const bar = "█".repeat(Math.round(winRate / 2));
    console.log(`   ${strategy.padEnd(18)} ${bar} ${winRate.toFixed(1)}% (${wins}胜)`);
  }

  console.log(`\n📊 策略平均得分:`);
  const sortedAvgScores = Object.entries(stats.avgScoreByStrategy)
    .filter(([_, score]) => score !== 0)
    .sort((a, b) => b[1] - a[1]);

  for (const [strategy, avgScore] of sortedAvgScores) {
    console.log(`   ${strategy.padEnd(18)} ${avgScore.toFixed(2)} 分`);
  }

  console.log(`\n🎯 位置平均得分 (先后手优势分析):`);
  for (const [pid, avgScore] of Object.entries(stats.avgScoreByPosition).sort()) {
    console.log(`   玩家 ${pid}: ${avgScore.toFixed(2)} 分`);
  }

  console.log("\n" + "=".repeat(60));
}

// ============== 主程序 ==============

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║          🎴 玉盏春夜宴 - 蒙特卡洛模拟测试系统              ║");
  console.log("║                    v2.0 - 完整规则版                        ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  // 测试1: 随机 vs 随机 (基准测试)
  console.log("\n\n【测试1】随机策略基准测试");
  const stats1 = runSimulation({
    numGames: 500,
    numPlayers: 2,
    strategies: ["random", "random"],
    verbose: true,
  });
  printStats(stats1);

  // 调试: greedy vs balanced 单局
  console.log("\n\n【调试】greedy vs balanced 单局");
  const debugSim2 = new GameSimulator(2, ["greedy", "balanced"]);
  const debugResult2 = debugSim2.simulate(true);
  console.log(
    `\n回合数: ${debugResult2.turns}, 分数: P0=${debugResult2.scores["0"]}, P1=${debugResult2.scores["1"]}`
  );

  // 测试2: 策略对比
  console.log("\n\n【测试2】策略效果对比 (2人局)");
  const stats2 = runSimulation({
    numGames: 500,
    numPlayers: 2,
    strategies: ["greedy", "balanced"],
    verbose: true,
  });
  printStats(stats2);

  // 测试3: 多策略混战
  console.log("\n\n【测试3】多策略混战 (4人局)");
  const stats3 = runSimulation({
    numGames: 500,
    numPlayers: 4,
    strategies: ["random", "greedy", "balanced", "jade_rush"],
    verbose: true,
  });
  printStats(stats3);

  // 测试4: 奉献策略 vs 玉盏冲刺
  console.log("\n\n【测试4】奉献策略 vs 玉盏冲刺");
  const stats4 = runSimulation({
    numGames: 500,
    numPlayers: 2,
    strategies: ["offering_focused", "jade_rush"],
    verbose: true,
  });
  printStats(stats4);

  // 保存结果
  const outputDir = path.join(__dirname, "../simulation_results");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputPath = path.join(outputDir, `simulation_${timestamp}.json`);

  fs.writeFileSync(
    outputPath,
    JSON.stringify({ stats1, stats2, stats3, stats4 }, null, 2),
    "utf-8"
  );
  console.log(`\n📁 结果已保存至: ${outputPath}`);
}

main().catch(console.error);
