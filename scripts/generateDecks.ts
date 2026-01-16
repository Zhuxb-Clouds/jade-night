// Script to generate deck data JSON file
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Duplicate enum values to avoid importing from config.ts (which depends on boardgame.io)
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

type CardColorType = (typeof CardColor)[keyof typeof CardColor];
type CardShapeType = (typeof CardShape)[keyof typeof CardShape];
type CardTempType = (typeof CardTemp)[keyof typeof CardTemp];

interface Card {
  id: string;
  type: "Snack" | "Tableware";
  name: string;
  attributes: {
    colors: CardColorType[];
    shapes: CardShapeType[];
    temps: CardTempType[];
  };
  level: number;
  description?: string;
}

const SNACK_NAMES: Record<string, string> = {
  // 基础点心 (54张)
  "red-circle-warm": "玫瑰赤豆糕",
  "red-circle-cold": "冰镇樱桃冻",
  "red-square-warm": "红枣方糕",
  "red-square-cold": "杨梅冰糕",
  "red-flower-warm": "桃花酥",
  "red-flower-cold": "玫瑰花冻",
  "green-circle-warm": "抹茶汤圆",
  "green-circle-cold": "薄荷糯米团",
  "green-square-warm": "艾草青团",
  "green-square-cold": "翡翠薄荷冻",
  "green-flower-warm": "茉莉花糕",
  "green-flower-cold": "绿豆冰糕",
  "yellow-circle-warm": "南瓜圆子",
  "yellow-circle-cold": "柠檬冻",
  "yellow-square-warm": "桂花糕",
  "yellow-square-cold": "芒果冰糕",
  "yellow-flower-warm": "金桂海棠酥",
  "yellow-flower-cold": "菊花冻",
  // 稀有珍馐 - 双色系 (3张)
  "twin-red-green": "鸳鸯双色卷",
  "twin-red-yellow": "金玉满堂糕",
  "twin-green-yellow": "翡翠金丝饼",
  // 稀有珍馐 - 双形系 (3张)
  "twin-circle-square": "乾坤方圆盒",
  "twin-circle-flower": "花好月圆饼",
  "twin-square-flower": "锦绣攒盒",
};

const PLATE_NAMES = {
  L1: "粗瓷盘",
  L2: "细釉盘",
  L3: "珍宝盘",
  L4: "玉盏",
};

