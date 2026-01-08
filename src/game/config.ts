import { Game } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';

// --- Card Attributes ---

export type CardType = 'Snack' | 'Tableware';

export enum CardColor { 
  RED = 'red', 
  GREEN = 'green', 
  YELLOW = 'yellow' 
}
export enum CardShape { 
  CIRCLE = 'circle', 
  SQUARE = 'square', 
  FLOWER = 'flower' 
}
export enum CardTemp { 
  WARM = 'warm', 
  COLD = 'cold' 
}

export interface CardAttributes {
  colors: CardColor[];
  shapes: CardShape[];
  temps: CardTemp[];
}

export interface Card {
  id: string;
  type: CardType;
  name: string;
  attributes: CardAttributes;
  level: number; // 0: Snack, 1: Common, 2: Rare, 3: Epic, 4: Jade
  description?: string;
}

export interface PublicSlot {
  id: string;
  tableware?: Card;
  snack?: Card;
}

export interface WaitingItem {
  id: string;
  tableware?: Card;
  snack?: Card;
}

export interface PlayerState {
  waitingArea: WaitingItem[]; // Cards in waiting area (Max 5)
  personalArea: WaitingItem[];
  offeringArea: WaitingItem[];
  actionPoints: number;
}

export interface NotificationState {
    type: 'offering' | 'gameover' | 'info';
    message: string;
    details?: any; // For displaying calculation breakdowns
    timestamp: number;
}

export interface JadeNightState {
  snackDeck: Card[];
  tablewareDeck: Card[]; // Public draw pile (L1 only)
  rewardDeck: Card[];    // Rewards for offering (L2, L3)
  publicArea: PublicSlot[];
  players: { [key: string]: PlayerState };
  isGameStarted: boolean;
  notification: NotificationState | null;
}

// --- Names for flavor ---

const SNACK_NAMES: Record<string, string> = {
  'red-circle-warm': '玫瑰赤豆糕',
  'green-square-cold': '翡翠薄荷冻',
  'yellow-flower-warm': '金桂海棠酥',
  // Fallbacks generated dynamically if not in list
};

const PLATE_NAMES = {
  L1: '粗瓷盘',
  L2: '细釉盘',
  L3: '珍宝盘',
  L4: '玉盏'
};

// --- Helpers ---

export const getGameThresholds = (numPlayers: number) => {
    if (numPlayers === 2) return { endThreshold: 8, jadeThreshold: 5 };
    if (numPlayers === 3) return { endThreshold: 10, jadeThreshold: 6 };
    return { endThreshold: 12, jadeThreshold: 7 }; // 4 or 5 players
};

