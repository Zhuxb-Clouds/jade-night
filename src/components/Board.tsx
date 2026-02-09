import React, { useState } from "react";
import { useP2P } from "../network/P2PContext";
import {
  Card as CardType,
  WaitingItem,
  PublicSlot,
  PendingGift,
  calculatePairingScore,
  calculateFinalScore,
  calculateSinglePairingScore,
} from "../game/config";
import { DndContext, useDraggable, useDroppable, DragEndEvent } from "@dnd-kit/core";

// --- Visual Components ---

const CardView: React.FC<{ card: CardType; overlayCard?: CardType; onClick?: () => void }> = ({
  card,
  overlayCard,
  onClick,
}) => {
  const isSnack = card.type === "Snack";

  const renderAttributes = (c: CardType) => {
    const isC_Snack = c.type === "Snack";
    const { colors, shapes, temps } = c.attributes;

    // Define fixed order for slots to ensure alignment
    const allColors = ["red", "green", "yellow"];
    const allShapes = ["circle", "square", "flower"];
    const allTemps = ["warm", "cold"];

    const renderSlot = (type: "color" | "shape" | "temp", value: string, isActive: boolean) => {
      const sizeClass = isC_Snack ? "w-3 h-3" : "w-5 h-5";
      let colorClass = "";
      let shapeStyle = "rounded-full";

      // Styling logic
      if (isActive) {
        // Color Logic
        if (type === "color") {
          if (value === "red") colorClass = isC_Snack ? "bg-rose-500" : "border-rose-500 border-2";
          else if (value === "green")
            colorClass = isC_Snack ? "bg-emerald-500" : "border-emerald-500 border-2";
          else if (value === "yellow")
            colorClass = isC_Snack ? "bg-amber-400" : "border-amber-400 border-2";
        }
        // Shape Logic
        else if (type === "shape") {
          colorClass = isC_Snack ? "bg-slate-600" : "border-slate-600 border-2";
          if (value === "square") shapeStyle = "rounded-md";
          else if (value === "flower") shapeStyle = "rotate-45 rounded-sm";
        }
        // Temp Logic
        else if (type === "temp") {
          if (value === "warm") {
            colorClass = isC_Snack ? "bg-orange-500" : "border-orange-500 border-2";
            shapeStyle = "rounded-t-lg";
          } else {
            // cold
            colorClass = isC_Snack ? "bg-cyan-500" : "border-cyan-500 border-2";
            shapeStyle = "rounded-b-lg";
          }
        }
      }

      return (
        <div key={`${type}-${value}`} className="flex items-center justify-center w-6 h-6">
          {isActive ? (
            <div
              className={`${sizeClass} ${colorClass} ${shapeStyle} shadow-sm transform transition-all`}
            />
          ) : (
            // Invisible placeholder to maintain layout spacing
            <div className="w-1 h-1" />
          )}
        </div>
      );
    };

    return (
      <div className="absolute inset-0 flex flex-col justify-evenly py-2 pointer-events-none">
        {/* Row 1: Color */}
        <div className="flex justify-center items-center h-8 w-full gap-1">
          {allColors.map((val) => renderSlot("color", val, colors.includes(val as any)))}
        </div>
        {/* Row 2: Shape */}
        <div className="flex justify-center items-center h-8 w-full gap-1">
          {allShapes.map((val) => renderSlot("shape", val, shapes.includes(val as any)))}
        </div>
        {/* Row 3: Temp */}
        <div className="flex justify-center items-center h-8 w-full gap-1">
          {allTemps.map((val) => renderSlot("temp", val, temps.includes(val as any)))}
        </div>
      </div>
    );
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative w-24 h-36 rounded-lg border shadow-sm m-1 transition-transform hover:scale-105
        ${isSnack ? "bg-pink-50/80 border-pink-200" : "bg-stone-50/80 border-stone-300"}
        flex flex-col items-center select-none overflow-hidden
      `}
    >
      {/* Header Level Indicator for Plates */}
      {!isSnack && (
        <div
          className={`absolute top-0 right-0 px-1.5 py-0.5 text-[8px] font-bold text-white rounded-bl-lg
            ${
              card.level === 1
                ? "bg-gray-400"
                : card.level === 2
                  ? "bg-blue-400"
                  : card.level === 3
                    ? "bg-purple-500"
                    : "bg-amber-500"
            }
         `}
        >
          L{card.level}
        </div>
      )}

      <div className="text-[10px] font-bold mt-2 text-gray-700 truncate w-full text-center px-1 z-10 font-serif">
        {card.name}
      </div>

      <div className="flex-grow w-full relative">
        {renderAttributes(card)}
        {overlayCard && renderAttributes(overlayCard)}
      </div>

      <div className="text-[9px] text-gray-400 mb-1 z-10 w-full text-center border-t border-gray-100 pt-1">
        {isSnack ? "点心" : card.description || "食器"}
      </div>

      {overlayCard && (
        <div className="absolute inset-0 bg-transparent rounded-lg pointer-events-none ring-2 ring-pink-300 ring-inset"></div>
      )}
    </div>
  );
};

// --- Dnd Components ---

const DraggableCard = ({ card }: { card: CardType }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: card.id,
    data: { card },
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 1000,
        cursor: "grabbing",
      }
    : { cursor: "grab" };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <CardView card={card} />
    </div>
  );
};

const DroppableSlot = ({
  slot,
  children,
  isCurrentPlayer,
}: {
  slot: WaitingItem;
  children: React.ReactNode;
  isCurrentPlayer: boolean;
}) => {
  // Check if this slot can accept snacks (only if empty and has tableware)
  const canAcceptSnack = !slot.snack && slot.tableware;

  const { setNodeRef, isOver } = useDroppable({
    id: slot.id,
    data: { type: "slot", slot },
    disabled: !isCurrentPlayer || !canAcceptSnack, // Enable drop if my area and can accept
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative ${isOver ? "ring-2 ring-emerald-400 rounded-lg" : ""}`}
    >
      {children}
    </div>
  );
};

const DroppableWaitingArea = ({
  children,
  isCurrentPlayer,
  adjustModeActive = false,
}: {
  children: React.ReactNode;
  isCurrentPlayer: boolean;
  adjustModeActive?: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: "waiting-area",
    data: { type: "area" },
    disabled: !isCurrentPlayer,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-[120px] bg-gray-900/50 rounded p-2 border border-dashed transition-all ${
        isOver ? "border-emerald-400 bg-emerald-900/20" : "border-gray-700"
      } ${adjustModeActive ? "pt-6 pr-6" : ""}`}
    >
      <div className="text-xs text-gray-500 mb-1">Waiting Area (Max 5) {adjustModeActive && <span className="text-amber-400">- 拖拽点心到其他盘子</span>}</div>
      <div className="flex flex-wrap">{children}</div>
    </div>
  );
};

const DroppablePersonalArea = ({
  children,
  isCurrentPlayer,
}: {
  children: React.ReactNode;
  isCurrentPlayer: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: "personal-area",
    data: { type: "area", area: "personal" },
    disabled: !isCurrentPlayer,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-[120px] bg-gray-900/50 rounded p-2 border border-dashed transition-colors ${
        isOver ? "border-amber-400 bg-amber-900/20" : "border-gray-700"
      }`}
    >
      <div className="text-xs text-gray-500 mb-1">Personal Area</div>
      <div className="flex flex-wrap">{children}</div>
    </div>
  );
};