function generateDecks() {
  const snackDeck: Card[] = [];
  const tablewareDeck: Card[] = [];
  let idCounter = 0;

  const colors = Object.values(CardColor);
  const shapes = Object.values(CardShape);
  const temps = Object.values(CardTemp);

  // ========== 点心牌生成 (60张 = 54基础 + 6稀有) ==========

  // 1. 基础点心 (54张): 3色 x 3形 x 2温 x 3张
  for (let r = 0; r < 3; r++) {
    // 3 copies -> 54 cards
    for (const c of colors) {
      for (const s of shapes) {
        for (const t of temps) {
          const key = `${c}-${s}-${t}`;
          const name = SNACK_NAMES[key] || `${c} ${s} ${t} 点心`;
          snackDeck.push({
            id: `snack-basic-${idCounter++}`,
            type: "Snack",
            name: name,
            attributes: { colors: [c], shapes: [s], temps: [t] },
            level: 1,
            description: "精致点心",
          });
        }
      }
    }
  }

  // 2. 稀有珍馐 - 双色系 (3张)
  // 双色点心拥有两种颜色，但形状和温度各只有一个（随机分配）
  const twinColors: [CardColor, CardColor, string][] = [
    [CardColor.RED, CardColor.GREEN, "twin-red-green"],
    [CardColor.RED, CardColor.YELLOW, "twin-red-yellow"],
    [CardColor.GREEN, CardColor.YELLOW, "twin-green-yellow"],
  ];

  twinColors.forEach(([c1, c2, key], idx) => {
    // 随机分配形状和温度（使用固定模式保证平衡）
    const shape = shapes[idx % 3];
    const temp = temps[idx % 2];
    snackDeck.push({
      id: `snack-twin-color-${idCounter++}`,
      type: "Snack",
      name: SNACK_NAMES[key] || "双色珍馐",
      attributes: { colors: [c1, c2], shapes: [shape], temps: [temp] },
      level: 2, // 稀有等级
      description: "双色风味，一口尽享两种色彩",
    });
  });

  // 3. 稀有珍馐 - 双形系 (3张)
  // 双形点心拥有两种形状，但颜色和温度各只有一个（随机分配）
  const twinShapes: [CardShape, CardShape, string][] = [
    [CardShape.CIRCLE, CardShape.SQUARE, "twin-circle-square"],
    [CardShape.CIRCLE, CardShape.FLOWER, "twin-circle-flower"],
    [CardShape.SQUARE, CardShape.FLOWER, "twin-square-flower"],
  ];

  twinShapes.forEach(([s1, s2, key], idx) => {
    // 随机分配颜色和温度（使用固定模式保证平衡）
    const color = colors[idx % 3];
    const temp = temps[(idx + 1) % 2]; // 错开以平衡冷暖
    snackDeck.push({
      id: `snack-twin-shape-${idCounter++}`,
      type: "Snack",
      name: SNACK_NAMES[key] || "双形珍馐",
      attributes: { colors: [color], shapes: [s1, s2], temps: [temp] },
      level: 2, // 稀有等级
      description: "双形造型，精美绝伦",
    });
  });

  // ========== 食器牌生成 (36张 = 18 L1 + 12 L2 + 6 L3) ==========

  // Level 1: 普通盘 (18张) - 单属性严格限制
  // 3色 x 3形 x 2温 = 18张，每种只有1张
  for (const c of colors) {
    for (const s of shapes) {
      for (const t of temps) {
        tablewareDeck.push({
          id: `plate-L1-${idCounter++}`,
          type: "Tableware",
          name: PLATE_NAMES.L1,
          attributes: { colors: [c], shapes: [s], temps: [t] },
          level: 1,
          description: "基础食器",
        });
      }
    }
  }

  // Level 2: Rare (12 cards)
  const l2_colors_combinations: CardColor[][] = [
    [CardColor.RED, CardColor.GREEN],
    [CardColor.GREEN, CardColor.YELLOW],
    [CardColor.YELLOW, CardColor.RED],
  ];

  // A. Dual Colors (4 cards)
  for (let i = 0; i < 4; i++) {
    const colorPair = l2_colors_combinations[i % 3];
    const shape = shapes[i % 3];
    const temp = temps[i % 2];
    tablewareDeck.push({
      id: `plate-L2-C-${idCounter++}`,
      type: "Tableware",
      name: PLATE_NAMES.L2,
      attributes: { colors: colorPair, shapes: [shape], temps: [temp] },
      level: 2,
      description: "双色兼容",
    });
  }

  // B. Dual Shapes (4 cards)
  const l2_shapes_combinations: CardShape[][] = [
    [CardShape.CIRCLE, CardShape.SQUARE],
    [CardShape.SQUARE, CardShape.FLOWER],
    [CardShape.FLOWER, CardShape.CIRCLE],
  ];
  for (let i = 0; i < 4; i++) {
    const shapePair = l2_shapes_combinations[i % 3];
    const color = colors[i % 3];
    const temp = temps[i % 2];
    tablewareDeck.push({
      id: `plate-L2-S-${idCounter++}`,
      type: "Tableware",
      name: PLATE_NAMES.L2,
      attributes: { colors: [color], shapes: shapePair, temps: [temp] },
      level: 2,
      description: "双形兼容",
    });
  }

  // C. Dual Temps (4 cards)
  for (let i = 0; i < 4; i++) {
    const color = colors[i % 3];
    const shape = shapes[i % 3];
    tablewareDeck.push({
      id: `plate-L2-T-${idCounter++}`,
      type: "Tableware",
      name: PLATE_NAMES.L2,
      attributes: { colors: [color], shapes: [shape], temps: [CardTemp.WARM, CardTemp.COLD] },
      level: 2,
      description: "全温兼容",
    });
  }

  // Level 3: Epic (6 cards)
  // A. All Colors
  for (let i = 0; i < 3; i++) {
    const shape = shapes[i % 3];
    const temp = temps[i % 2];
    tablewareDeck.push({
      id: `plate-L3-C-${idCounter++}`,
      type: "Tableware",
      name: "流光盘",
      attributes: { colors: Object.values(CardColor), shapes: [shape], temps: [temp] },
      level: 3,
      description: "全色兼容",
    });
  }

  // B. All Shapes
  for (let i = 0; i < 3; i++) {
    const color = colors[i % 3];
    const temp = temps[i % 2];
    tablewareDeck.push({
      id: `plate-L3-S-${idCounter++}`,
      type: "Tableware",
      name: "百花盘",
      attributes: { colors: [color], shapes: Object.values(CardShape), temps: [temp] },
      level: 3,
      description: "全形兼容",
    });
  }

  return { snackDeck, tablewareDeck };
}

// Generate and save to file
const decks = generateDecks();
const outputPath = path.join(__dirname, "../src/game/decks.json");

fs.writeFileSync(outputPath, JSON.stringify(decks, null, 2), "utf-8");
console.log(`Deck data generated successfully to: ${outputPath}`);
console.log(`- Snack cards: ${decks.snackDeck.length}`);
console.log(`- Tableware cards: ${decks.tablewareDeck.length}`);