const generateDecks = () => {
  const snackDeck: Card[] = [];
  const tablewareDeck: Card[] = [];
  let idCounter = 0;

  // 1. Generate Snacks: 3 x 3 x 2 x 3 = 54
  const colors = Object.values(CardColor);
  const shapes = Object.values(CardShape);
  const temps = Object.values(CardTemp);

  for (let r = 0; r < 3; r++) { // 3 Repetitions
    for (const c of colors) {
      for (const s of shapes) {
        for (const t of temps) {
          const key = `${c}-${s}-${t}`;
          const name = SNACK_NAMES[key] || `${c} ${s} ${t} 点心`; // Simple fallback
          snackDeck.push({
            id: `snack-${idCounter++}`,
            type: 'Snack',
            name: name,
            attributes: { colors: [c], shapes: [s], temps: [t] },
            level: 0
          });
        }
      }
    }
  }

  // 2. Generate Plates

  // Level 1: Common (18 cards) - Single attributes only
  // 1 color, 1 shape, 1 temp
  for (const c of colors) {
    for (const s of shapes) {
      for (const t of temps) {
        tablewareDeck.push({
          id: `plate-L1-${idCounter++}`,
          type: 'Tableware',
          name: PLATE_NAMES.L1,
          attributes: { colors: [c], shapes: [s], temps: [t] },
          level: 1,
          description: '基础食器'
        });
      }
    }
  }

  // Level 2: Rare (12 cards) - Two dimensions flexible or Material flexible
  // Strategy:
  // 4 cards: 2 Colors (fixed Shape/Temp)
  // 4 cards: 2 Shapes (fixed Color/Temp)
  // 4 cards: 2 Temps (fixed Color/Shape) -> effectively "Any Material" in L2 context
  
  // A. Dual Colors (4 cards)
  const l2_colors_combinations = [
    [CardColor.RED, CardColor.GREEN],
    [CardColor.GREEN, CardColor.YELLOW],
    [CardColor.YELLOW, CardColor.RED],
    [CardColor.RED, CardColor.GREEN] // Extra one to make 4? Or maybe randomize. Let's make 4 distinct if possible.
    // Actually, distinct pairs of 3 items are only 3: AB, BC, CA.
    // So we repeat one, or just loop through.
  ];
  
  let l2_count = 0;
  // Create 4 Dual-Color Plates
  for (let i = 0; i < 4; i++) {
    const colorPair = l2_colors_combinations[i % 3];
    // Rotate shapes and temps to add variety
    const shape = shapes[i % 3];
    const temp = temps[i % 2];
    tablewareDeck.push({
      id: `plate-L2-C-${idCounter++}`,
      type: 'Tableware',
      name: PLATE_NAMES.L2,
      attributes: { colors: colorPair, shapes: [shape], temps: [temp] },
      level: 2,
      description: '双色兼容'
    });
    l2_count++;
  }

  // B. Dual Shapes (4 cards)
  const l2_shapes_combinations = [
    [CardShape.CIRCLE, CardShape.SQUARE],
    [CardShape.SQUARE, CardShape.FLOWER],
    [CardShape.FLOWER, CardShape.CIRCLE]
  ];
  for (let i = 0; i < 4; i++) {
    const shapePair = l2_shapes_combinations[i % 3];
    const color = colors[i % 3];
    const temp = temps[i % 2];
    tablewareDeck.push({
      id: `plate-L2-S-${idCounter++}`,
      type: 'Tableware',
      name: PLATE_NAMES.L2,
      attributes: { colors: [color], shapes: shapePair, temps: [temp] },
      level: 2,
      description: '双形兼容'
    });
    l2_count++;
  }

  // C. Dual Temps (4 cards) - "Any Temp" effectively, as there are only 2.
  // We need to vary color and shape for these.
  for (let i = 0; i < 4; i++) {
    const color = colors[i % 3];
    const shape = shapes[i % 3]; // slightly different rotation to mix it up? (i+1)%3
    tablewareDeck.push({
      id: `plate-L2-T-${idCounter++}`,
      type: 'Tableware',
      name: PLATE_NAMES.L2,
      attributes: { colors: [color], shapes: [shape], temps: [CardTemp.WARM, CardTemp.COLD] },
      level: 2,
      description: '全温兼容'
    });
    l2_count++;
  }

  // Level 3: Epic (6 cards) - Single Dimension All-Pass
  // 3 cards: All Colors
  // 3 cards: All Shapes
  
  // A. All Colors
  for (let i = 0; i < 3; i++) {
    const shape = shapes[i % 3];
    const temp = temps[i % 2];
    tablewareDeck.push({
      id: `plate-L3-C-${idCounter++}`,
      type: 'Tableware',
      name: '流光盘', // from doc
      attributes: { colors: Object.values(CardColor), shapes: [shape], temps: [temp] },
      level: 3,
      description: '全色兼容'
    });
  }

  // B. All Shapes
  for (let i = 0; i < 3; i++) {
    const color = colors[i % 3];
    const temp = temps[i % 2];
    tablewareDeck.push({
      id: `plate-L3-S-${idCounter++}`,
      type: 'Tableware',
      name: '百花盘', // from doc
      attributes: { colors: [color], shapes: Object.values(CardShape), temps: [temp] },
      level: 3,
      description: '全形兼容'
    });
  }

  // Jade (Legendary) - Usually not in deck, but can be generated by Grandmother.
  // We might want to have it available as a template or in a separate "Supply".
  // For now, let's not put it in the initial deck to draw from, but the logic is ready.

  return { snackDeck, tablewareDeck };
};

// --- Score Logic ---

const calculatePairingScore = (item: WaitingItem): number => {
    if (!item.tableware || !item.snack) return 0;
    const p = item.tableware.attributes;
    const s = item.snack.attributes;

    let score = 0;
    // Color Match
    if (p.colors.some(c => s.colors.includes(c))) score += 1;
    // Shape Match
    if (p.shapes.some(sh => s.shapes.includes(sh))) score += 1;
    // Temp Match
    if (p.temps.some(t => s.temps.includes(t))) score += 1;
    
    return score;
};

