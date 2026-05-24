# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指引。

## 项目简介

桌游《玉盏春夜宴》的数字化原型，用于验证数值平衡与核心机制。前端基于 React + Vite + TypeScript + Tailwind，游戏状态由 [boardgame.io](https://boardgame.io/) 管理，多人联机通过自定义 WebSocket 中继服务器实现。

`README.md` 描述面向玩家的规则。`GamePlay.md` 是详细的策划文档——在修改计分公式、玉盏判定逻辑或阈值之前，请先阅读它。

## 常用命令

```bash
pnpm install          # 安装依赖
pnpm server           # 启动 WebSocket 中继服务（端口 9000，联机必须运行）
pnpm dev              # 启动 Vite 开发服务器（端口 5173，已开启 --host 支持局域网）
pnpm build            # tsc && vite build，类型检查包含在构建流程中
pnpm preview          # 预览生产构建产物
```

`pnpm server` 和 `pnpm dev` 需在两个终端中同时运行。客户端会根据 `window.location.hostname` 自动连接到 `ws://<hostname>:9000`。

如需在调整平衡后重新生成卡牌数据：

```bash
npx tsx scripts/generateDecks.ts    # 重新生成 src/game/decks.json
```

`decks.json` 已纳入版本管理，由客户端通过 `import` 直接引用——**不要手动编辑**，请修改 `scripts/generateDecks.ts` 后重新运行。

目前没有配置测试套件和代码检查工具，`tsc`（通过 `pnpm build` 触发）是唯一的静态检查手段。

## 架构说明

### 主机权威模型，并非真正的 P2P

尽管文件名中带有 `P2PContext.tsx`，实际运行模型是**主机权威 + WebSocket 中继**，而非真正的 P2P：

- `server/index.js` 是轻量级中继服务，负责管理房间、按加入顺序分配 `playerId`（"0"、"1"……）并转发消息。它**不执行任何游戏逻辑**。
- **主机**（玩家 "0"，即第一个发送 `HOST_GAME` 的客户端）在本地实例化 `Client({ game: JadeNightGame })`。游戏逻辑**只在主机端执行**。
- 其他玩家（客机）不实例化 boardgame.io 客户端，只接收主机广播的 `STATE` 消息（即序列化的 `State<JadeNightState>` 快照）。
- 当客机执行操作时：客机发送 `MOVE` 消息 → 中继转发给主机 → 主机调用 `client.moves[name](...args)` → 主机的 subscribe 回调将新状态广播给所有客机。

主机通过在执行 move 前调用 `gameClientRef.current.updatePlayerID(movePlayerId)` 来临时切换玩家身份，执行后恢复为 `"0"`（[src/network/P2PContext.tsx#L88-L96](src/network/P2PContext.tsx#L88-L96)）。这是关键逻辑——所有读取 `playerID` 或 `ctx.currentPlayer` 的 move 处理函数都依赖此切换。新增 move 类型时无需额外接线，现有的分发机制已覆盖。

重要影响：**主机断线则房间销毁**（[server/index.js#L154-L163](server/index.js#L154-L163)），暂无主机迁移机制。

### 游戏状态存储于 `G`

所有游戏状态均存储在 boardgame.io 管理的 `JadeNightState` 对象中（[src/game/config.ts](src/game/config.ts)）。boardgame.io 使用 Immer，因此在 `moves` 中直接修改 `G` 是正确做法。所有需要同步给客机的数据都必须存放在 `G` 中——主机本地的 React state 不会被传播。

关键数据结构：
- `G.publicArea` — 8 个公共槽位（`PublicSlot[]`），每个可放一件食器 + 一份点心
- `G.players[pid]` — `waitingArea`（最多 5）、`personalArea`（最多 5）、`offeringArea`（最多 5）、`actionPoints`、`bonusSnackFromJade`
- `G.snackDeck` / `G.tablewareDeck`（L1 抽牌堆）/ `G.rewardDeck`（L2+，奉献奖励时发放）
- `G.notification` — 上一次奉献/玉盏掷骰的单次 UI 通知，由 Board 组件读取后清除

### 玩家人数处理

玩家数量是动态的。主机始终以 `numPlayers: 5` 初始化 boardgame.io 客户端，然后由 `startGame` 这个 move 将 `G.players` 裁剪至实际人数。游戏阈值（`endThreshold`、`jadeThreshold`）通过 `getGameThresholds` 函数从 `Object.keys(G.players).length` 推导，而非 `ctx.numPlayers`——编写依赖人数的逻辑时，请遵循相同规则。

自定义回合顺序（[src/game/config.ts#L177-L189](src/game/config.ts#L177-L189)）只在裁剪后的玩家集合中循环，避免了 boardgame.io 默认按原始 5 人轮转的问题。

### 卡牌数据

- **点心**：54 张（颜色×形状×材质 = 18 种唯一组合 × 3 份副本），均为单属性。数据中 `level: 1`，但等级比较只对食器有意义。
- **食器**：36 张，分为 L1（18 张，单属性，公共抽牌堆）、L2（12 张）、L3（6 张）。L2/L3 存放在 `G.rewardDeck`，由 `offer` move 在奖励时发放。
- **玉盏** 不在卡牌数据中，而是在 `offer` move 内奉献 L3 食器时动态构造并转移（[src/game/config.ts#L525-L536](src/game/config.ts#L525-L536)）。

### UI 结构

- `Lobby`（游戏前大厅）和 `Board`（游戏中）均渲染在 `P2PProvider` 内；当 `gameState` 为 null 时，`Board` 提前返回不渲染。
- 拖拽功能使用 `@dnd-kit/core`，`useDraggable`/`useDroppable` 直接写在 `Board.tsx` 内（没有单独的卡牌组件文件，卡牌视图为内联的 `CardView`）。

## 设计文档

`docs/` 目录下存放桌游设计文档，与代码实现相互参照：

| 文件 | 说明 |
|------|------|
| [docs/事件卡设计文档.md](docs/事件卡设计文档.md) | 30张事件卡完整设计，含4T框架、分类说明与组件清单 |
| [docs/人物卡设计文档.md](docs/人物卡设计文档.md) | 4位人物角色技能设计，含互动矩阵与事件卡联动速查 |
| [docs/人物卡设计初步范例.md](docs/人物卡设计初步范例.md) | 4位人物的叙事原型与性格描述（初稿参考）|

**注意**：设计文档中的配对分维度为**颜色/形状/材质**（不是温度）。奉献门槛为**配对分≥2**，奉献区只按食器等级计分（L1=1/L2=2/L3=3）。代码实现与设计文档如有出入，以 `GamePlay.md` 为准。

## 开发约定

- 所有状态变更逻辑必须写在 [src/game/config.ts](src/game/config.ts) 的 `moves` 中，不得从 UI 组件或网络层直接修改 `G`。
- Move 消耗完最后 AP 后，应在 move 内部主动调用 `events.endTurn()`——除非玩家仍有待处理的 `bonusSnackFromJade`，否则不要依赖玩家手动结束回合。
- 检查 move 合法性时返回 `INVALID_MOVE`（从 `boardgame.io/core` 导入），不要抛出异常。
- 修改游戏平衡（牌组构成、阈值、计分）通常需要同步更新三处：`scripts/generateDecks.ts`、`src/game/config.ts` 中的 `getGameThresholds` / 计分逻辑，以及 `README.md` / `GamePlay.md`。
