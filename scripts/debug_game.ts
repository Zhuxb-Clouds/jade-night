/**
 * 调试脚本：运行单局游戏并输出详细信息
 */

import { GameSimulator } from "./simulation";

const sim = new GameSimulator(4, ["balanced", "greedy", "random", "balanced"]);

const result = sim.simulate(true); // debug = true

console.log("\n=== 最终结果 ===");
console.log(`回合数: ${result.turns}`);
console.log(`获胜者: P${result.winnerId}`);
console.log(`玉盏持有者: ${result.jadeOwner ?? "无"}`);
console.log("\n分数:");
for (const [pid, score] of Object.entries(result.scores)) {
  console.log(`  P${pid} (${result.strategies[pid]}): ${score}分`);
}
