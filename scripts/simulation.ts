/**
 * 玉盏春夜宴 - 蒙特卡洛模拟测试模块
 *
 * 用于测试游戏平衡性、策略有效性和统计分析
 *
 * 重构说明：
 * - 使用 boardgame.io Client 运行实际游戏逻辑
 * - 从 config.ts 导入类型和计分函数，避免重复实现
 * - AI 策略与游戏运行解耦
 *
 * 运行方式: npx tsx scripts/simulation.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  GameState,
  PlayerState,
  WaitingItem,
  Card,
  CardColor,
  CardShape,
  CardTemp,
  calculatePairingScore,
  calculateFinalScore,
  createInitialState,
  drawTableware,
  refillPublicSnacks,
  nextPlayer,
  isGameOver,
} from "../src/game/core.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============== AI 策略类型 ==============

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

// ============== 游戏模拟器 (使用 core.ts 游戏逻辑) ==============

export class GameSimulator {
  private state: GameState;
  private strategies: Record<string, AIStrategy>;
  private maxTurns = 200;

  constructor(numPlayers: number, strategies: AIStrategy[]) {
    this.state = createInitialState(numPlayers);

    this.strategies = {};
    for (let i = 0; i < numPlayers; i++) {
      this.strategies[i.toString()] = strategies[i % strategies.length];
    }
  }

  private getState(): GameState {
    return this.state;
  }

  private getCurrentPlayer(): string {
    return this.state.currentPlayer;
  }

  private checkGameOver(): boolean {
    return isGameOver(this.state);
  }

  private getTurn(): number {
    return this.state.turn;
  }

  /**
   * 获取玩家可用的行动列表
   */
  private getAvailableActions(pid: string): string[] {
    const G = this.getState();
    const player = G.players[pid];
    const actions: string[] = [];

    if (player.actionPoints <= 0) return ["endTurn"];

    // 拿取点心 - 放到有空位的盘子上
    for (let i = 0; i < G.publicArea.length; i++) {
      const slot = G.publicArea[i];
      if (slot.snack) {
        for (let j = 0; j < player.waitingArea.length; j++) {
          const item = player.waitingArea[j];
          // 普通盘子：没有点心时可以放
          if (item.tableware && !item.snack) {
            actions.push(`takeSnack:${i}:${j}`);
          }
        }
      }
    }

    // 拿取食器 - 从盘子堆抽取（先L1，后L2）
    if (
      player.waitingArea.length < 5 &&
      (G.tablewareDeck.length > 0 || G.rewardDeck.some((c) => c.level === 2))
    ) {
      actions.push("takeTableware");
    }

    // 品鉴 - 每回合只能一次
    if (!player.tasteDoneThisTurn) {
      for (let j = 0; j < player.waitingArea.length; j++) {
        const item = player.waitingArea[j];
        // 盘子有点心
        if (item.tableware && item.snack) {
          actions.push(`taste:${j}`);
        }
      }
    }

    // 奉献 - 配对分≥2
    for (let j = 0; j < player.waitingArea.length; j++) {
      const item = player.waitingArea[j];
      if (item.tableware && item.snack) {
        const score = calculatePairingScore(item);
        if (score >= 2) {
          actions.push(`offer:${j}`);
        }
      }
    }

    // 敬茶 - 检查茶券条件（基础9个减去奉献区数量），消耗3AP
    if (!G.jadeGiven && player.actionPoints >= 3) {
      const baseCost = 9;
      const discount = player.offeringArea.length;
      const actualCost = Math.max(0, baseCost - discount);
      if (player.teaTokens >= actualCost) {
        actions.push("serveTea");
      }
    }

    // 【调整】弃置点心（解套用）
    for (let j = 0; j < player.waitingArea.length; j++) {
      const item = player.waitingArea[j];
      if (item.snack) {
        actions.push(`discardSnack:${j}`);
      }
    }

    // 【调整】移动点心到空盘（不消耗AP）
    for (let srcIdx = 0; srcIdx < player.waitingArea.length; srcIdx++) {
      const source = player.waitingArea[srcIdx];
      if (source.snack) {
        for (let dstIdx = 0; dstIdx < player.waitingArea.length; dstIdx++) {
          const target = player.waitingArea[dstIdx];
          if (target.tableware && !target.snack && dstIdx !== srcIdx && !target.snacks) {
            actions.push(`moveSnack:${srcIdx}:${dstIdx}`);
          }
        }
      }
    }

    // 使用茶券
    if (player.teaTokens > 0) {
      actions.push("useTeaToken");
    }

    actions.push("endTurn");
    return actions;
  }

  /**
   * 执行一个行动（直接操作游戏状态）
   */
  private executeAction(action: string): boolean {
    const G = this.state;
    const player = G.players[G.currentPlayer];
    const parts = action.split(":");

    try {
      switch (parts[0]) {
        case "takeSnack": {
          // 拿取点心放到盘子上（1AP）
          const slotIdx = parseInt(parts[1]);
          const targetIdx = parseInt(parts[2]);
          const slot = G.publicArea[slotIdx];
          const target = player.waitingArea[targetIdx];

          if (slot?.snack && target?.tableware && !target.snack) {
            target.snack = slot.snack;
            slot.snack = undefined;
            player.actionPoints--;

            // 立即补充点心
            refillPublicSnacks(G);
          }
          return true;
        }

        case "takeTableware": {
          // 抽取盘子（1AP）
          if (player.waitingArea.length < 5) {
            const tableware = drawTableware(G);
            if (tableware) {
              player.waitingArea.push({
                id: `item-${Date.now()}-${Math.random()}`,
                tableware: tableware,
              });
              player.actionPoints--;
            }
          }
          return true;
        }

        case "taste": {
          const itemIdx = parseInt(parts[1]);
          const item = player.waitingArea[itemIdx];

          if (item && !player.tasteDoneThisTurn) {
            if (item.tableware && item.snack) {
              player.waitingArea.splice(itemIdx, 1);
              player.personalArea.push(item);
              player.actionPoints--;
              player.tasteDoneThisTurn = true;

              // 茶券奖励：每2个品鉴获得1茶券
              if (player.personalArea.length % 2 === 0) {
                player.teaTokens++;
              }
            }
          }
          return true;
        }

        case "offer": {
          const itemIdx = parseInt(parts[1]);
          const item = player.waitingArea[itemIdx];

          if (item?.tableware && item.snack) {
            const score = calculatePairingScore(item);

            if (score >= 2) {
              const level = item.tableware.level;
              player.waitingArea.splice(itemIdx, 1);
              player.offeringArea.push(item);
              player.actionPoints--;

              // 配对分>=3获得茶券
              if (score >= 3) player.teaTokens++;

              // 奖励盘
              if (level === 1) {
                const reward = G.rewardDeck.find((c) => c.level === 2);
                if (reward) {
                  G.rewardDeck = G.rewardDeck.filter((c) => c !== reward);
                  player.waitingArea.push({
                    id: `reward-${Date.now()}-${Math.random()}`,
                    tableware: reward,
                  });
                }
              } else if (level === 2) {
                const reward = G.rewardDeck.find((c) => c.level === 3);
                if (reward) {
                  G.rewardDeck = G.rewardDeck.filter((c) => c !== reward);
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
          return true;
        }

        case "serveTea": {
          if (!G.jadeGiven && player.actionPoints >= 3) {
            const baseCost = 9;
            const discount = player.offeringArea.length;
            const actualCost = Math.max(0, baseCost - discount);

            if (player.teaTokens >= actualCost) {
              player.teaTokens -= actualCost;
              player.actionPoints -= 3; // 敬茶消耗3AP
              player.hasJadeChalice = true;
              G.jadeGiven = true;
            }
          }
          return true;
        }

        case "discardSnack": {
          const itemIdx = parseInt(parts[1]);
          const item = player.waitingArea[itemIdx];
          if (item?.snack) {
            item.snack = undefined;
            player.actionPoints--;
          }
          return true;
        }

        case "moveSnack": {
          // 调整点心位置（不消耗AP）
          const srcIdx = parseInt(parts[1]);
          const dstIdx = parseInt(parts[2]);
          const source = player.waitingArea[srcIdx];
          const target = player.waitingArea[dstIdx];

          if (source?.snack && target?.tableware && !target.snack) {
            target.snack = source.snack;
            source.snack = undefined;
            // 不消耗AP
          }
          return true;
        }

        case "useTeaToken": {
          if (player.teaTokens > 0) {
            player.teaTokens--;
            player.actionPoints++;
          }
          return true;
        }

        case "endTurn": {
          player.actionPoints = 0;
          return true;
        }

        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  // AI 策略选择行动
  private chooseAction(pid: string): string {
    const strategy = this.strategies[pid];
    const actions = this.getAvailableActions(pid);

    if (actions.length === 1) return actions[0];

    switch (strategy) {
      case "random":
        return this.randomStrategy(actions);
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

  private randomStrategy(actions: string[]): string {
    const validActions = actions.filter((a) => a !== "endTurn");
    if (validActions.length === 0) return "endTurn";
    return validActions[Math.floor(Math.random() * validActions.length)];
  }

  /**
   * 兜底行动：当没有最优解时，总得干点什么
   */
  private fallbackAction(actions: string[], player: PlayerState): string {
    const validActions = actions.filter((a) => a !== "endTurn");
    if (validActions.length === 0) return "endTurn";

    // 优先级1：如果等待区快满了（>=4），积极清理
    if (player.waitingArea.length >= 4) {
      const offer = validActions.find((a) => a.startsWith("offer:"));
      if (offer) return offer;
      const taste = validActions.find((a) => a.startsWith("taste:"));
      if (taste) return taste;
      const discard = validActions.find((a) => a.startsWith("discardSnack:"));
      if (discard) return discard;
    }

    // 优先级2：惜食（1AP双收益）
    const combo = validActions.find((a) => a.startsWith("takeCombo:"));
    if (combo) return combo;

    // 优先级3：拿点心（推进游戏）
    const takeSnack = validActions.filter((a) => a.startsWith("takeCard:snack:"));
    if (takeSnack.length > 0) {
      return takeSnack[Math.floor(Math.random() * takeSnack.length)];
    }

    // 优先级4：品鉴任意
    const taste = validActions.find((a) => a.startsWith("taste:"));
    if (taste) return taste;

    // 优先级5：奉献任意
    const offer = validActions.find((a) => a.startsWith("offer:"));
    if (offer) return offer;

    // 优先级6：拿盘子（但要控制数量）
    if (player.waitingArea.length < 4) {
      const takeTableware = validActions.find((a) => a.startsWith("takeCard:tableware:"));
      if (takeTableware) return takeTableware;
    }

    // 优先级7：弃牌
    const discard = validActions.find((a) => a.startsWith("discardSnack:"));
    if (discard) return discard;

    return validActions[Math.floor(Math.random() * validActions.length)] || "endTurn";
  }

  private greedyStrategy(pid: string, actions: string[]): string {
    const G = this.getState();
    const player = G.players[pid];

    // 惜食优先
    const combo = actions.find((a) => a.startsWith("takeCombo:"));
    if (combo) return combo;

    // 优先品鉴高分配对
    const tasteActions = actions.filter((a) => a.startsWith("taste:"));
    if (tasteActions.length > 0) {
      let bestTaste = tasteActions[0];
      let bestScore = 0;
      for (const action of tasteActions) {
        const itemIdx = parseInt(action.split(":")[1]);
        const item = player.waitingArea[itemIdx];
        if (item) {
          const score = calculatePairingScore(item);
          if (score > bestScore) {
            bestScore = score;
            bestTaste = action;
          }
        }
      }
      if (bestScore >= 1) return bestTaste;
    }

    // 拿取点心
    const takeSnackActions = actions.filter((a) => a.startsWith("takeCard:snack:"));
    if (takeSnackActions.length > 0) {
      return takeSnackActions[Math.floor(Math.random() * takeSnackActions.length)];
    }

    // 拿取食器（控制数量）
    const takeTablewareActions = actions.filter((a) => a.startsWith("takeCard:tableware:"));
    if (takeTablewareActions.length > 0 && player.waitingArea.length < 3) {
      return takeTablewareActions[0];
    }

    // 品鉴任意
    if (tasteActions.length > 0) return tasteActions[0];

    // 奉献
    const offerActions = actions.filter((a) => a.startsWith("offer:"));
    if (offerActions.length > 0) return offerActions[0];

    return this.fallbackAction(actions, player);
  }

  private balancedStrategy(pid: string, actions: string[]): string {
    const G = this.getState();
    const player = G.players[pid];

    // 敬茶优先
    if (actions.includes("serveTea")) return "serveTea";

    // 惜食优先
    const combo = actions.find((a) => a.startsWith("takeCombo:"));
    if (combo) return combo;

    // 奉献高分配对
    const offerActions = actions.filter((a) => a.startsWith("offer:"));
    for (const action of offerActions) {
      const itemIdx = parseInt(action.split(":")[1]);
      const item = player.waitingArea[itemIdx];
      if (item) {
        const score = calculatePairingScore(item);
        if (score >= 2) return action;
      }
    }

    // 品鉴高分配对
    const tasteActions = actions.filter((a) => a.startsWith("taste:"));
    for (const action of tasteActions) {
      const itemIdx = parseInt(action.split(":")[1]);
      const item = player.waitingArea[itemIdx];
      if (item) {
        const score = calculatePairingScore(item);
        if (score >= 2) return action;
      }
    }

    // 拿取点心
    const takeSnackActions = actions.filter((a) => a.startsWith("takeCard:snack:"));
    if (takeSnackActions.length > 0) {
      return takeSnackActions[Math.floor(Math.random() * takeSnackActions.length)];
    }

    const takeTablewareActions = actions.filter((a) => a.startsWith("takeCard:tableware:"));
    if (takeTablewareActions.length > 0 && player.waitingArea.length < 3) {
      return takeTablewareActions[0];
    }

    if (offerActions.length > 0) return offerActions[0];
    if (tasteActions.length > 0) return tasteActions[0];

    return this.fallbackAction(actions, player);
  }

  private offeringFocusedStrategy(pid: string, actions: string[]): string {
    const G = this.getState();
    const player = G.players[pid];

    // 敬茶优先
    if (actions.includes("serveTea")) return "serveTea";

    // 惜食优先
    const combo = actions.find((a) => a.startsWith("takeCombo:"));
    if (combo) return combo;

    // 优先奉献（核心策略）
    const offerActions = actions.filter((a) => a.startsWith("offer:"));
    if (offerActions.length > 0) {
      // 优先奉献L1/L2以升级
      for (const action of offerActions) {
        const itemIdx = parseInt(action.split(":")[1]);
        const item = player.waitingArea[itemIdx];
        if (item?.tableware && item.tableware.level < 3) {
          return action;
        }
      }
      return offerActions[0];
    }

    // 拿取点心凑配对
    const takeSnackActions = actions.filter((a) => a.startsWith("takeCard:snack:"));
    if (takeSnackActions.length > 0) {
      return takeSnackActions[Math.floor(Math.random() * takeSnackActions.length)];
    }

    // 拿取食器（控制数量）
    const takeTablewareActions = actions.filter((a) => a.startsWith("takeCard:tableware:"));
    if (takeTablewareActions.length > 0 && player.waitingArea.length < 3) {
      return takeTablewareActions[0];
    }

    // 品鉴（清库存）
    const tasteActions = actions.filter((a) => a.startsWith("taste:"));
    if (tasteActions.length > 0) return tasteActions[0];

    return this.fallbackAction(actions, player);
  }

  private jadeRushStrategy(pid: string, actions: string[]): string {
    const G = this.getState();
    const player = G.players[pid];

    // 敬茶最高优先
    if (actions.includes("serveTea")) return "serveTea";

    // 惜食优先
    const combo = actions.find((a) => a.startsWith("takeCombo:"));
    if (combo) return combo;

    // 快速奉献积累资历
    const offerActions = actions.filter((a) => a.startsWith("offer:"));
    if (offerActions.length > 0) {
      // 优先奉献低级盘以获取高级盘
      for (const action of offerActions) {
        const itemIdx = parseInt(action.split(":")[1]);
        const item = player.waitingArea[itemIdx];
        if (item?.tableware && item.tableware.level === 1) {
          return action;
        }
      }
      return offerActions[0];
    }

    // 拿取点心
    const takeSnackActions = actions.filter((a) => a.startsWith("takeCard:snack:"));
    if (takeSnackActions.length > 0) {
      return takeSnackActions[Math.floor(Math.random() * takeSnackActions.length)];
    }

    // 品鉴获取茶券
    const tasteActions = actions.filter((a) => a.startsWith("taste:"));
    if (tasteActions.length > 0) return tasteActions[0];

    // 使用茶券加速（但要留够敬茶用的）
    const baseCost = 9;
    const discount = player.offeringArea.length;
    const actualCost = Math.max(0, baseCost - discount);
    if (player.teaTokens > actualCost + 1 && actions.includes("useTeaToken")) {
      return "useTeaToken";
    }

    // 拿取食器（控制数量）
    const takeTablewareActions = actions.filter((a) => a.startsWith("takeCard:tableware:"));
    if (takeTablewareActions.length > 0 && player.waitingArea.length < 3) {
      return takeTablewareActions[0];
    }

    return this.fallbackAction(actions, player);
  }

  public simulate(debug = false): GameResult {
    let actionCount = 0;
    const maxActions = this.maxTurns * Object.keys(this.strategies).length * 10;

    if (debug) {
      const G = this.getState();
      console.log(`初始点心数: ${G.snackDeck.length}`);
      console.log(`初始食器数: ${G.tablewareDeck.length}`);
    }

    while (!this.checkGameOver() && actionCount < maxActions) {
      const pid = this.getCurrentPlayer();
      const G = this.getState();
      const player = G.players[pid];

      if (!player) break;

      // 每个回合执行行动直到结束
      let turnActions = 0;
      while (player.actionPoints > 0 && turnActions < 20 && actionCount < maxActions) {
        const apBefore = player.actionPoints;
        const action = this.chooseAction(pid);

        if (debug && actionCount < 50) {
          console.log(
            `[${actionCount}] P${pid}: ${action} (点心剩余: ${G.snackDeck.length}, AP: ${apBefore})`,
          );
        }

        const success = this.executeAction(action);
        actionCount++;
        turnActions++;

        // 如果执行失败或者是 endTurn，结束本轮
        if (!success || action === "endTurn") break;

        // 重新检查 AP
        if (player.actionPoints <= 0) break;
      }

      // 结束回合，切换到下一个玩家
      if (!this.checkGameOver()) {
        nextPlayer(this.state);
      }
    }

    // 计算结果
    const G = this.getState();
    const scores: Record<string, number> = {};
    let maxScore = -Infinity;
    let winnerId = "0";
    let jadeOwner: string | null = null;

    for (const [pid, player] of Object.entries(G.players)) {
      const result = calculateFinalScore(player);
      scores[pid] = result.totalScore;

      if (result.totalScore > maxScore) {
        maxScore = result.totalScore;
        winnerId = pid;
      }

      // 检查玉盏
      if (player.hasJadeChalice) {
        jadeOwner = pid;
      }
    }

    if (debug) {
      console.log(`游戏结束! 回合: ${this.getTurn()}, 行动: ${actionCount}`);
    }

    return {
      winnerId,
      scores,
      turns: this.getTurn(),
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
  let jadeGames = 0;

  for (const result of results) {
    totalTurns += result.turns;

    // 胜者策略
    const winnerStrategy = result.strategies[result.winnerId];
    winsByStrategy[winnerStrategy]++;

    // 玉盏胜率
    if (result.jadeOwner !== null) {
      jadeGames++;
      if (result.jadeOwner === result.winnerId) {
        jadeWins++;
      }
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
    jadeWinRate: jadeGames > 0 ? jadeWins / jadeGames : 0,
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
  console.log("║                    v3.0 - 使用实际游戏引擎                  ║");
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
    `\n回合数: ${debugResult2.turns}, 分数: P0=${debugResult2.scores["0"]}, P1=${debugResult2.scores["1"]}`,
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
    "utf-8",
  );
  console.log(`\n📁 结果已保存至: ${outputPath}`);
}

main().catch(console.error);
