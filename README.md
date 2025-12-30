# Role
你是一位资深桌游开发工程师，擅长将复杂的数值规则转化为轻量级的 Web 代码原型。

# Task
请为桌游《玉盏春夜宴》开发一个联网验证原型。要求支持局域网 P2P 联网（使用 PeerJS），并严格实现以下规则系统。

# 1. 核心数据结构 (State Design)
- **Cards**: 包含 Color(3), Shape(3), Material(2)。
- **Plate Levels**: 
  - L1: 1/1/1 属性。
  - L2: 2/2/1 属性（兼容模式）。
  - L3: 万能维度属性。
  - Jade: 全万能。
- **Global G**: 
  - `publicArea`: { plates: [], desserts: [] }
  - `grandmaOffered`: 奉献区总数 N (用于判定)。
  - `players`: { [id]: { waiting: [], personal: [], offering: [], score: 0 } }

# 2. 核心算法逻辑 (Core Logic)
- **MatchScore(Plate, Dessert)**: 计算颜色、形状、材质的匹配度（1-3分）。需处理 Plate 的“属性集合”与 Dessert 的“单属性”求交集。
- **GrandmaCheck(PlayerID)**: 
  - 实现公式 $T = (N-6) + \text{playerOfferedCount} + \text{currentMatchScore}$。
  - 执行 2d6 随机判定。
- **FinalScoring**: 游戏结束时自动计算 $S = \sum P_{ind} + \sum P_{off} + C_{off} - C_{wait}$。

# 3. 技术要求 (Technical Stack)
- **Engine**: boardgame.io (使用其 Multiplayer/Local 模式)。
- **Network**: PeerJS 实现 WebRTC P2P 数据传输。
- **UI**: React + Tailwind CSS。
- **Layout**: 
  - 顶部：老太君奉献区（显示 N 值和进度条 12/12）。
  - 中部：公共牌堆（点击拿取）。
  - 底部：个人操作区（等待区、个人区、奉献区）。

# 4. Deliverables Required:
1. **Game Definition**: 完整的 `moves` 定义（takeCard, taste, offer, share）。
2. **Matching Engine**: 一个通用的属性匹配函数，支持多属性盘子（L2/L3）。
3. **P2P Wrapper**: 一个简单的 React Hook，用于初始化 PeerJS 并连接到另一台局域网设备。
4. **Visual Prototype**: 简易的卡牌组件，用颜色块和图标代表 [红/圆/暖] 等属性。

# Code Standards
- 所有的规则变更必须通过 `moves` 触发，确保状态同步。
- 奉献(Offer)动作后自动检查老太君判定逻辑。
- 严格限制等待区上限为 5。
# 局域网调试指南 (LAN Debugging Guide)

本原型使用 PeerJS 实现局域网内的 P2P 连接。由于没有使用公共服务器进行信令交换（为了保持纯净），我们需要手动交换 Peer ID，或者确保两台设备能访问同一个 PeerJS Server（默认使用 PeerJS Cloud，需要外网）。

**注意**: 默认配置使用 PeerJS 官方云服务器进行信令握手。这意味着虽然游戏数据是 P2P 传输的，但**建立连接时需要两台设备都能访问互联网**。

## 如何运行

1. **安装依赖**:
   ```bash
   npm install
   ```

2. **启动开发服务器**:
   ```bash
   npm run dev
   ```
   默认运行在 `http://localhost:5173`。

## 局域网联机步骤

1. **准备两台设备**:
   - 电脑 A (Host)
   - 电脑 B (Guest)
   - 确保两台设备都连接到互联网（用于 PeerJS 握手）。

2. **Host 端 (电脑 A)**:
   - 打开浏览器访问 `http://localhost:5173`。
   - 等待 "Your Peer ID" 显示出来（例如 `e3a1...`）。
   - 点击 **"Create Game (Host)"** 按钮。
   - 此时 Host 进入游戏大厅，等待连接。

3. **Guest 端 (电脑 B)**:
   - 打开浏览器访问 `http://localhost:5173` (如果是同一局域网，可能需要访问 `http://<Host_IP>:5173`，需配置 Vite 允许 host 访问: `npm run dev -- --host`)。
   - **重要**: 最好在两台不同的电脑上测试，或者使用两个不同的浏览器窗口（隐身模式）。
   - 在 "Enter Host ID" 输入框中，输入 Host 的 Peer ID。
   - 点击 **"Join"** 按钮。

4. **开始游戏**:
   - 连接成功后，双方都会进入游戏棋盘界面。
   - Host 点击 "Move Forward"，Guest 端应能实时看到进度条更新。
   - Guest 点击 "Move Forward"，Host 端应能实时看到进度条更新。

## 常见问题

- **无法连接**: 检查防火墙是否阻挡了 WebRTC。
- **ID 不显示**: 检查网络连接，PeerJS 云服务器可能被墙。
- **Vite 无法通过 IP 访问**: 启动时使用 `npm run dev -- --host`。

## 架构说明

- **P2PContext**: 管理 PeerJS 连接和 boardgame.io Client 的同步。
- **Host**: 运行权威游戏逻辑 (Master)，广播 State。
- **Guest**: 接收 State 渲染 UI，发送 Move 指令给 Host 执行。
