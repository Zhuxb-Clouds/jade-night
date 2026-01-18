// Script to generate deck data JSON file
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enums
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
  level: number; // For Snacks, strictly 1. For Plates, 1-3.
  description?: string;
}

// 命名映射表
const SNACK_NAMES: Record<string, string> = {
  // 基础点心 (36张: 3色 x 3形 x 2温 x 2重复)
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
  // 稀有珍馐 - 双色系 (6张，每种2张)
  "twin-red-green": "鸳鸯双色卷",
  "twin-red-yellow": "金玉满堂糕",
  "twin-green-yellow": "翡翠金丝饼",
  // 稀有珍馐 - 双形系 (6张，每种2张)
  "twin-circle-square": "乾坤方圆盒",
  "twin-circle-flower": "花好月圆饼",
  "twin-square-flower": "锦绣攒盒",
  // 顶级点心 - Epic (6张)
  "epic-twin-color-twin-shape": "锦绣鸳鸯盒",
  "epic-triple-color": "三彩琉璃糕",
  "epic-triple-shape": "百花攒盒",
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

  // ========== 点心牌生成 (54张 = 36基础 + 12稀有 + 6顶级) ==========

  // 1. 基础点心 (36张): 3色 x 3形 x 2温 x 2张
  for (let r = 0; r < 2; r++) {
    // 2 copies -> 36 cards
    for (const c of colors) {
      for (const s of shapes) {
        for (const t of temps) {
          const key = `${c}-${s}-${t}`;
          const name = SNACK_NAMES[key] || `${getColorName(c)}${getShapeName(s)}${getTempName(t)}`;

          snackDeck.push({
            id: `snack-basic-${idCounter++}`,
            type: "Snack",
            name: name,
            attributes: { colors: [c], shapes: [s], temps: [t] },
            level: 1, // 点心本身没有等级，视为基础物品
            description: "美味的点心，需放置在食器上。",
          });
        }
      }
    }
  }

  // 2. 稀有珍馐 - 双色系 (6张，每种2张)
  // 双色点心拥有两种颜色，但形状和温度各只有一个（随机分配）
  const twinColors: [CardColor, CardColor, string][] = [
    [CardColor.RED, CardColor.GREEN, "twin-red-green"],
    [CardColor.RED, CardColor.YELLOW, "twin-red-yellow"],
    [CardColor.GREEN, CardColor.YELLOW, "twin-green-yellow"],
  ];

  twinColors.forEach(([c1, c2, key], idx) => {
    // 每种双色点心2张
    for (let r = 0; r < 2; r++) {
      const shape = shapes[(idx + r) % 3];
      const temp = temps[(idx + r) % 2];
      snackDeck.push({
        id: `snack-twin-color-${idCounter++}`,
        type: "Snack",
        name: SNACK_NAMES[key] || "双色珍馐",
        attributes: { colors: [c1, c2], shapes: [shape], temps: [temp] },
        level: 2, // 稀有等级
        description: "双色风味，一口尽享两种色彩",
      });
    }
  });

  // 3. 稀有珍馐 - 双形系 (6张，每种2张)
  // 双形点心拥有两种形状，但颜色和温度各只有一个（随机分配）
  const twinShapes: [CardShape, CardShape, string][] = [
    [CardShape.CIRCLE, CardShape.SQUARE, "twin-circle-square"],
    [CardShape.CIRCLE, CardShape.FLOWER, "twin-circle-flower"],
    [CardShape.SQUARE, CardShape.FLOWER, "twin-square-flower"],
  ];

  twinShapes.forEach(([s1, s2, key], idx) => {
    // 每种双形点心2张
    for (let r = 0; r < 2; r++) {
      const color = colors[(idx + r) % 3];
      const temp = temps[(idx + r + 1) % 2]; // 错开以平衡冷暖
      snackDeck.push({
        id: `snack-twin-shape-${idCounter++}`,
        type: "Snack",
        name: SNACK_NAMES[key] || "双形珍馐",
        attributes: { colors: [color], shapes: [s1, s2], temps: [temp] },
        level: 2, // 稀有等级
        description: "双形造型，精美绝伦",
      });
    }
  });

  // 4. 顶级点心 Epic (6张)
  // 双色双形 (2张)
  for (let i = 0; i < 2; i++) {
    snackDeck.push({
      id: `snack-epic-twin-twin-${idCounter++}`,
      type: "Snack",
      name: SNACK_NAMES["epic-twin-color-twin-shape"] || "锦绣鸳鸯盒",
      attributes: {
        colors: [colors[i % 3], colors[(i + 1) % 3]],
        shapes: [shapes[i % 3], shapes[(i + 1) % 3]],
        temps: [temps[i % 2]],
      },
      level: 3,
      description: "双色双形，精美绝伦",
    });
  }

  // 三色 (2张)
  for (let i = 0; i < 2; i++) {
    snackDeck.push({
      id: `snack-epic-triple-color-${idCounter++}`,
      type: "Snack",
      name: SNACK_NAMES["epic-triple-color"] || "三彩琉璃糕",
      attributes: {
        colors: Object.values(CardColor),
        shapes: [shapes[i % 3]],
        temps: [temps[i % 2]],
      },
      level: 3,
      description: "三色绚烂，极致华美",
    });
  }

  // 三形 (2张)
  for (let i = 0; i < 2; i++) {
    snackDeck.push({
      id: `snack-epic-triple-shape-${idCounter++}`,
      type: "Snack",
      name: SNACK_NAMES["epic-triple-shape"] || "百花攒盒",
      attributes: {
        colors: [colors[i % 3]],
        shapes: Object.values(CardShape),
        temps: [temps[i % 2]],
      },
      level: 3,
      description: "三形荟萃，工艺精湛",
    });
  }

  // ========== 食器牌生成 (42张 = 20 L1 + 16 L2 + 6 L3) ==========

  // Level 1: 普通盘 (20张) - 单属性严格限制
  // 需要20张，而3x3x2=18，所以增加2张额外的
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
  // 额外2张L1盘子（随机属性组合）
  tablewareDeck.push({
    id: `plate-L1-extra-${idCounter++}`,
    type: "Tableware",
    name: PLATE_NAMES.L1,
    attributes: { colors: [CardColor.RED], shapes: [CardShape.CIRCLE], temps: [CardTemp.WARM] },
    level: 1,
    description: "基础食器",
  });
  tablewareDeck.push({
    id: `plate-L1-extra-${idCounter++}`,
    type: "Tableware",
    name: PLATE_NAMES.L1,
    attributes: { colors: [CardColor.GREEN], shapes: [CardShape.SQUARE], temps: [CardTemp.COLD] },
    level: 1,
    description: "基础食器",
  });

  // Level 2: Rare (16 cards)
  const l2_colors_combinations: CardColor[][] = [
    [CardColor.RED, CardColor.GREEN],
    [CardColor.GREEN, CardColor.YELLOW],
    [CardColor.YELLOW, CardColor.RED],
  ];

  // A. Dual Colors (6 cards)
  for (let i = 0; i < 6; i++) {
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

  // B. Dual Shapes (6 cards)
  const l2_shapes_combinations: CardShape[][] = [
    [CardShape.CIRCLE, CardShape.SQUARE],
    [CardShape.SQUARE, CardShape.FLOWER],
    [CardShape.FLOWER, CardShape.CIRCLE],
  ];
  for (let i = 0; i < 6; i++) {
    const shapePair = l2_shapes_combinations[i % 3];
    const color = colors[i % 3];
    const temp = temps[i % 2];

    tablewareDeck.push({
      id: `plate-L2-DualColor-${idCounter++}`,
      type: "Tableware",
      name: `${PLATE_NAMES.L2}·双色`,
      attributes: { colors: colorPair, shapes: [shape], temps: [temp] },
      level: 2,
      description: "做工精良。兼容两种颜色。",
    });
  }

  // B. 双形盘 (4 Cards)
  for (let i = 0; i < 4; i++) {
    const shapePair = l2_shapes_pairs[i % 3]; // 轮询3种形状组合
    const color = colors[i % 3];
    const temp = temps[i % 2]; // 温度交替

    tablewareDeck.push({
      id: `plate-L2-DualShape-${idCounter++}`,
      type: "Tableware",
      name: `${PLATE_NAMES.L2}·双形`,
      attributes: { colors: [color], shapes: shapePair, temps: [temp] },
      level: 2,
      description: "做工精良。兼容两种形状。",
    });
  }

  // C. 全温盘 (4 Cards)
  // 逻辑：温度全兼容 (Warm + Cold)
  for (let i = 0; i < 4; i++) {
    const color = colors[i % 3];
    const shape = shapes[i % 3]; // 形状倒序轮询，增加差异

    tablewareDeck.push({
      id: `plate-L2-OmniTemp-${idCounter++}`,
      type: "Tableware",
      name: `${PLATE_NAMES.L2}·温润`,
      attributes: { colors: [color], shapes: [shape], temps: [CardTemp.WARM, CardTemp.COLD] },
      level: 2,
      description: "做工精良。冷热皆宜，材质分必得。",
    });
  }

  // Level 3: Epic (6 cards)
  // A. All Colors (百花盘 - 全色兼容) (3张)
  for (let i = 0; i < 3; i++) {
    const shape = shapes[i % 3];
    const temp = temps[i % 2];

    tablewareDeck.push({
      id: `plate-L3-Prismatic-${idCounter++}`,
      type: "Tableware",
      name: "流光盘",
      attributes: {
        colors: Object.values(CardColor), // All Colors
        shapes: [shape],
        temps: [temp],
      },
      level: 3,
      description: "稀世珍宝。流光溢彩，兼容所有颜色。",
    });
  }

  // B. All Shapes (流光盘 - 全形兼容) (3张)
  for (let i = 0; i < 3; i++) {
    const color = colors[i % 3];
    const temp = temps[i % 2]; // 不同于上面的温度选择逻辑，尽量错开

    tablewareDeck.push({
      id: `plate-L3-HundredFlowers-${idCounter++}`,
      type: "Tableware",
      name: "百花盘",
      attributes: {
        colors: [color],
        shapes: Object.values(CardShape), // All Shapes
        temps: [temp],
      },
      level: 3,
      description: "稀世珍宝。千姿百态，兼容所有形状。",
    });
  }

  return { snackDeck, tablewareDeck };
}
// Generate and save to file
const decks = generateDecks();
const outputPath = path.join(__dirname, "../src/game/decks.json");

// Ensure directory exists
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(decks, null, 2), "utf-8");
console.log(`Deck data generated successfully to: ${outputPath}`);
console.log(`- Snack cards: ${decks.snackDeck.length} (预期54张)`);
console.log(`- Tableware cards: ${decks.tablewareDeck.length} (预期42张)`);
