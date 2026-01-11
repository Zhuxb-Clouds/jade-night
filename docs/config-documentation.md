# config.ts 技术文档

> 内部开发交接文档  
> 最后更新：2026年1月11日

## 概述

`config.ts` 是基于 [boardgame.io](https://boardgame.io/) 框架实现的「玉夜」桌游核心配置文件。该文件定义了游戏的所有数据类型、状态结构、游戏规则和玩家操作。

---

## 目录

1. [数据类型定义](#1-数据类型定义)
2. [游戏状态结构](#2-游戏状态结构)
3. [辅助函数](#3-辅助函数)
4. [计分系统](#4-计分系统)
5. [游戏配置](#5-游戏配置)
6. [玩家操作 (Moves)](#6-玩家操作-moves)

---

## 1. 数据类型定义

### 1.1 卡牌类型

```typescript
type CardType = "Snack" | "Tableware"
```

- **Snack**: 点心卡
- **Tableware**: 食盘/餐具卡

### 1.2 卡牌属性枚举

| 枚举 | 值 | 说明 |
|------|-----|------|
| `CardColor` | `red`, `green`, `yellow` | 颜色属性 |
| `CardShape` | `circle`, `square`, `flower` | 形状属性 |
| `CardTemp` | `warm`, `cold` | 温度属性（冷/热） |

### 1.3 卡牌接口 (`Card`)

```typescript
interface Card {
  id: string;           // 唯一标识
  type: CardType;       // 卡牌类型
  name: string;         // 卡牌名称
  attributes: {
    colors: CardColor[];   // 可多值
    shapes: CardShape[];   // 可多值
    temps: CardTemp[];     // 可多值
  };
  level: number;        // 等级 1-3（普通）, 4（玉盏）
  description?: string; // 可选描述
}
```

### 1.4 槽位接口

| 接口 | 用途 |
|------|------|
| `PublicSlot` | 公共区域的卡槽，可放置一张食盘和一份点心 |
| `WaitingItem` | 玩家区域的卡槽，同样可放置食盘+点心组合 |

---

## 2. 游戏状态结构

### 2.1 玩家状态 (`PlayerState`)

```typescript
interface PlayerState {
  waitingArea: WaitingItem[];    // 等待区（最多5个槽位）
  personalArea: WaitingItem[];   // 个人区（已品尝，最多5个）
  offeringArea: WaitingItem[];   // 供奉区（已献祭，最多5个）
  actionPoints: number;          // 当前行动点
  bonusSnackFromJade?: boolean;  // 玉盏奖励：免费拿取点心
}
```

**区域说明：**

```
┌─────────────────────────────────────────────────────┐
│                    公共区域 (8槽)                    │
│  [食盘+点心] [食盘+点心] ... (共8个PublicSlot)       │
└─────────────────────────────────────────────────────┘
                         ↓ 拿取
┌─────────────────────────────────────────────────────┐
│  玩家等待区 (waitingArea, 最多5个)                   │
│  - 临时存放拿取的卡牌                                │
│  - 组合食盘+点心后可执行"品尝"或"供奉"               │
└─────────────────────────────────────────────────────┘
          ↓ 品尝(taste)              ↓ 供奉(offer)
┌──────────────────────┐    ┌──────────────────────────┐
│  个人区 (personalArea)│    │  供奉区 (offeringArea)    │
│  - 计入最终得分       │    │  - 计入最终得分           │
│  - 每2个+1行动点      │    │  - 触发忠诚奖励           │
└──────────────────────┘    └──────────────────────────┘
```

### 2.2 全局游戏状态 (`JadeNightState`)

```typescript
interface JadeNightState {
  snackDeck: Card[];         // 点心牌堆
  tablewareDeck: Card[];     // 食盘牌堆（仅L1）
  rewardDeck: Card[];        // 奖励牌堆（L2、L3）
  publicArea: PublicSlot[];  // 公共区域（8个槽位）
  players: { [key: string]: PlayerState };
  isGameStarted: boolean;
  notification: NotificationState | null;
}
```

---

## 3. 辅助函数

### 3.1 `getGameThresholds(numPlayers)`

根据玩家人数返回游戏阈值：

| 玩家数 | 结束阈值 (endThreshold) | 玉盏阈值 (jadeThreshold) |
|--------|------------------------|-------------------------|
| 2人    | 8                      | 5                       |
| 3人    | 10                     | 6                       |
| 4-5人  | 12                     | 7                       |

- **结束阈值**：全场供奉总数达到此值时游戏结束
- **玉盏阈值**：供奉总数达到此值时触发玉盏判定

### 3.2 `getDecks()`

从预生成的 `decks.json` 加载卡牌数据。

---

## 4. 计分系统

### 4.1 配对得分 (`calculatePairingScore`)

对于一个「食盘+点心」组合：

```
得分 = 颜色匹配(0/1) + 形状匹配(0/1) + 温度匹配(0/1) + 点心等级
```

- 属性匹配：食盘与点心的属性数组有交集则 +1
- 等级加成：直接加上点心的 level 值

### 4.2 最终得分 (`calculateFinalScore`)

```
总分 S = Sum(P_ind) + Sum(P_off) + C_off - C_wait
```

| 变量 | 含义 |
|------|------|
| `Sum(P_ind)` | 个人区所有组合的配对得分之和 |
| `Sum(P_off)` | 供奉区所有组合的配对得分之和 |
| `C_off` | 供奉区组合数量（奖励分） |
| `C_wait` | 等待区剩余数量（惩罚分） |

### 4.3 平局判定

1. **优先**：`C_off` 更高者胜
2. **次级**：个人区数量更少者胜

---

## 5. 游戏配置

### 5.1 基础配置

```typescript
{
  name: "jade-night",
  minPlayers: 2,
  maxPlayers: 5,
}
```

### 5.2 初始化 (`setup`)

1. 加载并分离牌堆：
   - `tablewareDeck`: 仅 L1 食盘
   - `rewardDeck`: L2 + L3 食盘
2. 创建玩家状态对象
3. 初始化 8 个公共槽位
4. 游戏未开始 (`isGameStarted: false`)

### 5.3 回合配置 (`turn`)

**回合顺序**：按玩家 ID 升序循环

**回合开始时**：
```typescript
行动点 = 2 + Math.floor(个人区数量 / 2)
```

即基础 2 点，每拥有 2 个个人区组合额外 +1 点。

### 5.4 游戏结束 (`endIf`)

当全场供奉总数 ≥ `endThreshold` 时：
- 计算所有玩家得分
- 确定胜者（含平局判定）
- 返回 `{ scores, winnerId, reason: "limit_reached" }`

---

## 6. 玩家操作 (Moves)

### 6.1 `startGame`

**触发者**：仅玩家 0（房主）

**功能**：
1. 可选：调整实际玩家数量
2. 洗牌（点心堆、L1食盘堆、奖励堆）
3. 每人发 1 张 L1 食盘到等待区
4. 填充公共区域（8槽各放食盘+点心）
5. 设置 `isGameStarted = true`

### 6.2 `takeCard`

**参数**：
- `cardId`: 要拿取的卡牌 ID
- `targetSlotId`: （可选）目标槽位 ID

**规则**：
1. 必须先拿点心，点心在时不能拿食盘
2. 点心必须放到已有食盘的槽位上
3. 食盘放入新槽位（等待区最多 5 个）
4. 消耗 1 行动点（玉盏奖励例外）
5. 槽位清空后自动补充

### 6.3 `takeJadeSnackFromWaiting`

**触发条件**：拥有 `bonusSnackFromJade = true`

**功能**：从任意玩家的等待区偷取一份点心（不消耗行动点）

### 6.4 `taste` (品尝)

**规则**：
- 必须是完整组合（食盘+点心）
- 个人区最多 5 个
- 消耗 1 行动点
- 将组合从等待区移至个人区

### 6.5 `offer` (供奉)

**规则**：
- 必须是完整组合（食盘+点心）
- **必须温度匹配**（食盘与点心的 `temps` 有交集）
- 供奉区最多 5 个
- 消耗 1 行动点

**奖励机制**：

#### 玉盏判定（首次触发且供奉总数 ≥ jadeThreshold）

```
判定阈值 T = n + p + s
  - n: 超过阈值的供奉数 (totalOfferings - (jadeThreshold - 1))
  - p: 当前玩家供奉区数量
  - s: 本次供奉组合的配对得分

掷 2D6，若 roll < T 则成功
```

**成功奖励**：
- 获得「玉盏」（L4 全属性食盘）
- `bonusSnackFromJade = true`
- 不发放普通升级奖励

#### 普通升级奖励

- 获得比当前食盘高一级的食盘（L1→L2, L2→L3）
- 放入等待区

### 6.6 `endTurn`

手动结束回合。

---

## 附录：玉盏 (Jade Chalice)

```typescript
{
  id: "jade-chalice-xxx",
  type: "Tableware",
  name: "玉盏",
  attributes: {
    colors: [ALL],   // 匹配所有颜色
    shapes: [ALL],   // 匹配所有形状
    temps: [ALL],    // 匹配所有温度
  },
  level: 4,
  description: "玉盏"
}
```

**特性**：
- 全属性匹配，配对得分天然 +3
- 获得时附赠一次免费拿取点心的机会

---

## 开发注意事项

1. **牌堆分离**：`tablewareDeck` 仅含 L1，`rewardDeck` 含 L2/L3
2. **行动点检查**：所有消耗行动点的操作需检查 `actionPoints > 0`
3. **自动结束回合**：行动点耗尽且无玉盏奖励时自动 `endTurn`
4. **通知系统**：`G.notification` 用于 UI 显示供奉结果
5. **玉盏唯一性**：通过遍历所有区域检查是否已发放

---

## 相关文件

- [decks.json](../src/game/decks.json) - 预生成的卡牌数据
- [generateDecks.ts](../scripts/generateDecks.ts) - 卡牌生成脚本
- [GamePlay.md](../GamePlay.md) - 游戏规则文档
