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
  "red-circle-warm": "玫瑰赤豆糕",
  "green-square-cold": "翡翠薄荷冻",
  "yellow-flower-warm": "金桂海棠酥",
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

  // 1. Generate Snacks
  // Level 1: Basic (1 Color, 1 Shape, 1 Temp) - 18 Types
  for (let r = 0; r < 2; r++) { // 2 copies -> 36 cards
    for (const c of colors) {
      for (const s of shapes) {
        for (const t of temps) {
          const key = `${c}-${s}-${t}`;
          const name = SNACK_NAMES[key] || `${c} ${s} ${t} 点心`;
          snackDeck.push({
            id: `snack-L1-${idCounter++}`,
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

  // Level 2: Advanced (Dual Color OR Dual Shape) - 1 Temp (Mutex Rule)
  // Dual Colors (3 combos) x 3 Shapes x 2 Temps = 18 cards
  const snack_l2_colors: CardColor[][] = [
    [CardColor.RED, CardColor.GREEN],
    [CardColor.GREEN, CardColor.YELLOW],
    [CardColor.YELLOW, CardColor.RED],
  ];
  for (const colorPair of snack_l2_colors) {
    for (const s of shapes) {
      for (const t of temps) {
        snackDeck.push({
          id: `snack-L2-C-${idCounter++}`,
          type: "Snack",
          name: "双色点心",
          attributes: { colors: colorPair, shapes: [s], temps: [t] },
          level: 2,
          description: "双色风味",
        });
      }
    }
  }

  // Dual Shapes (3 combos) x 3 Colors x 2 Temps = 18 cards
  const snack_l2_shapes: CardShape[][] = [
    [CardShape.CIRCLE, CardShape.SQUARE],
    [CardShape.SQUARE, CardShape.FLOWER],
    [CardShape.FLOWER, CardShape.CIRCLE],
  ];
  for (const shapePair of snack_l2_shapes) {
    for (const c of colors) {
      for (const t of temps) {
        snackDeck.push({
          id: `snack-L2-S-${idCounter++}`,
          type: "Snack",
          name: "双形点心",
          attributes: { colors: [c], shapes: shapePair, temps: [t] },
          level: 2,
          description: "精美造型",
        });
      }
    }
  }

  // Level 3: Master (Triple Color OR Triple Shape) - 1 Temp
  // All Colors (1 combo) x 3 Shapes x 2 Temps = 6 cards
  for (const s of shapes) {
    for (const t of temps) {
      snackDeck.push({
        id: `snack-L3-C-${idCounter++}`,
        type: "Snack",
        name: "三色锦绣",
        attributes: { colors: Object.values(CardColor), shapes: [s], temps: [t] },
        level: 3,
        description: "集三色之精华",
      });
    }
  }

  // All Shapes (1 combo) x 3 Colors x 2 Temps = 6 cards
  for (const c of colors) {
    for (const t of temps) {
      snackDeck.push({
        id: `snack-L3-S-${idCounter++}`,
        type: "Snack",
        name: "千层百态",
        attributes: { colors: [c], shapes: Object.values(CardShape), temps: [t] },
        level: 3,
        description: "技艺登峰造极",
      });
    }
  }

  // 2. Generate Plates - Level 1: Common (18 cards)
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
