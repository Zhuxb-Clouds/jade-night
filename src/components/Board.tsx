import React from "react";
import { useP2P } from "../network/P2PContext";
import {
  Card as CardType,
  WaitingItem,
  PublicSlot,
  calculatePairingScore,
  calculateFinalScore,
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
}: {
  children: React.ReactNode;
  isCurrentPlayer: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: "waiting-area",
    data: { type: "area" },
    disabled: !isCurrentPlayer,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-[120px] bg-gray-900/50 rounded p-2 border border-dashed transition-colors ${
        isOver ? "border-emerald-400 bg-emerald-900/20" : "border-gray-700"
      }`}
    >
      <div className="text-xs text-gray-500 mb-1">Waiting Area (Max 5)</div>
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
}> = ({ playerId, playerState, isCurrentPlayer }) => {
  // Calculate real-time score
  const scoreData = playerState ? calculateFinalScore(playerState) : null;

  // Render a waiting item with optional pairing score badge
  const renderWaitingItem = (
    item: WaitingItem,
    isDraggable: boolean = false,
    showPairingScore: boolean = false,
  ) => {
    const pairingScore = showPairingScore ? calculatePairingScore(item) : 0;

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
                  title="玉盏持有者 - 奉献分×2"
                >
                  🏆 玉盏
                </span>
              )}
            </h3>
            <div className="text-xs text-gray-500">
              <span className="mr-2">AP: {playerState.actionPoints}</span>
              <span className="mr-2">🍵 {playerState.teaTokens || 0}</span>
              <span
                title={`个人区: ${scoreData?.sumP_ind || 0}, 奉献: +${scoreData?.c_off || 0}${
                  playerState.hasJadeChalice ? "(×2)" : ""
                }, 茶券: +${scoreData?.teaTokens || 0}, 惩罚: -${(scoreData?.c_wait || 0) * 2}`}
              >
                Score: {scoreData?.totalScore || 0}
              </span>
            </div>
          </div>

          {/* Areas */}
          <div className="flex gap-4">
            {/* Waiting Area */}
            {isCurrentPlayer ? (
              <DroppableWaitingArea isCurrentPlayer={isCurrentPlayer}>
                {playerState.waitingArea.length === 0 && (
                  <span className="text-gray-600 text-xs p-2">Drag cards here</span>
                )}
                {playerState.waitingArea.map((item: WaitingItem) => (
                  <DroppableSlot key={item.id} slot={item} isCurrentPlayer={isCurrentPlayer}>
                    {renderWaitingItem(item, true, true)}{" "}
                    {/* Enable dragging and show pairing score */}
                  </DroppableSlot>
                ))}
              </DroppableWaitingArea>
            ) : (
              <div className="flex-1 min-h-[120px] bg-gray-900/50 rounded p-2 border border-dashed border-gray-700">
                <div className="text-xs text-gray-500 mb-1">Waiting Area (Max 5)</div>
                <div className="flex flex-wrap">
                  {playerState.waitingArea.map((item: WaitingItem) => (
                    <div key={item.id}>{renderWaitingItem(item, false, true)}</div>
                  ))}
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
  rewardDeck: any[];
  jadeGiven: boolean;
  myOfferingCount: number;
  myTeaTokens: number;
  isMyTurn: boolean;
  myAP: number;
  onServeTea: () => void;
}> = ({
  players,
  rewardDeck,
  jadeGiven,
  myOfferingCount,
  myTeaTokens,
  isMyTurn,
  myAP,
  onServeTea,
}) => {
  const allPlayers = Object.values(players);
  const totalOfferings = allPlayers.reduce((sum: number, p: any) => sum + p.offeringArea.length, 0);

  // Check L2 plates remaining in reward deck
  const l2PlatesRemaining = rewardDeck.filter((c: any) => c.level === 2).length;
  const allL2Distributed = l2PlatesRemaining === 0;

  // Game end condition check: 仅检查L2盘子是否全部发完
  const endConditionMet = allL2Distributed;

  // 敬茶条件检查: 需要茶券 >= (9 - 奉献数)，且需要3AP
  const baseCost = 9;
  const actualCost = Math.max(0, baseCost - myOfferingCount);
  const canServeTea = !jadeGiven && myTeaTokens >= actualCost && isMyTurn && myAP >= 3;

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

      {/* 敬茶按钮 */}
      <ServeTeaButton
        canServeTea={canServeTea}
        myOfferingCount={myOfferingCount}
        myTeaTokens={myTeaTokens}
        jadeGiven={jadeGiven}
        isMyTurn={isMyTurn}
        onServeTea={onServeTea}
        players={players}
      />

      {/* 奉献规则说明 */}
      <div className="bg-stone-800/50 p-4 rounded-lg text-xs leading-relaxed border border-stone-700">
        <div className="font-bold text-stone-300 mb-2 border-b border-stone-700/50 pb-1">
          奉献规则
        </div>
        <div className="text-stone-400/80 space-y-1">
          <div>• 配对分≥2才能奉献</div>
          <div>• 配对分≥3额外获得1茶券</div>
          <div>• L1→L2, L2→L3, L3→2茶券</div>
          <div>• 玉盏持有者奉献分×2</div>
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

// 敬茶按钮组件 - 替代原来的L3选择弹窗
const ServeTeaButton: React.FC<{
  canServeTea: boolean;
  myOfferingCount: number;
  myTeaTokens: number;
  jadeGiven: boolean;
  isMyTurn: boolean;
  onServeTea: () => void;
  players: Record<string, any>;
}> = ({ canServeTea, myOfferingCount, myTeaTokens, jadeGiven, isMyTurn, onServeTea, players }) => {
  // 计算实际需要的茶券数量：基础9个，每1个奉献减少1个
  const baseCost = 9;
  const actualCost = Math.max(0, baseCost - myOfferingCount);
  const meetsTeaReq = myTeaTokens >= actualCost;

  // 查找玉盏持有者
  const jadeHolderId = jadeGiven
    ? Object.keys(players).find((pid) => players[pid].hasJadeChalice)
    : null;

  // 玉盏已发放，显示持有者信息
  if (jadeGiven) {
    return (
      <div className="bg-gradient-to-r from-amber-900/50 to-stone-800/50 border border-amber-600 rounded-lg p-4 mt-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-3xl">🏆</span>
          <div className="text-amber-400 font-bold font-serif text-lg">玉盏已归属</div>
        </div>
        <div className="text-center text-amber-300 text-sm">Player {jadeHolderId} 持有玉盏</div>
        <div className="text-center text-stone-400 text-xs mt-2">奉献分×2</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-900/30 to-stone-800/50 border border-amber-700/50 rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-amber-400 font-bold font-serif text-lg">敬茶获取玉盏</div>
        <span className="text-2xl">🏆</span>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm text-stone-400">
          <span>ℹ️</span>
          <span>基础9茶券，奉献每盘减1，消耗3AP</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-stone-300">
          <span>🍵</span>
          <span>
            奉献{myOfferingCount}盘 → 需{actualCost}茶券
          </span>
        </div>
        <div
          className={`flex items-center gap-2 text-sm ${
            meetsTeaReq ? "text-emerald-400" : "text-stone-400"
          }`}
        >
          <span>{meetsTeaReq ? "✓" : "○"}</span>
          <span>
            当前茶券: {myTeaTokens} / 需要: {actualCost}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-rose-300">
          <span>⚡</span>
          <span>消耗 3 AP</span>
        </div>
      </div>

      <button
        onClick={onServeTea}
        disabled={!canServeTea || !isMyTurn}
        className={`w-full py-2 px-4 rounded-lg font-bold transition-all ${
          canServeTea && isMyTurn
            ? "bg-amber-600 hover:bg-amber-500 text-white hover:scale-[1.02] shadow-lg"
            : "bg-stone-700 text-stone-500 cursor-not-allowed"
        }`}
      >
        {canServeTea ? "🍵 敬茶" : "条件未满足"}
      </button>
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
                      {hasJadeChalice && " (奉献×2)"}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-3xl font-bold font-serif">{scoreData.totalScore}</div>
                  <div className="text-[10px] text-stone-500 flex gap-2 justify-end flex-wrap">
                    <span>个人: {scoreData.sumP_ind}</span>
                    <span>
                      奉献: +{scoreData.c_off}
                      {hasJadeChalice ? "(×2)" : ""}
                    </span>
                    <span>茶券: +{scoreData.teaTokens}</span>
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
    useP2P(); // Destructure connectedPlayerCount

  if (!isConnected || !gameState) {
    return <div className="text-white p-10">Connecting to game state...</div>;
  }

  const { G, ctx } = gameState;
  const myPlayerId = playerId || "0";
  const isGameStarted = G.isGameStarted;
  const isMyTurn = ctx.currentPlayer === myPlayerId;
  const myAP = G.players[myPlayerId]?.actionPoints || 0;
  const myTeaTokens = G.players[myPlayerId]?.teaTokens || 0;
  const myOfferingCount = G.players[myPlayerId]?.offeringArea?.length || 0;

  // Start Game Handler
  const handleStartGame = () => {
    sendMove("startGame", connectedPlayerCount); // Pass connected count
  };

  // 敬茶 Handler
  const handleServeTea = () => {
    sendMove("serveTea");
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

      if (over.id === "personal-area") {
        sendMove("taste", { slotId: item.id });
      } else if (over.id === "offering-area") {
        sendMove("offer", { slotId: item.id });
      } else if (over.data.current?.type === "slot") {
        // 调整点心位置（不消耗AP）
        const toSlotId = over.id as string;
        if (item.snack && toSlotId !== item.id) {
          sendMove("adjustSnack", { fromSlotId: item.id, toSlotId: toSlotId });
        }
      }
      return;
    }
  };

  const renderPublicSlot = (slot: PublicSlot) => {
    // Public slots now only contain snacks (文档规定：公共区5个槽位只有点心)
    if (slot.snack) {
      return (
        <div
          key={slot.id}
          className="relative w-28 h-40 flex items-center justify-center bg-gray-800/50 rounded border border-gray-700"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            {isMyTurn && myAP > 0 ? (
              <DraggableCard card={slot.snack} />
            ) : (
              <CardView card={slot.snack} />
            )}
          </div>
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

        {/* Header Info */}
        <div className="bg-gray-800 p-2 flex justify-between items-center shadow-md z-30 relative shrink-0">
          <div className="text-xs text-gray-400">
            <span className="mr-4">Room: {roomId}</span>
            <span className="mr-4">Role: {isHost ? "Host" : "Guest"}</span>
            <span>Player ID: {myPlayerId}</span>
          </div>
          <div className="font-bold text-emerald-400">玉盏春夜宴</div>
          <div className="text-xs text-gray-400">Turn: Player {ctx.currentPlayer}</div>
        </div>

        {/* Content Wrapper */}
        <div className="flex-grow flex overflow-hidden">
          {/* Sidebar: Grandmother Status */}
          {isGameStarted && (
            <GrandmotherStatus
              players={G.players}
              rewardDeck={G.rewardDeck}
              jadeGiven={G.jadeGiven}
              myOfferingCount={myOfferingCount}
              myTeaTokens={myTeaTokens}
              isMyTurn={isMyTurn}
              myAP={myAP}
              onServeTea={handleServeTea}
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
                  {/* Tea Token Section */}
                  <div className="bg-gray-900/90 p-3 rounded-lg border-2 border-amber-600 shadow-[0_0_10px_rgba(217,119,6,0.2)]">
                    <div className="text-[10px] text-amber-300 uppercase tracking-wider font-bold">
                      茶券 (Tea Token)
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <div className="text-2xl font-black text-amber-400 leading-none">
                        🍵 {myTeaTokens}
                      </div>
                      {myTeaTokens > 0 && (
                        <button
                          onClick={() => sendMove("useTeaToken")}
                          className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-1 px-2 rounded transition"
                          title="消耗一枚茶券获得 +1 AP"
                        >
                          +1 AP
                        </button>
                      )}
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
                          {G.rewardDeck?.filter((c: any) => c.level === 2).length || 0}
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
              <PlayerArea
                playerId={myPlayerId}
                playerState={G.players[myPlayerId]}
                isCurrentPlayer={true}
              />
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
};
