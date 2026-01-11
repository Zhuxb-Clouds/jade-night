# generateDecks.ts 脚本文档

> 内部开发交接文档  
> 最后更新：2026年1月11日

## 概述

`scripts/generateDecks.ts` 是一个 TypeScript 脚本，用于预生成游戏所需的卡牌数据。生成的 JSON 文件被 `config.ts` 加载以初始化游戏牌堆。

---

## 使用方式

### 运行命令

```bash
# 使用 npx 直接运行 TypeScript
npx tsx scripts/generateDecks.ts

# 或者使用 pnpm
pnpm exec tsx scripts/generateDecks.ts
```

### 输出

```
Deck data generated successfully to: /path/to/src/game/decks.json
- Snack cards: 102
- Tableware cards: 72
```

### 输出文件

- **路径**: `src/game/decks.json`
- **格式**: JSON
- **结构**:
```json
{
  "snackDeck": [...],
  "tablewareDeck": [...]
}
```

---

## 什么时候需要运行？

| 场景                       | 需要运行                |
| -------------------------- | ----------------------- |
| 首次克隆项目               | ✅ 是                    |
| 修改卡牌生成逻辑           | ✅ 是                    |
| 调整卡牌数量/属性          | ✅ 是                    |
| 日常开发/测试              | ❌ 否（已有 decks.json） |
| 更新游戏规则（不涉及卡牌） | ❌ 否                    |

---

## 卡牌生成规则

### 点心卡 (Snack) - 共 102 张

#### Level 1: 基础点心 (54 张)

- **属性**: 单色 × 单形 × 单温
- **组合**: 3色 × 3形 × 2温 = 18 种
- **数量**: 每种 3 张 → 54 张

```
示例: 红色-圆形-温热 → "玫瑰赤豆糕"
```

#### Level 2: 进阶点心 (36 张)

**双色点心 (18 张)**
- **属性**: 双色 × 单形 × 单温
- **组合**: 3 种双色组合 × 3形 × 2温 = 18 张

```
双色组合:
  - 红+绿
  - 绿+黄
  - 黄+红
```

**双形点心 (18 张)**
- **属性**: 单色 × 双形 × 单温
- **组合**: 3色 × 3 种双形组合 × 2温 = 18 张

```
双形组合:
  - 圆+方
  - 方+花
  - 花+圆
```

#### Level 3: 大师点心 (12 张)

**三色锦绣 (6 张)**
- **属性**: 全色 × 单形 × 单温
- **组合**: 3形 × 2温 = 6 张

**千层百态 (6 张)**
- **属性**: 单色 × 全形 × 单温
- **组合**: 3色 × 2温 = 6 张

---

### 食盘卡 (Tableware) - 共 72 张

#### Level 1: 粗瓷盘 (54 张)

- **属性**: 单色 × 单形 × 单温
- **组合**: 3色 × 3形 × 2温 = 18 种
- **数量**: 每种 3 张 → 54 张

#### Level 2: 细釉盘 (12 张)

| 子类型 | 属性特点           | 数量 |
| ------ | ------------------ | ---- |
| 双色盘 | 双色 × 单形 × 单温 | 4 张 |
| 双形盘 | 单色 × 双形 × 单温 | 4 张 |
| 全温盘 | 单色 × 单形 × 双温 | 4 张 |

#### Level 3: 珍宝盘 (6 张)

| 子类型 | 属性特点           | 数量 |
| ------ | ------------------ | ---- |
| 流光盘 | 全色 × 单形 × 单温 | 3 张 |
| 百花盘 | 单色 × 全形 × 单温 | 3 张 |

#### Level 4: 玉盏 (运行时生成)

> ⚠️ 玉盏不在此脚本中生成，而是在游戏运行时通过 `offer` 操作动态创建。

---

## 代码结构

```
generateDecks.ts
├── 枚举定义 (重复定义，避免导入 boardgame.io)
│   ├── CardColor
│   ├── CardShape
│   └── CardTemp
├── 接口定义
│   └── Card
├── 常量
│   ├── SNACK_NAMES (命名映射)
│   └── PLATE_NAMES (等级名称)
├── generateDecks() 函数
│   ├── 生成点心卡
│   │   ├── L1: 基础 (54)
│   │   ├── L2: 双色 (18) + 双形 (18)
│   │   └── L3: 三色 (6) + 三形 (6)
│   └── 生成食盘卡
│       ├── L1: 基础 (54)
│       ├── L2: 双色 (4) + 双形 (4) + 双温 (4)
│       └── L3: 流光 (3) + 百花 (3)
└── 文件写入
```

---

## 卡牌 ID 命名规则

| 类型        | 格式             | 示例             |
| ----------- | ---------------- | ---------------- |
| L1 点心     | `snack-L1-{n}`   | `snack-L1-0`     |
| L2 双色点心 | `snack-L2-C-{n}` | `snack-L2-C-54`  |
| L2 双形点心 | `snack-L2-S-{n}` | `snack-L2-S-72`  |
| L3 三色点心 | `snack-L3-C-{n}` | `snack-L3-C-90`  |
| L3 三形点心 | `snack-L3-S-{n}` | `snack-L3-S-96`  |
| L1 食盘     | `plate-L1-{n}`   | `plate-L1-102`   |
| L2 双色盘   | `plate-L2-C-{n}` | `plate-L2-C-156` |
| L2 双形盘   | `plate-L2-S-{n}` | `plate-L2-S-160` |
| L2 双温盘   | `plate-L2-T-{n}` | `plate-L2-T-164` |
| L3 流光盘   | `plate-L3-C-{n}` | `plate-L3-C-168` |
| L3 百花盘   | `plate-L3-S-{n}` | `plate-L3-S-171` |

---

## 扩展指南

### 添加新的卡牌类型

1. 在 `generateDecks()` 函数中添加生成逻辑
2. 更新 `SNACK_NAMES` 或 `PLATE_NAMES` 常量
3. 运行脚本重新生成 `decks.json`
4. 必要时更新 `config.ts` 中的类型定义

### 调整卡牌数量

修改循环中的重复次数：

```typescript
// 当前: 每种基础点心 3 张
for (let r = 0; r < 3; r++) { ... }

// 改为 2 张
for (let r = 0; r < 2; r++) { ... }
```

### 添加新属性

1. 添加新的枚举值
2. 更新 `Card` 接口
3. 在生成逻辑中处理新属性
4. **同步更新** `config.ts` 中的类型定义

---

## 注意事项

1. **枚举重复定义**: 脚本中重新定义了 `CardColor`、`CardShape`、`CardTemp`，避免导入依赖 `boardgame.io` 的 `config.ts`

2. **ID 唯一性**: 使用全局 `idCounter` 确保所有卡牌 ID 唯一

3. **牌堆分离**: 生成的 `tablewareDeck` 包含所有等级的食盘，在 `config.ts` 的 `setup` 中会分离为：
   - `tablewareDeck`: 仅 L1
   - `rewardDeck`: L2 + L3

4. **版本同步**: 修改卡牌属性时，确保 `generateDecks.ts` 和 `config.ts` 的类型定义保持一致

---

## 相关文件

- [config.ts](config-documentation.md) - 游戏核心配置
- [src/game/decks.json](../src/game/decks.json) - 生成的卡牌数据
- [GamePlay.md](../GamePlay.md) - 游戏规则文档