const DroppableOfferingArea = ({
  children,
  isCurrentPlayer,
}: {
  children: React.ReactNode;
  isCurrentPlayer: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: "offering-area",
    data: { type: "area", area: "offering" },
    disabled: !isCurrentPlayer,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-[120px] bg-gray-900/50 rounded p-2 border border-dashed transition-colors ${
        isOver ? "border-purple-400 bg-purple-900/20" : "border-gray-700"
      }`}
    >
      <div className="text-xs text-gray-500 mb-1">Offering Area</div>
      <div className="flex flex-wrap">{children}</div>
    </div>
  );
};

// --- Player Area ---

const PlayerArea: React.FC<{
  playerId: string;
  playerState: any;
  isCurrentPlayer: boolean;
  adjustModeActive?: boolean;
  giftingSnack?: { snackId: string; snack: CardType } | null;
  onGiftTarget?: (targetPlayerId: string, targetSlotId: string) => void;
}> = ({ playerId, playerState, isCurrentPlayer, adjustModeActive = false, giftingSnack = null, onGiftTarget }) => {
  // Calculate real-time score
  const scoreData = playerState ? calculateFinalScore(playerState) : null;

  // 在调整模式下，分离显示点心和盘子
  const renderAdjustModeItem = (item: WaitingItem) => {
    if (!item.tableware) return null;
    
    const pairingScore = item.snack ? calculatePairingScore(item) : 0;
    
    return (
      <div className="relative">
        {/* 盘子（底层） */}
        <CardView key={`plate-${item.id}`} card={item.tableware} />
        
        {/* 点心（浮动在右上方，半透明，完整大小） */}
        {item.snack && (
          <div className="absolute -top-4 -right-4 z-20">
            <DraggableSnackInAdjustMode slotId={item.id} snack={item.snack} />
          </div>
        )}
        
        {/* 配对分徽章 */}
        {pairingScore > 0 && (
          <div
            className={`absolute -bottom-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg z-30
            ${
              pairingScore >= 3
                ? "bg-emerald-500 text-white"
                : pairingScore >= 2
                  ? "bg-amber-500 text-white"
                  : "bg-gray-500 text-white"
            }`}
            title={`配对分: ${pairingScore}`}
          >
            {pairingScore}
          </div>
        )}
      </div>
    );
  };

  // Render a waiting item with optional pairing score badge
  const renderWaitingItem = (
    item: WaitingItem,
    isDraggable: boolean = false,
    showPairingScore: boolean = false,
  ) => {
    const pairingScore = showPairingScore ? calculatePairingScore(item) : 0;

    // Special case: deflected penalty item - show as face-down card with -3 badge
    if (item.isDeflectedPenalty) {
      return (
        <div className="relative">
          <div className="w-16 h-24 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg border-2 border-slate-500 flex items-center justify-center shadow-md">
            <div className="text-slate-400 text-xs text-center">
              <div className="text-2xl mb-1">🚫</div>
              <div>弹回</div>
            </div>
          </div>
          <div
            className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg bg-red-600 text-white"
            title="弹回惩罚: -3分"
          >
            -3
          </div>
        </div>
      );
    }

    const content = (() => {
      if (item.tableware && item.snack) {
        return <CardView key={item.id} card={item.tableware} overlayCard={item.snack} />;
      }
      // Check for Jade Chalice with multiple snacks
      if (item.tableware && item.snacks && item.snacks.length > 0) {
        return <CardView key={item.id} card={item.tableware} overlayCard={item.snacks[0]} />;
      }
      const card = item.tableware || item.snack;
      return card ? <CardView key={item.id} card={card} /> : null;
    })();

    if (!content) return null;

    // Wrap with pairing score badge if needed
    const wrappedContent =
      showPairingScore && pairingScore > 0 ? (
        <div className="relative">
          {content}
          <div
            className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg
          ${
            pairingScore >= 3
              ? "bg-emerald-500 text-white"
              : pairingScore >= 2
                ? "bg-amber-500 text-white"
                : "bg-gray-500 text-white"
          }`}
            title={`配对分: ${pairingScore}`}
          >
            {pairingScore}
          </div>
        </div>
      ) : (
        content
      );

    if (isDraggable) {
      return <DraggableWaitingItem item={item}>{wrappedContent}</DraggableWaitingItem>;
    }
    return wrappedContent;
  };

  return (
    <div
      className={`p-4 rounded-lg border ${
        isCurrentPlayer ? "bg-gray-800 border-emerald-500" : "bg-gray-800/50 border-gray-700"
      }`}
    >
      {!playerState ? (
        <div className="text-gray-500 text-sm">Loading player {playerId}...</div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-2">
            <h3 className={`font-bold ${isCurrentPlayer ? "text-emerald-400" : "text-gray-400"}`}>
              {isCurrentPlayer ? "My Area" : `Player ${playerId}`}
              {playerState.hasJadeChalice && (
                <span
                  className="ml-2 px-2 py-0.5 bg-amber-600/30 border border-amber-500 rounded-full text-amber-400 text-xs animate-pulse"
                  title="玉盏持有者 - 可弹回赠尝"
                >
                  🏆 玉盏
                </span>
              )}
            </h3>
            <div className="text-xs text-gray-500">
              <span className="mr-2">AP: {playerState.actionPoints}</span>
              <span
                title={`个人区: ${scoreData?.sumP_ind || 0}, 奉献: +${scoreData?.c_off || 0}, 惩罚: -${(scoreData?.c_wait || 0) * 2}`}
              >
                Score: {scoreData?.totalScore || 0}
              </span>
            </div>
          </div>

          {/* Areas */}
          <div className="flex gap-4">
            {/* Waiting Area */}
            {isCurrentPlayer && !giftingSnack ? (
              <DroppableWaitingArea isCurrentPlayer={isCurrentPlayer} adjustModeActive={adjustModeActive}>
                {playerState.waitingArea.length === 0 && (
                  <span className="text-gray-600 text-xs p-2">Drag cards here</span>
                )}
                {playerState.waitingArea.map((item: WaitingItem) => (
                  <DroppableSlot key={item.id} slot={item} isCurrentPlayer={isCurrentPlayer}>
                    {adjustModeActive 
                      ? renderAdjustModeItem(item)
                      : renderWaitingItem(item, true, true)
                    }
                  </DroppableSlot>
                ))}
              </DroppableWaitingArea>
            ) : (
              <div className={`flex-1 min-h-[120px] bg-gray-900/50 rounded p-2 border border-dashed transition-all ${
                giftingSnack ? "border-purple-400 bg-purple-900/10" : "border-gray-700"
              }`}>
                <div className="text-xs text-gray-500 mb-1">
                  Waiting Area (Max 5)
                  {giftingSnack && <span className="text-purple-400 ml-2">← 点击空盘子接收赠尝</span>}
                </div>
                <div className="flex flex-wrap">
                  {playerState.waitingArea.map((item: WaitingItem) => {
                    // 检查是否是可接收赠尝的目标（有盘子但没点心）
                    const isGiftableTarget = giftingSnack && item.tableware && !item.snack;
                    // 计算预估配对分
                    let estimatedScore = 0;
                    if (isGiftableTarget && giftingSnack) {
                      estimatedScore = calculateSinglePairingScore(item.tableware!, giftingSnack.snack);
                    }
                    const isValidTarget = isGiftableTarget && estimatedScore >= 1;
                    
                    return (
                      <div 
                        key={item.id} 
                        className={`relative ${isGiftableTarget ? "cursor-pointer" : ""}`}
                        onClick={() => {
                          if (isValidTarget && onGiftTarget) {
                            onGiftTarget(playerId, item.id);
                          }
                        }}
                      >
                        {renderWaitingItem(item, false, true)}
                        {/* 赠尝目标指示 */}
                        {isGiftableTarget && (
                          <div className={`absolute inset-0 rounded-lg border-2 transition-all ${
                            isValidTarget 
                              ? "border-purple-400 bg-purple-500/20 hover:bg-purple-500/40" 
                              : "border-red-400 bg-red-500/20"
                          }`}>
                            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold px-2 py-1 rounded ${
                              isValidTarget ? "bg-purple-600 text-white" : "bg-red-600 text-white"
                            }`}>
                              {isValidTarget ? `+${estimatedScore}分` : "不匹配"}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Personal Area - Taste */}
            {isCurrentPlayer ? (
              <DroppablePersonalArea isCurrentPlayer={isCurrentPlayer}>
                <div className="flex flex-wrap">
                  {playerState.personalArea.map((item: WaitingItem, index: number) => (
                    <div
                      key={item.id}
                      className="transition-transform hover:z-10 hover:scale-105"
                      style={{
                        marginLeft:
                          index > 0 && playerState.personalArea.length > 3 ? "-2rem" : "0",
                        zIndex: index,
                      }}
                    >
                      {renderWaitingItem(item, false, true)}
                    </div>
                  ))}
                </div>
              </DroppablePersonalArea>
            ) : (
              <div className="flex-1 min-h-[120px] bg-gray-900/50 rounded p-2 border border-dashed border-gray-700">
                <div className="text-xs text-gray-500 mb-1">Personal Area</div>
                <div className="flex flex-wrap">
                  {playerState.personalArea.map((item: WaitingItem, index: number) => (
                    <div
                      key={item.id}
                      style={{
                        marginLeft:
                          index > 0 && playerState.personalArea.length > 3 ? "-2rem" : "0",
                        zIndex: index,
                      }}
                    >
                      {renderWaitingItem(item, false, true)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offering Area */}
            {isCurrentPlayer ? (
              <DroppableOfferingArea isCurrentPlayer={isCurrentPlayer}>
                <div className="flex flex-wrap">
                  {playerState.offeringArea.map((item: WaitingItem, index: number) => (
                    <div
                      key={item.id}
                      className="transition-transform hover:z-10 hover:scale-105"
                      style={{
                        marginLeft:
                          index > 0 && playerState.offeringArea.length > 3 ? "-2rem" : "0",
                        zIndex: index,
                      }}
                    >
                      {renderWaitingItem(item, false, true)}
                    </div>
                  ))}
                </div>
              </DroppableOfferingArea>
            ) : (
              <div className="flex-1 min-h-[120px] bg-gray-900/50 rounded p-2 border border-dashed border-gray-700">
                <div className="text-xs text-gray-500 mb-1">Offering Area</div>
                <div className="flex flex-wrap">
                  {playerState.offeringArea.map((item: WaitingItem, index: number) => (
                    <div
                      key={item.id}
                      style={{
                        marginLeft:
                          index > 0 && playerState.offeringArea.length > 3 ? "-2rem" : "0",
                        zIndex: index,
                      }}
                    >
                      {renderWaitingItem(item, false, true)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// 调整模式下可拖拽的点心组件 - 完整大小半透明显示
const DraggableSnackInAdjustMode = ({
  slotId,
  snack,
}: {
  slotId: string;
  snack: any;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `snack-adjust-${slotId}`,
    data: { type: "adjustSnack", fromSlotId: slotId, snack },
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 1000,
        cursor: "grabbing",
      }
    : { cursor: "grab" };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes}
      className={`transition-all duration-200 ${isDragging ? "scale-105" : "hover:scale-102"}`}
    >
      {/* 半透明的完整点心卡片，带发光边框 */}
      <div 
        className={`
          relative rounded-lg transition-all
          ${isDragging 
            ? "opacity-100 shadow-2xl shadow-amber-400/60" 
            : "opacity-75 hover:opacity-90 shadow-lg shadow-amber-400/40 animate-glow"
          }
        `}
      >
        <CardView card={snack} />
        {/* 拖拽提示叠加层 */}
        <div className={`absolute inset-0 rounded-lg border-2 pointer-events-none ${
          isDragging ? "border-amber-300" : "border-amber-400/60"
        }`} />
      </div>
    </div>
  );
};

// Define DraggableWaitingItem to handle dragging existing items
const DraggableWaitingItem = ({
  item,
  children,
}: {
  item: WaitingItem;
  children: React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
    data: { type: "waitingItem", item },
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 1000,
        cursor: "grabbing",
      }
    : { cursor: "grab" };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
};

const GrandmotherStatus: React.FC<{
  players: Record<string, any>;
  l2Deck: any[];
  jadeGiven: boolean;
}> = ({
  players,
  l2Deck,
  jadeGiven,
}) => {
  const allPlayers = Object.values(players);
  const totalOfferings = allPlayers.reduce((sum: number, p: any) => sum + p.offeringArea.length, 0);

  // Check L2 plates remaining in l2Deck
  const l2PlatesRemaining = l2Deck.length;
  const allL2Distributed = l2PlatesRemaining === 0;

  // Game end condition check: 仅检查L2盘子是否全部发完
  const endConditionMet = allL2Distributed;

  return (
    <div className="w-64 bg-stone-900 border-r border-stone-800 p-6 flex flex-col gap-6 text-stone-200 shadow-2xl z-20 shrink-0">
      <h2 className="text-2xl font-bold text-amber-500 font-serif border-b border-stone-700 pb-2 flex items-center gap-2">
        <span>老太君</span>
        <span className="text-xs font-sans text-stone-500 font-normal self-end mb-1">Status</span>
      </h2>

      <div className="space-y-3">
        <div className="flex justify-between items-end">
          <span className="text-sm font-semibold text-stone-400">奉献总数</span>
          <span className="text-2xl font-bold text-amber-400 font-serif">{totalOfferings}</span>
        </div>

        {/* Game End Condition */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            游戏结束条件
          </div>
          <div
            className={`flex items-center gap-2 p-2 rounded border ${
              allL2Distributed
                ? "bg-emerald-900/30 border-emerald-700 text-emerald-300"
                : "bg-stone-800 border-stone-700 text-stone-400"
            }`}
          >
            <span className={allL2Distributed ? "text-emerald-400" : "text-stone-600"}>
              {allL2Distributed ? "✓" : "○"}
            </span>
            <span className="text-sm">L2盘子已发完 ({l2PlatesRemaining}剩余)</span>
          </div>
        </div>

        {endConditionMet && (
          <div className="text-xs p-3 rounded border bg-amber-900/30 border-amber-700 text-amber-200 animate-pulse">
            ⚡ 结束条件已满足！当前轮结束后游戏终止。
          </div>
        )}
      </div>

      {/* 玉盏状态 */}
      <JadeChaliceStatus
        players={players}
        jadeGiven={jadeGiven}
      />

      {/* 奉献规则说明 */}
      <div className="bg-stone-800/50 p-4 rounded-lg text-xs leading-relaxed border border-stone-700">
        <div className="font-bold text-stone-300 mb-2 border-b border-stone-700/50 pb-1">
          奉献规则
        </div>
        <div className="text-stone-400/80 space-y-1">
          <div>• 配对分≥2才能奉献</div>
          <div>• L1→L2, L2→L3</div>
          <div>• 奉献L3获得/夺取玉盏</div>
        </div>
      </div>

      {/* Visual Decoration */}
      <div className="mt-auto flex justify-center opacity-10 pointer-events-none select-none">
        <div className="w-32 h-32 rounded-full border-4 border-amber-500 flex items-center justify-center">
          <span className="font-serif text-6xl text-amber-500">寿</span>
        </div>
      </div>
    </div>
  );
};

// --- Overlay Components ---

// 赠尝响应弹窗 - 仅当目标持有玉盏时显示（接受/弹回选择）
const GiftResponseModal: React.FC<{
  pendingGift: PendingGift | null;
  myPlayerId: string;
  onAccept: () => void;
  onDeflect: () => void;
}> = ({ pendingGift, myPlayerId, onAccept, onDeflect }) => {
  if (!pendingGift || pendingGift.deflected) return null;
  if (pendingGift.toPlayerId !== myPlayerId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border-2 border-purple-500 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in duration-300">
        <div className="text-center mb-4">
          <div className="text-purple-400 text-xl mb-2">🎁 收到赠尝</div>
          <div className="text-gray-300">
            玩家 <span className="text-amber-400 font-bold">{pendingGift.fromPlayerId}</span> 想送你一个点心
          </div>
          <div className="text-amber-400 text-sm mt-2 flex items-center justify-center gap-1">
            <span>🏆</span>
            <span>你持有玉盏，可以弹回此赠尝</span>
          </div>
        </div>

        {/* 点心卡片预览 */}
        <div className="flex justify-center my-4">
          <div className="transform scale-110">
            <CardView card={pendingGift.snack} />
          </div>
        </div>

        <div className="text-center mb-4">
          <div className="text-sm text-gray-400">预计配对分</div>
          <div className={`text-2xl font-bold ${
            pendingGift.pairingScore >= 2 ? "text-emerald-400" : "text-amber-400"
          }`}>
            +{pendingGift.pairingScore} 分
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onAccept}
            className="py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all hover:scale-105"
          >
            ✓ 接受
            <div className="text-xs font-normal opacity-80">收下这份心意</div>
          </button>
          <button
            onClick={onDeflect}
            className="py-3 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition-all hover:scale-105"
          >
            🏆 弹回
            <div className="text-xs font-normal opacity-80">使用玉盏弹回，玉盏转移</div>
          </button>
        </div>

        <div className="mt-4 text-center text-xs text-gray-500">
          <div className="text-amber-400 mt-1">弹回后：点心返还给对方，🏆玉盏转移给对方</div>
        </div>
      </div>
    </div>
  );
};

// 被弹回的赠尝处理弹窗 - 发起者选择自己的盘子放置点心（可替换已有点心）
const DeflectedGiftModal: React.FC<{
  pendingGift: PendingGift | null;
  myPlayerId: string;
  myWaitingArea: WaitingItem[];
  onResolve: (targetSlotId: string) => void;
  onDiscard: () => void;
}> = ({ pendingGift, myPlayerId, myWaitingArea, onResolve, onDiscard }) => {
  if (!pendingGift || !pendingGift.deflected) return null;
  if (pendingGift.fromPlayerId !== myPlayerId) return null;

  // 所有有盘子的槽位（不管有没有点心）
  const platesWithTableware = myWaitingArea.filter((s) => s.tableware);
  const hasAnyPlate = platesWithTableware.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border-2 border-amber-500 rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 animate-in zoom-in duration-300">
        <div className="text-center mb-4">
          <div className="text-amber-400 text-xl mb-2">🏆 赠尝被弹回！</div>
          <div className="text-gray-300">
            玩家 <span className="text-amber-400 font-bold">{pendingGift.toPlayerId}</span> 使用玉盏弹回了你的赠尝
          </div>
          <div className="text-amber-300 text-sm mt-2">你获得了🏆玉盏，但必须处理这个点心</div>
        </div>

        {/* 点心卡片预览 */}
        <div className="flex justify-center my-4">
          <div className="transform scale-110">
            <CardView card={pendingGift.snack} />
          </div>
        </div>

        {hasAnyPlate ? (
          <>
            <div className="text-center text-sm text-gray-400 mb-3">
              选择一个盘子放置（已有点心将被弃置）：
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              {platesWithTableware.map((slot) => {
                const newScore = calculateSinglePairingScore(slot.tableware!, pendingGift.snack);
                const hasExistingSnack = !!slot.snack;
                const oldScore = hasExistingSnack ? calculatePairingScore(slot) : 0;
                
                return (
                  <button
                    key={slot.id}
                    onClick={() => onResolve(slot.id)}
                    className={`relative p-1 rounded-lg border-2 transition-all hover:scale-105 ${
                      hasExistingSnack 
                        ? "border-rose-500 hover:border-rose-400" 
                        : "border-gray-600 hover:border-amber-400"
                    }`}
                  >
                    {/* 显示盘子和已有点心 */}
                    {hasExistingSnack ? (
                      <CardView card={slot.tableware!} overlayCard={slot.snack} />
                    ) : (
                      <CardView card={slot.tableware!} />
                    )}
                    
                    {/* 新配对分 */}
                    <div className={`absolute -top-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-lg ${
                      newScore >= 2 ? "bg-emerald-500 text-white" : newScore >= 1 ? "bg-amber-500 text-white" : "bg-gray-500 text-white"
                    }`}>
                      {newScore}
                    </div>
                    
                    {/* 弃置提示 */}
                    {hasExistingSnack && (
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] bg-rose-600 text-white rounded whitespace-nowrap">
                        弃置 {oldScore}分
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="text-rose-400 mb-3 p-3 bg-rose-900/30 rounded-lg border border-rose-600">
              <div className="text-lg mb-1">⚠️ 等待区没有任何盘子</div>
              <div className="text-sm">点心将背面朝上放入个人区，记 <span className="font-bold text-rose-300">-3 分</span></div>
            </div>
            <button
              onClick={onDiscard}
              className="py-3 px-6 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all hover:scale-105"
            >
              确认接受惩罚 (-3分)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const GameNotification: React.FC<{ notification: any }> = ({ notification }) => {
  if (!notification) return null;

  // Auto-hide logic could be improved with local state, but for now we show the latest global event
  // We only care about 'offering' type for now as per requirements
  if (notification.type !== "offering") return null;

  const { message, details } = notification;
  const isSuccess = details?.success;

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-none">
      <div
        className={`
                flex flex-col items-center gap-2 px-6 py-4 rounded-xl shadow-2xl border-2 backdrop-blur-md
                ${
                  isSuccess
                    ? "bg-amber-900/90 border-amber-500 text-amber-100"
                    : "bg-gray-900/90 border-gray-600 text-gray-200"
                }
            `}
      >
        <div className="font-bold text-lg text-center font-serif whitespace-pre-wrap">
          {message}
        </div>

        {details && details.dice && (
          <div className="grid grid-cols-4 gap-3 text-xs mt-2 w-full pt-2 border-t border-white/10">
            <div className="flex flex-col items-center">
              <span className="opacity-50">骰子</span>
              <span className="font-bold text-lg">{details.baseRoll}</span>
              <span className="text-[9px] opacity-70">
                ({details.dice[0]} + {details.dice[1]})
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="opacity-50">修正</span>
              <span className="font-bold text-lg text-amber-300">+{details.modifier}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="opacity-50">总计</span>
              <span
                className={`font-bold text-lg ${isSuccess ? "text-emerald-400" : "text-rose-400"}`}
              >
                {details.modifiedRoll}
              </span>
              <span className="text-[9px] opacity-70">≥12?</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="opacity-50">结果</span>
              <span className="font-bold">{isSuccess ? "成功!" : "失败"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 玉盏状态组件 - 显示玉盏流动规则和当前持有者
const JadeChaliceStatus: React.FC<{
  players: Record<string, any>;
  jadeGiven: boolean;
}> = ({ players, jadeGiven }) => {
  // 查找玉盏持有者
  const jadeHolderId = jadeGiven
    ? Object.keys(players).find((pid) => players[pid].hasJadeChalice)
    : null;

  return (
    <div className="bg-gradient-to-r from-amber-900/30 to-stone-800/50 border border-amber-700/50 rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-amber-400 font-bold font-serif text-lg">流动的玉盏</div>
        <span className="text-2xl">🏆</span>
      </div>

      {jadeGiven && jadeHolderId ? (
        <div className="space-y-2">
          <div className="text-center bg-amber-900/50 rounded-lg p-3 border border-amber-600">
            <div className="text-amber-300 text-sm mb-1">当前持有者</div>
            <div className="text-amber-400 font-bold text-xl">玩家 {jadeHolderId}</div>
          </div>
          <div className="text-xs text-stone-400 space-y-1">
            <div>• 可弹回他人的赠尝</div>
            <div>• 弹回后玉盏转移给对方</div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-center text-stone-400 text-sm py-2">
            玉盏尚未归属
          </div>
          <div className="text-xs text-amber-400/80 bg-stone-800/50 p-2 rounded border border-stone-700">
            💡 奉献L3食器即可获得玉盏！
          </div>
        </div>
      )}

      <div className="mt-3 text-[10px] text-stone-500 border-t border-stone-700/50 pt-2">
        奉献L3食器可获取/夺取玉盏
      </div>
    </div>
  );
};

// --- 游戏规则弹窗组件 ---
const GameRulesModal: React.FC<{ show: boolean; onClose: () => void }> = ({ show, onClose }) => {
  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-stone-900 border-2 border-amber-600 rounded-xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="bg-amber-800 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">📜 玉盏春夜宴 - 游戏规则</h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-2xl font-bold transition-colors"
          >
            ×
          </button>
        </div>
        
        {/* 规则内容 - 可滚动区域 */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-60px)] text-stone-200 space-y-6">
          {/* 故事背景 */}
          <section>
            <h3 className="text-lg font-bold text-amber-400 mb-2 border-b border-amber-600/30 pb-1">🏮 故事背景</h3>
            <p className="text-sm text-stone-300 italic">
              每年暖春时节夜里，顾府后院总会点灯开宴，顾府的女子们莺莺燕燕一起聊天、唱歌、品尝点心。
              席间，顾府老夫人会将自己的玉盏给参加宴席的一个晚辈，表达她的喜爱之情。
            </p>
          </section>

          {/* 游戏目标 */}
          <section>
            <h3 className="text-lg font-bold text-amber-400 mb-2 border-b border-amber-600/30 pb-1">🎯 游戏目标</h3>
            <p className="text-sm">
              通过配对<strong>食器</strong>与<strong>点心</strong>获取<strong>配对分</strong>，最终得分最高者获胜。
            </p>
            <div className="mt-2 text-sm bg-stone-800 p-3 rounded">
              <strong>配对分规则：</strong>食器上的每个"圈"若被点心的"点"填满，即产生 <span className="text-emerald-400 font-bold">1点</span> 配对分。
              <br/>食器分为 L1/L2/L3 三个等级，等级越高圈越多，配对分上限越高。
            </div>
          </section>

          {/* 区域说明 */}
          <section>
            <h3 className="text-lg font-bold text-amber-400 mb-2 border-b border-amber-600/30 pb-1">📍 区域说明</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-stone-800 p-3 rounded">
                <strong className="text-rose-400">公共区</strong>：可取用的点心和食器牌堆
              </div>
              <div className="bg-stone-800 p-3 rounded">
                <strong className="text-amber-400">等待区</strong>：暂存区，上限5格
              </div>
              <div className="bg-stone-800 p-3 rounded">
                <strong className="text-emerald-400">个人区</strong>：品鉴完成的点心，计入配对分
              </div>
              <div className="bg-stone-800 p-3 rounded">
                <strong className="text-purple-400">奉献区</strong>：献给老太君的点心
              </div>
            </div>
          </section>

          {/* 行动点 */}
          <section>
            <h3 className="text-lg font-bold text-amber-400 mb-2 border-b border-amber-600/30 pb-1">⚡ 行动点 (AP)</h3>
            <p className="text-sm mb-2">每回合获得 <span className="text-emerald-400 font-bold">3点 AP</span>。</p>
          </section>

          {/* 可执行动作 */}
          <section>
            <h3 className="text-lg font-bold text-amber-400 mb-2 border-b border-amber-600/30 pb-1">🎮 可执行动作</h3>
            <div className="space-y-3 text-sm">
              <div className="bg-stone-800 p-3 rounded">
                <strong className="text-cyan-400">A. 拿取 (1 AP)</strong>
                <p className="text-stone-400 mt-1">从公共区拿取食器/点心放入等待区，或将点心放到等待区的空盘子上。</p>
              </div>
              <div className="bg-stone-800 p-3 rounded">
                <strong className="text-emerald-400">B. 品鉴 (1 AP)</strong>
                <p className="text-stone-400 mt-1">将等待区的"食器+点心"移入个人区，配对分计入最终得分。每回合限1次。</p>
              </div>
              <div className="bg-stone-800 p-3 rounded">
                <strong className="text-purple-400">C. 奉献 (1 AP)</strong>
                <p className="text-stone-400 mt-1">
                  将配对分≥2的组合献给老太君，获得更高级食器。
                  <br/>奉献L3食器：获得/夺取【玉盏】！
                </p>
              </div>
              <div className="bg-stone-800 p-3 rounded">
                <strong className="text-amber-400">D. 调整模式 (1 AP)</strong>
                <p className="text-stone-400 mt-1">进入调整模式后可自由移动等待区的点心，每回合限1次。</p>
              </div>
              <div className="bg-stone-800 p-3 rounded">
                <strong className="text-rose-400">E. 赠尝 (1 AP)</strong>
                <p className="text-stone-400 mt-1">
                  将公共区点心放到任意玩家（包括自己）的空盘上（配对分≥1）。不可拒绝，直接放置。
                  <br/>若目标持有【玉盏】，可弹回赠尝：点心返还给你，<span className="text-amber-300 font-bold">🏆玉盏转移给你</span>。
                </p>
              </div>
            </div>
          </section>

          {/* 玉盏 */}
          <section>
            <h3 className="text-lg font-bold text-amber-400 mb-2 border-b border-amber-600/30 pb-1">🏆 流动的玉盏</h3>
            <div className="text-sm bg-amber-900/30 border border-amber-600/50 p-3 rounded">
              <p><strong>获取：</strong>奉献L3食器时获得玉盏（可从他人手中夺取）</p>
              <p className="mt-2"><strong>玉盏能力 - 弹回赠尝：</strong></p>
              <ul className="list-disc list-inside text-stone-300 ml-2">
                <li>当他人对你赠尝时，可选择弹回</li>
                <li>弹回后：点心返还给对方，对方必须放在自己的盘中</li>
                <li>🏆玉盏转移给对方</li>
              </ul>
            </div>
          </section>

          {/* 游戏结束 */}
          <section>
            <h3 className="text-lg font-bold text-amber-400 mb-2 border-b border-amber-600/30 pb-1">🏁 游戏结束与计分</h3>
            <div className="text-sm">
              <p className="mb-2"><strong>结束条件：</strong>所有 L2 食器分发完毕后的下一轮结束</p>
              <div className="bg-stone-800 p-3 rounded mt-2">
                <strong>最终得分 = </strong>
                <span className="text-emerald-400">个人区配对分</span> + 
                <span className="text-purple-400"> 奉献区得分(L1=1,L2=2,L3=3)</span> - 
                <span className="text-rose-400"> 等待区滞留×2</span>
              </div>
              <p className="mt-2 text-stone-400">平局时：奉献数多者胜 → 个人区盘数少者胜</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const GameOverScreen: React.FC<{ gameover: any; players: any }> = ({ gameover, players }) => {
  if (!gameover) return null;

  const { winnerId, scores } = gameover;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-700">
      <div className="bg-stone-900 border-4 border-amber-600 rounded-2xl p-8 max-w-2xl w-full shadow-[0_0_50px_rgba(217,119,6,0.5)]">
        <div className="text-center mb-8">
          <div className="text-amber-500 text-sm font-bold uppercase tracking-[0.3em] mb-2">
            Game Over
          </div>
          <h1 className="text-5xl font-serif text-white mb-2">
            {winnerId ? `Player ${winnerId} Wins!` : "Game Over"}
          </h1>
          <div className="text-stone-400 italic">The feast has concluded.</div>
        </div>

        <div className="space-y-4">
          {Object.keys(players).map((pid) => {
            const scoreData = scores[pid];
            const isWinner = pid === winnerId;
            const hasJadeChalice = players[pid].hasJadeChalice;

            return (
              <div
                key={pid}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  isWinner ? "bg-amber-900/30 border-amber-500/50" : "bg-stone-800 border-stone-700"
                }`}
              >
                <div className="flex items-center gap-4">
                  {isWinner && <span className="text-2xl">👑</span>}
                  <div>
                    <div
                      className={`font-bold flex items-center gap-2 ${
                        isWinner ? "text-amber-400" : "text-stone-300"
                      }`}
                    >
                      Player {pid}
                      {hasJadeChalice && (
                        <span className="text-amber-400 text-sm" title="玉盏持有者">
                          🏆
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-stone-500">
                      Items: {players[pid].personalArea.length} Personal /{" "}
                      {players[pid].offeringArea.length} Offered
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-3xl font-bold font-serif">{scoreData.totalScore}</div>
                  <div className="text-[10px] text-stone-500 flex gap-2 justify-end flex-wrap">
                    <span>个人: {scoreData.sumP_ind}</span>
                    <span>
                      奉献: +{scoreData.c_off}
                    </span>
                    <span>惩罚: -{scoreData.c_wait * 2}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center space-y-3">
          <p className="text-stone-400 text-sm">游戏结束，可以查看各区域卡牌进行复盘</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-8 rounded-full transition-all hover:scale-105 shadow-lg"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
};

export const Board: React.FC = () => {
  const { gameState, sendMove, playerId, isConnected, roomId, isHost, connectedPlayerCount } =
    useP2P();

  if (!isConnected || !gameState) {
    return <div className="text-white p-10">Connecting to game state...</div>;
  }

  const { G, ctx } = gameState;
  const myPlayerId = playerId || "0";
  const isGameStarted = G.isGameStarted;
  const isMyTurn = ctx.currentPlayer === myPlayerId;
  const myAP = G.players[myPlayerId]?.actionPoints || 0;
  const adjustModeActive = G.players[myPlayerId]?.adjustModeActive || false;
  const adjustModeUsedThisTurn = G.players[myPlayerId]?.adjustModeUsedThisTurn || false;

  // 赠尝模式状态：选中的公共区点心
  const [giftingSnack, setGiftingSnack] = useState<{ snackId: string; snack: CardType } | null>(null);
  
  // 规则弹窗显示状态
  const [showRules, setShowRules] = useState(false);

  // Start Game Handler
  const handleStartGame = () => {
    sendMove("startGame", connectedPlayerCount); // Pass connected count
  };

  // 激活调整模式 Handler
  const handleActivateAdjustMode = () => {
    sendMove("activateAdjustMode");
  };

  // 关闭调整模式 Handler
  const handleDeactivateAdjustMode = () => {
    sendMove("deactivateAdjustMode");
  };

  // 赠尝 Handler：选择点心
  const handleSelectGiftSnack = (snackId: string, snack: CardType) => {
    if (adjustModeActive) return;
    setGiftingSnack({ snackId, snack });
  };

  // 赠尝 Handler：取消选择
  const handleCancelGifting = () => {
    setGiftingSnack(null);
  };

  // 赠尝 Handler：确认赠送到目标
  const handleConfirmGift = (targetPlayerId: string, targetSlotId: string) => {
    if (!giftingSnack) return;
    sendMove("giftSnack", { 
      snackId: giftingSnack.snackId, 
      targetPlayerId, 
      targetSlotId 
    });
    setGiftingSnack(null);
  };

  // 赠尝响应 Handler：接受（玉盏持有者选择接受）
  const handleAcceptGift = () => {
    sendMove("acceptGift");
  };

  // 赠尝响应 Handler：弹回（玉盏持有者选择弹回）
  const handleDeflectGift = () => {
    sendMove("deflectGift");
  };

  // 被弹回的赠尝 Handler：发起者放置到自己的盘中
  const handleResolveDeflectedGift = (targetSlotId: string) => {
    sendMove("resolveDeflectedGift", { targetSlotId });
  };

  // 被弹回的赠尝 Handler：发起者无空盘，弃置
  const handleDiscardDeflectedGift = () => {
    sendMove("discardDeflectedGift");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !isMyTurn) return;

    const draggedId = active.id as string;
    const dragType = active.data.current?.type; // 'card' or 'waitingItem'

    // Case 1: Dragging Snack from Public Area (Take Snack - must place on plate)
    if (!dragType || dragType === "card") {
      // Snacks must be placed on an existing plate slot
      if (over.data.current?.type === "slot") {
        sendMove("takeSnack", { snackId: draggedId, targetSlotId: over.id });
      }
      // Cannot place snack in waiting area without target slot
      return;
    }

    // Case 2: Dragging Item from Waiting Area (Taste, Offer, or adjust snack)
    if (dragType === "waitingItem") {
      const item = active.data.current?.item;
      if (!item) return;

      // 调整模式下不允许品鉴和奉献
      if (adjustModeActive) return;

      if (over.id === "personal-area") {
        sendMove("taste", { slotId: item.id });
      } else if (over.id === "offering-area") {
        sendMove("offer", { slotId: item.id });
      } else if (over.data.current?.type === "slot") {
        // 调整点心位置（需要调整模式）
        const toSlotId = over.id as string;
        if (item.snack && toSlotId !== item.id) {
          sendMove("adjustSnack", { fromSlotId: item.id, toSlotId: toSlotId });
        }
      }
      return;
    }

    // Case 3: Dragging snack in adjust mode
    if (dragType === "adjustSnack") {
      const fromSlotId = active.data.current?.fromSlotId;
      if (!fromSlotId) return;

      if (over.data.current?.type === "slot") {
        const toSlotId = over.id as string;
        if (toSlotId !== fromSlotId) {
          sendMove("adjustSnack", { fromSlotId, toSlotId });
        }
      }
      return;
    }
  };

  const renderPublicSlot = (slot: PublicSlot) => {
    // Public slots now only contain snacks (文档规定：公共区5个槽位只有点心)
    if (slot.snack) {
      const isSelectedForGifting = giftingSnack?.snackId === slot.snack.id;
      return (
        <div
          key={slot.id}
          className={`relative w-28 h-40 flex items-center justify-center bg-gray-800/50 rounded border transition-all ${
            isSelectedForGifting 
              ? "border-purple-400 bg-purple-900/30 ring-2 ring-purple-400" 
              : "border-gray-700"
          }`}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            {isMyTurn && myAP > 0 && !adjustModeActive ? (
              <DraggableCard card={slot.snack} />
            ) : (
              <CardView card={slot.snack} />
            )}
          </div>
          {/* 赠尝按钮 */}
          {isMyTurn && myAP > 0 && !adjustModeActive && !giftingSnack && slot.snack && (
            <button
              onClick={() => handleSelectGiftSnack(slot.snack!.id, slot.snack!)}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] bg-purple-600 hover:bg-purple-500 text-white rounded shadow-lg z-10 transition-all hover:scale-105"
              title="选择此点心赠送给对手"
            >
              赠尝
            </button>
          )}
          {/* 选中状态指示 */}
          {isSelectedForGifting && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] bg-purple-500 text-white rounded shadow-lg z-10 animate-pulse">
              已选中
            </div>
          )}
        </div>
      );
    } else {
      // Empty slot
      return (
        <div
          key={slot.id}
          className="w-28 h-40 bg-gray-800/20 rounded border border-gray-700 flex items-center justify-center"
        >
          <span className="text-xs text-gray-600">空</span>
        </div>
      );
    }
  };

  // Handler for drawing a plate from the deck
  const handleDrawPlate = () => {
    sendMove("takeTableware");
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col min-h-screen bg-gray-900 text-white overflow-hidden">
        {/* Overlays */}
        <GameNotification notification={G.notification} />
        <GameOverScreen gameover={ctx.gameover} players={G.players} />
        <GiftResponseModal 
          pendingGift={G.pendingGift} 
          myPlayerId={myPlayerId}
          onAccept={handleAcceptGift}
          onDeflect={handleDeflectGift}
        />
        <DeflectedGiftModal
          pendingGift={G.pendingGift}
          myPlayerId={myPlayerId}
          myWaitingArea={G.players[myPlayerId]?.waitingArea || []}
          onResolve={handleResolveDeflectedGift}
          onDiscard={handleDiscardDeflectedGift}
        />

        {/* Header Info */}
        <div className="bg-gray-800 p-2 flex justify-between items-center shadow-md z-30 relative shrink-0">
          <div className="text-xs text-gray-400">
            <span className="mr-4">Room: {roomId}</span>
            <span className="mr-4">Role: {isHost ? "Host" : "Guest"}</span>
            <span>Player ID: {myPlayerId}</span>
          </div>
          <div className="font-bold text-emerald-400">玉盏春夜宴</div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowRules(!showRules)}
              className="px-3 py-1 text-xs bg-amber-700 hover:bg-amber-600 text-white rounded transition-all"
            >
              📜 游戏规则
            </button>
            <span className="text-xs text-gray-400">Turn: Player {ctx.currentPlayer}</span>
          </div>
        </div>
        
        {/* 游戏规则弹窗 */}
        <GameRulesModal show={showRules} onClose={() => setShowRules(false)} />

        {/* Content Wrapper */}
        <div className="flex-grow flex overflow-hidden">
          {/* Sidebar: Grandmother Status */}
          {isGameStarted && (
            <GrandmotherStatus
              players={G.players}
              l2Deck={G.l2Deck}
              jadeGiven={G.jadeGiven}
            />
          )}

          {/* Main Game Area */}
          <div className="flex-grow flex flex-col p-4 gap-4 overflow-y-auto">
            {/* Top: Opponents */}
            <div className="flex gap-2 overflow-x-auto pb-2 shrink-0">
              {Object.keys(G.players).map((pid) => {
                if (pid === myPlayerId) return null;
                return (
                  <div key={pid} className="min-w-[300px]">
                    <PlayerArea
                      playerId={pid}
                      playerState={G.players[pid]}
                      isCurrentPlayer={false}
                      giftingSnack={giftingSnack}
                      onGiftTarget={handleConfirmGift}
                    />
                  </div>
                );
              })}
            </div>

            {/* Middle: Public Area & Controls */}
            <div
              className={`flex-grow flex flex-col items-center justify-center min-h-[200px] bg-gray-800/30 rounded-xl border border-gray-700 p-4 relative transition-all duration-300 ${
                !isMyTurn ? "opacity-60 grayscale-[0.3]" : ""
              }`}
            >
              {/* AP Indicator & End Turn Button */}
              {isGameStarted && isMyTurn && (
                <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-20">
                  <div className="bg-gray-900/90 p-3 rounded-lg border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse">
                    <div className="text-[10px] text-emerald-300 uppercase tracking-wider font-bold">
                      Action Points
                    </div>
                    <div className="text-4xl font-black text-emerald-400 text-center leading-none mt-1">
                      {myAP}
                    </div>
                  </div>
                  <button
                    onClick={() => sendMove("endTurn")}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold py-2 px-4 rounded-lg shadow-lg transition"
                  >
                    End Turn
                  </button>
                </div>
              )}

              {!isGameStarted ? (
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-emerald-200 mb-4">Waiting to Start</h2>
                  {isHost ? (
                    <button
                      onClick={handleStartGame}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:scale-105"
                    >
                      Start Game
                    </button>
                  ) : (
                    <p className="text-gray-400 animate-pulse">
                      Waiting for host to start the game...
                    </p>
                  )}
                  <div className="mt-4 text-sm text-gray-500">
                    Players connected: {connectedPlayerCount}
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  <div className="text-center text-gray-400 text-sm mb-2">
                    公共区 (5个点心槽位 + 盘子抽取)
                  </div>
                  
                  {/* 赠尝模式提示栏 */}
                  {giftingSnack && (
                    <div className="flex items-center justify-center gap-4 mb-4 p-3 bg-purple-900/40 border border-purple-500 rounded-lg">
                      <span className="text-purple-300 text-sm animate-pulse">🎁</span>
                      <span className="text-purple-200">
                        赠尝模式：已选择「{giftingSnack.snack.name}」，请点击任意玩家的空盘子
                      </span>
                      <button
                        onClick={handleCancelGifting}
                        className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded transition-all"
                      >
                        取消
                      </button>
                      <span className="text-xs text-purple-400">
                        消耗 1 AP 放置点心（可放自己或对手的盘中）
                      </span>
                    </div>
                  )}
                  
                  <div className="flex flex-col items-center gap-4">
                    {/* 5个点心槽位 */}
                    <div className="flex gap-2 justify-center flex-wrap">
                      {G.publicArea.map((slot: PublicSlot) => renderPublicSlot(slot))}
                    </div>
                    {/* 盘子抽取区 */}
                    <div className="flex items-center gap-4 bg-stone-800/50 p-4 rounded-lg border border-stone-700">
                      <div className="text-sm text-stone-400">
                        <div className="font-bold mb-1">盘子抽取区</div>
                        <div className="text-xs">
                          L1剩余: {G.tablewareDeck?.length || 0} | L2剩余:{" "}
                          {G.l2Deck?.length || 0} | L3剩余: {G.l3Deck?.length || 0}
                        </div>
                      </div>
                      <button
                        onClick={handleDrawPlate}
                        disabled={
                          !isMyTurn || myAP <= 0 || G.players[myPlayerId]?.waitingArea?.length >= 5
                        }
                        className={`py-2 px-6 rounded-lg font-bold transition-all ${
                          isMyTurn && myAP > 0 && G.players[myPlayerId]?.waitingArea?.length < 5
                            ? "bg-stone-600 hover:bg-stone-500 text-white hover:scale-105"
                            : "bg-stone-700 text-stone-500 cursor-not-allowed"
                        }`}
                      >
                        抽取盘子 (1 AP)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom: My Area */}
            <div
              className={`mt-auto transition-all duration-300 ${
                !isMyTurn ? "opacity-60 grayscale-[0.3] pointer-events-none" : ""
              }`}
            >
              {/* 调整模式按钮栏 - 放在底部固定位置 */}
              {isMyTurn && (
                <div className="mb-2 flex items-center gap-2 bg-gray-900/80 px-3 py-2 rounded-lg backdrop-blur-sm">
                  {adjustModeActive ? (
                    <>
                      <button
                        onClick={handleDeactivateAdjustMode}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all hover:scale-105 shadow-lg"
                      >
                        ✓ 完成调整
                      </button>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-600/30 border border-amber-500 rounded-lg text-amber-300 text-sm">
                        <span className="animate-pulse">●</span>
                        <span>调整模式进行中</span>
                      </div>
                      <span className="text-xs text-amber-400 ml-auto">
                        ⚠️ 完成调整后才能进行其他操作
                      </span>
                    </>
                  ) : adjustModeUsedThisTurn ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-400 text-sm">
                      <span>✓</span>
                      <span>本回合已使用过调整模式</span>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={handleActivateAdjustMode}
                        disabled={myAP <= 0}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          myAP > 0
                            ? "bg-amber-600 hover:bg-amber-500 text-white hover:scale-105"
                            : "bg-gray-700 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        启用调整模式 (1 AP)
                      </button>
                      <span className="text-xs text-gray-500">
                        激活后可移动等待区点心位置，每回合限一次
                      </span>
                    </>
                  )}
                </div>
              )}
              <PlayerArea
                playerId={myPlayerId}
                playerState={G.players[myPlayerId]}
                isCurrentPlayer={true}
                adjustModeActive={adjustModeActive}
                giftingSnack={giftingSnack}
                onGiftTarget={handleConfirmGift}
              />
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
};