const calculateFinalScore = (player: PlayerState) => {
    // S = Sum(P_ind) + Sum(P_off) + C_off - C_wait
    
    // 1. Personal Area Scores
    const sumP_ind = player.personalArea.reduce((sum, item) => sum + calculatePairingScore(item), 0);
    
    // 2. Offering Area Scores
    const sumP_off = player.offeringArea.reduce((sum, item) => sum + calculatePairingScore(item), 0);
    
    // 3. Offering Count Bonus (C_off)
    const c_off = player.offeringArea.length;
    
    // 4. Waiting Area Penalty (C_wait)
    const c_wait = player.waitingArea.length;
    
    const totalScore = sumP_ind + sumP_off + c_off - c_wait;
    
    return { totalScore, sumP_ind, sumP_off, c_off, c_wait };
};

const getGameThresholds = (numPlayers: number) => {
    if (numPlayers === 2) return { endThreshold: 12, jadeThreshold: 10 };
    if (numPlayers === 3) return { endThreshold: 10, jadeThreshold: 8 };
    if (numPlayers >= 4) return { endThreshold: 8, jadeThreshold: 6 };
    // Default fallback
    return { endThreshold: 12, jadeThreshold: 10 };
};

export const JadeNightGame: Game<JadeNightState> = {
  name: 'jade-night',

  minPlayers: 2,
  maxPlayers: 5,

  setup: ({ ctx }) => {
    const { snackDeck, tablewareDeck } = generateDecks();
    
    // Split tablewareDeck into Public (L1) and Reward (L2+)
    const l1Plates = tablewareDeck.filter(c => c.level === 1);
    const rewardPlates = tablewareDeck.filter(c => c.level > 1);

    const players: { [key: string]: PlayerState } = {};
    const numPlayers = ctx.numPlayers || 5;
    for (let i = 0; i < numPlayers; i++) {
        players[i.toString()] = {
            waitingArea: [],
            personalArea: [],
            offeringArea: [],
            actionPoints: 0
        };
    }

    // Initialize 8 public slots
    const publicArea: PublicSlot[] = [];
    for (let i = 0; i < 8; i++) {
        publicArea.push({ id: `public-slot-${i}` });
    }

    return {
      snackDeck,
      tablewareDeck: l1Plates,
      rewardDeck: rewardPlates,
      publicArea,
      players,
      isGameStarted: false,
      notification: null
    };
  },

  turn: {
      onBegin: ({ G, ctx }) => {
          const player = G.players[ctx.currentPlayer];
          if (player) {
              const personalCount = player.personalArea.length;
              // Base AP = 2. Bonus AP = +1 for every 2 plates in personal area.
              player.actionPoints = 2 + Math.floor(personalCount / 2);
          }
      }
  },

  endIf: ({ G, ctx }) => {
      const numPlayers = ctx.numPlayers || Object.keys(G.players).length || 2;
      const { endThreshold } = getGameThresholds(numPlayers);
      
      const totalOfferings = Object.values(G.players).reduce((sum, p) => sum + p.offeringArea.length, 0);
      
      if (totalOfferings >= endThreshold) {
           // Calculate scores
           const scores: Record<string, any> = {};
           let maxScore = -999;
           let winnerId = '';
           
           // Tie-breaking: 1. C_off, 2. C_wait (less is better) for Personal Area count? Doc says: "Personal Area Count less is better"
           // Doc: "Tie-break: C_off higher wins; if same, Personal Area count LOWER wins."
           
           Object.keys(G.players).forEach(pid => {
               const p = G.players[pid];
               const s = calculateFinalScore(p);
               scores[pid] = s;
               
               if (s.totalScore > maxScore) {
                   maxScore = s.totalScore;
                   winnerId = pid;
               } else if (s.totalScore === maxScore) {
                   // Tie break
                   const currentWinner = G.players[winnerId];
                   const currentScore = scores[winnerId];
                   
                   // 1. C_off higher
                   if (s.c_off > currentScore.c_off) {
                       winnerId = pid;
                   } else if (s.c_off === currentScore.c_off) {
                       // 2. Personal Area Count lower
                       if (p.personalArea.length < currentWinner.personalArea.length) {
                           winnerId = pid;
                       }
                   }
               }
           });
           
           return { scores, winnerId, reason: 'limit_reached' };
      }
  },

  moves: {
    startGame: ({ G, random, playerID }) => {
        // Only host (player 0) can start
        if (playerID !== '0') return INVALID_MOVE;
        if (G.isGameStarted) return INVALID_MOVE;
        
        // Shuffle all decks
        G.snackDeck = random.Shuffle(G.snackDeck);
        G.tablewareDeck = random.Shuffle(G.tablewareDeck); // Only L1
        G.rewardDeck = random.Shuffle(G.rewardDeck);       // L2 + L3

        // Distribute 1 L1 plate to each player
        Object.keys(G.players).forEach(pid => {
            if (G.tablewareDeck.length > 0) {
                const plate = G.tablewareDeck.shift();
                if (plate) {
                    G.players[pid].waitingArea.push({
                        id: `start-plate-${pid}-${Date.now()}`,
                        tableware: plate,
                        snack: undefined
                    });
                }
            }
        });

        // Fill public area (from remaining L1 deck)
        G.publicArea.forEach(slot => {
            if (G.tablewareDeck.length > 0) slot.tableware = G.tablewareDeck.shift();
            if (G.snackDeck.length > 0) slot.snack = G.snackDeck.shift();
        });
        
        // Initialize AP for current player
        const currentPlayer = G.players[playerID];
        if (currentPlayer) currentPlayer.actionPoints = 2;
        
        G.isGameStarted = true;
    },
    
    // Take card from public area
    takeCard: ({ G, playerID, events }, { cardId, targetSlotId }: { cardId: string, targetSlotId?: string }) => {
        const pid = playerID || '0';
        const player = G.players[pid];
        
        if (player.actionPoints <= 0) return INVALID_MOVE;

        // Find card in public area
        const slotIndex = G.publicArea.findIndex(s => s.tableware?.id === cardId || s.snack?.id === cardId);
        if (slotIndex === -1) return INVALID_MOVE;
        const slot = G.publicArea[slotIndex];
        
        let card: Card | undefined;
        let isSnack = false;

        // Logic: Must take Snack first if present
        if (slot.snack && slot.snack.id === cardId) {
            card = slot.snack;
            isSnack = true;
        } else if (!slot.snack && slot.tableware && slot.tableware.id === cardId) {
            card = slot.tableware;
            isSnack = false;
        } else {
            // Trying to take Tableware while Snack is present
            return INVALID_MOVE;
        }

        if (!card) return INVALID_MOVE;

        // Logic for placing card
        if (targetSlotId) {
            // Placing on existing slot (must be Snack on Tableware)
            const waitingSlot = player.waitingArea.find(s => s.id === targetSlotId);
            if (!waitingSlot) return INVALID_MOVE;
            
            // Can only place Snack on empty Tableware
            if (isSnack && waitingSlot.tableware && !waitingSlot.snack) {
                waitingSlot.snack = card;
            } else {
                return INVALID_MOVE;
            }
        } else {
            // Placing in new slot
            // Constraint: Snack CANNOT be placed in new slot (must go to existing plate)
            if (isSnack) return INVALID_MOVE;

            if (player.waitingArea.length >= 5) return INVALID_MOVE;
            
            const newItem: WaitingItem = {
                id: `slot-${Date.now()}-${Math.random()}`,
                tableware: card,
                snack: undefined
            };
            player.waitingArea.push(newItem);
        }

        // Remove from public slot
        if (isSnack) {
            slot.snack = undefined;
        } else {
            slot.tableware = undefined;
        }

        // Refresh slot if empty
        if (!slot.snack && !slot.tableware) {
            if (G.tablewareDeck.length > 0) slot.tableware = G.tablewareDeck.shift();
            if (G.snackDeck.length > 0) slot.snack = G.snackDeck.shift();
        }

        // Deduct AP
        player.actionPoints -= 1;

        // End turn if AP is 0
        if (player.actionPoints <= 0) {
            events.endTurn();
        }
    },

    taste: ({ G, playerID, events }, { slotId }: { slotId: string }) => {
        const player = G.players[playerID];
        if (player.actionPoints <= 0) return INVALID_MOVE;

        const slotIndex = player.waitingArea.findIndex(s => s.id === slotId);
        if (slotIndex === -1) return INVALID_MOVE;
        const item = player.waitingArea[slotIndex];

        // Must have plate and snack to taste (according to rules "Plate + Snack")
        // Rule B: "Move a set of 'Plate+Snack' to personal area"
        if (!item.tableware || !item.snack) return INVALID_MOVE;

        // Check Limit for Personal Area (Max 5)
        if (player.personalArea.length >= 5) return INVALID_MOVE;

        // Move to personal area
        player.personalArea.push(item);
        player.waitingArea.splice(slotIndex, 1);

        player.actionPoints -= 1;
        if (player.actionPoints <= 0) events.endTurn();
    },

    offer: ({ G, ctx, events, random }, { slotId }: { slotId: string }) => {
        const player = G.players[ctx.currentPlayer];
        if (player.actionPoints <= 0) return INVALID_MOVE;

        const slotIndex = player.waitingArea.findIndex(s => s.id === slotId);
        if (slotIndex === -1) return INVALID_MOVE;
        const item = player.waitingArea[slotIndex];

        if (!item.tableware || !item.snack) return INVALID_MOVE;
        
        // Validation: Material Match (Temp)
        // Rule C: "Material/Temp dimension must match"
        const hasTempMatch = item.tableware.attributes.temps.some(t => item.snack!.attributes.temps.includes(t));
        // Note: L3 plates might have all temps, so check attribute intersection.
        
        if (!hasTempMatch) return INVALID_MOVE; 

        // Check Limit for Offering Area (Max 5)
        if (player.offeringArea.length >= 5) return INVALID_MOVE;

        // Move to offering area
        player.offeringArea.push(item);
        player.waitingArea.splice(slotIndex, 1);

        // --- Loyalty Reward Logic ---
        const numPlayers = ctx.numPlayers || Object.keys(G.players).length || 2;
        const { jadeThreshold } = getGameThresholds(numPlayers);
        // Note: totalOfferings should include the one just added? Yes.
        const totalOfferings = Object.values(G.players).reduce((sum, p) => sum + p.offeringArea.length, 0);

        let rewardMessage = '';
        let jadeResult = null;
        let grantStandardReward = true;

        // 1. Jade Chalice Judgement
        // Condition: Total Offerings >= Jade Threshold
        // BUT, Jade Chalice is a unique item. We should only give it if not already given?
        // Or can multiple be given? Doc says "The Jade Chalice". Implying one.
        // Assuming unique for now, but implementation below allows multiple if not checked.
        // To prevent duplicate: check if any player has "Jade Chalice".
        const jadeAlreadyGiven = Object.values(G.players).some(p => 
            p.waitingArea.some(w => w.tableware?.name === '玉盏') || 
            p.personalArea.some(w => w.tableware?.name === '玉盏') ||
            p.offeringArea.some(w => w.tableware?.name === '玉盏')
        );

        if (totalOfferings >= jadeThreshold && !jadeAlreadyGiven) {
            const n_component = totalOfferings - (jadeThreshold - 1); // e.g. Threshold 10. Curr 10 => 10-(9) = 1.
            const p_offerings = player.offeringArea.length;
            const pair_score = calculatePairingScore(item); // item is what we just offered
            
            const T = n_component + p_offerings + pair_score;
            
            const d1 = random.D6();
            const d2 = random.D6();
            const roll = d1 + d2;
            const success = roll < T;
            
            jadeResult = {
                threshold: T,
                roll: roll,
                dice: [d1, d2],
                components: { n: n_component, p: p_offerings, s: pair_score },
                success
            };

            if (success) {
                // Grant Jade Chalice
                const jadeChalice: Card = {
                    id: `jade-chalice-${Date.now()}`,
                    type: 'Tableware',
                    name: '玉盏',
                    attributes: { 
                        colors: Object.values(CardColor), 
                        shapes: Object.values(CardShape), 
                        temps: Object.values(CardTemp) 
                    },
                    level: 4, // Legendary
                    description: '玉盏' 
                };
                
                player.waitingArea.push({
                    id: `jade-card-${Date.now()}`,
                    tableware: jadeChalice,
                    snack: undefined
                });
                
                rewardMessage = '判定成功！获得【玉盏】！';
                grantStandardReward = false; // Jade replaces standard reward
            } else {
                rewardMessage = '判定未通过。';
                // Fallback to standard reward
                grantStandardReward = true;
            }
        }
        
        // 2. Regular Upgrade (Standard Reward)
        if (grantStandardReward) {
            const currentLevel = item.tableware.level;
            const targetLevel = currentLevel + 1;
            const rewardIndex = G.rewardDeck.findIndex(c => c.level === targetLevel);
            
            if (rewardIndex !== -1) {
                 const rewardPlate = G.rewardDeck.splice(rewardIndex, 1)[0];
                 // Add to waiting area
                 player.waitingArea.push({
                     id: `reward-plate-${Date.now()}`,
                     tableware: rewardPlate,
                     snack: undefined
                 });
                 rewardMessage += ` 获得升级食盘 (L${targetLevel})。`;
            } else {
                 // No suitable plate? Just get nothing (or maybe score points? implied).
                 if (currentLevel < 3) rewardMessage += ` 牌堆无L${targetLevel}食盘。`;
                 else rewardMessage += ` 已达最高等级。`;
            }
        }

        player.actionPoints -= 1;
        
        // Set Notification for UI
        G.notification = {
            type: 'offering',
            message: rewardMessage,
            details: jadeResult,
            timestamp: Date.now()
        };

        if (player.actionPoints <= 0) events.endTurn();
    }
  },
};
