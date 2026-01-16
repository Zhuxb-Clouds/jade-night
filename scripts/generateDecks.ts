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
  "red-circle-warm": "玫瑰赤豆糕",
  "green-square-cold": "翡翠薄荷冻",
  "yellow-flower-warm": "金桂海棠酥",
  // 可以继续补充其他组合的命名，未命名的将使用默认生成逻辑
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

  // ==========================================
  // 1. Generate Snacks (资源牌)
  // ==========================================
  // 逻辑：54张 = 18种唯一组合 x 3张复本
  // 点心不分等级，统一为 Level 1 难度（单属性）
  
  for (let r = 0; r < 3; r++) { // 3 Copies
    for (const c of colors) {
      for (const s of shapes) {
        for (const t of temps) {
          const key = `${c}-${s}-${t}`;
          const name = SNACK_NAMES[key] || `${getColorName(c)}${getShapeName(s)}${getTempName(t)}`;
          
          snackDeck.push({
            id: `snack-${idCounter++}`,
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

  // ==========================================
  // 2. Generate Plates (工具牌)
  // ==========================================
  
  // ------------------------------------------
  // Level 1: 粗瓷盘 (Common) - 18 Cards
  // ------------------------------------------
  // 逻辑：18种唯一组合 x 1张。
  // 特征：单属性严格限制。难用，主要用于献祭。
  
  for (const c of colors) {
    for (const s of shapes) {
      for (const t of temps) {
        tablewareDeck.push({
          id: `plate-L1-${idCounter++}`,
          type: "Tableware",
          name: PLATE_NAMES.L1,
          attributes: { colors: [c], shapes: [s], temps: [t] },
          level: 1,
          description: "粗糙的器皿。属性严格限制，难以匹配。",
        });
      }
    }
  }

  // ------------------------------------------
  // Level 2: 细釉盘 (Rare) - 12 Cards
  // ------------------------------------------
  // 逻辑：双维度宽容。分为 A(双色), B(双形), C(全温) 三组。
  
  const l2_colors_pairs: CardColor[][] = [
    [CardColor.RED, CardColor.GREEN],
    [CardColor.GREEN, CardColor.YELLOW],
    [CardColor.YELLOW, CardColor.RED],
  ];

  const l2_shapes_pairs: CardShape[][] = [
    [CardShape.CIRCLE, CardShape.SQUARE],
    [CardShape.SQUARE, CardShape.FLOWER],
    [CardShape.FLOWER, CardShape.CIRCLE],
  ];

  // A. 双色盘 (4 Cards)
  // 逻辑：循环取双色组合，形状/温度轮询以保证随机性
  for (let i = 0; i < 4; i++) {
    const colorPair = l2_colors_pairs[i % 3]; // 轮询3种颜色组合
    const shape = shapes[i % 3];
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

  // ------------------------------------------
  // Level 3: 珍宝盘 (Epic) - 6 Cards
  // ------------------------------------------
  // 逻辑：单维度全通（万能）。

  // A. 流光盘 (全色兼容) - 3 Cards
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
        temps: [temp] 
      },
      level: 3,
      description: "稀世珍宝。流光溢彩，兼容所有颜色。",
    });
  }

  // B. 百花盘 (全形兼容) - 3 Cards
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
        temps: [temp] 
      },
      level: 3,
      description: "稀世珍宝。千姿百态，兼容所有形状。",
    });
  }

  return { snackDeck, tablewareDeck };
}

// Helper functions for naming (optional)
function getColorName(c: string) {
  const map: Record<string, string> = { red: "桃红", green: "柳绿", yellow: "鹅黄" };
  return map[c] || c;
}
function getShapeName(s: string) {
  const map: Record<string, string> = { circle: "圆满", square: "方正", flower: "花韵" };
  return map[s] || s;
}
function getTempName(t: string) {
  const map: Record<string, string> = { warm: "暖酥", cold: "冷冻" };
  return map[t] || t;
}

// Generate and save to file
const decks = generateDecks();
const outputPath = path.join(__dirname, "../src/game/decks.json");

// Ensure directory exists
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(decks, null, 2), "utf-8");
console.log(`Deck data generated successfully to: ${outputPath}`);
console.log(`- Snack cards: ${decks.snackDeck.length} (Target: 54)`);
console.log(`- Tableware cards: ${decks.tablewareDeck.length} (Target: 36)`);