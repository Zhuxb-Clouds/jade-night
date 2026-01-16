import React from "react";
import { useP2P } from "../network/P2PContext";
import { Card as CardType, WaitingItem, PublicSlot } from "../game/config";
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
        ${isSnack ? "bg-pink-50/90 border-pink-200" : "bg-stone-50/90 border-stone-300"}
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
  // Check if this slot can accept more snacks
  // Jade Chalice can accept up to 3 snacks
  // Normal plates can only accept if empty
  const isJadeChalice = slot.tableware?.name === "玉盏";
  const jadeCanAccept = isJadeChalice && (!slot.snacks || slot.snacks.length < 3);
  const canAcceptSnack = jadeCanAccept || (!slot.snack && slot.tableware);

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
      <div className="text-xs text-gray-500 mb-1">Personal Area (Max 5)</div>
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
      <div className="text-xs text-gray-500 mb-1">Offering Area (Max 5)</div>
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
  const renderWaitingItem = (item: WaitingItem, isDraggable: boolean = false) => {
    // Logic for Draggable Wrapper if current player owns item
    // Note: In Dnd-kit, we usually drag the SOURCE.
    // Waiting Items are sources for Offer/Taste/Share.
    // So if isDraggable is true, we wrap in DraggableNavItem?
    // Actually we have DraggableCard. But here we drag the whole waiting Item (slot contents).
    // We can make the item draggable by its ID.

    const content = (() => {
      // Check if this is a Jade Chalice with multiple snacks
      const isJadeChalice = item.tableware?.name === "玉盏";

      if (isJadeChalice && item.snacks && item.snacks.length > 0) {
        // Jade Chalice with stacked snacks - show count badge
        return (
          <div className="relative">
            <CardView key={item.id} card={item.tableware!} overlayCard={item.snacks[0]} />
            {item.snacks.length > 1 && (
              <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
                {item.snacks.length}
              </div>
            )}
          </div>
        );
      }

      if (item.tableware && item.snack) {
        return <CardView key={item.id} card={item.tableware} overlayCard={item.snack} />;
      }
      const card = item.tableware || item.snack;
      return card ? <CardView key={item.id} card={card} /> : null;
    })();

    if (!content) return null;

    if (isDraggable) {
      return <DraggableWaitingItem item={item}>{content}</DraggableWaitingItem>;
    }
    return content;
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
            </h3>
            <div className="text-xs text-gray-500">
              <span className="mr-2">AP: {playerState.actionPoints}</span>
              <span className="mr-2">🍵 {playerState.teaTokens || 0}</span>
              <span>Score: 0</span>
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
                    {renderWaitingItem(item, true)} {/* Enable dragging from waiting area */}
                  </DroppableSlot>
                ))}
              </DroppableWaitingArea>
            ) : (
              <div className="flex-1 min-h-[120px] bg-gray-900/50 rounded p-2 border border-dashed border-gray-700">
                <div className="text-xs text-gray-500 mb-1">Waiting Area (Max 5)</div>
                <div className="flex flex-wrap">
                  {playerState.waitingArea.map((item: WaitingItem) => (
                    <div key={item.id}>{renderWaitingItem(item)}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Personal Area - Taste */}
            {isCurrentPlayer ? (
              <DroppablePersonalArea isCurrentPlayer={isCurrentPlayer}>
                {playerState.personalArea.map((item: WaitingItem) => (
                  <div key={item.id}>{renderWaitingItem(item, false)}</div>
                ))}
              </DroppablePersonalArea>
            ) : (
              <div className="flex-1 min-h-[120px] bg-gray-900/50 rounded p-2 border border-dashed border-gray-700">
                <div className="text-xs text-gray-500 mb-1">Personal Area (Max 5)</div>
                <div className="flex flex-wrap">
                  {playerState.personalArea.map((item: WaitingItem) => (
                    <div key={item.id}>{renderWaitingItem(item, false)}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Offering Area */}
            {isCurrentPlayer ? (
              <DroppableOfferingArea isCurrentPlayer={isCurrentPlayer}>
                {playerState.offeringArea.map((item: WaitingItem) => (
                  <div key={item.id}>{renderWaitingItem(item, false)}</div>
                ))}
              </DroppableOfferingArea>
            ) : (
              <div className="flex-1 min-h-[120px] bg-gray-900/50 rounded p-2 border border-dashed border-gray-700">
                <div className="text-xs text-gray-500 mb-1">Offering Area (Max 5)</div>
                <div className="flex flex-wrap">
                  {playerState.offeringArea.map((item: WaitingItem) => (
                    <div key={item.id}>{renderWaitingItem(item, false)}</div>
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
}> = ({ players, rewardDeck }) => {
  const allPlayers = Object.values(players);
  const totalOfferings = allPlayers.reduce((sum: number, p: any) => sum + p.offeringArea.length, 0);

  // Check if Jade Chalice has been distributed
  const jadeDistributed = allPlayers.some(
    (p: any) =>
      p.waitingArea.some((w: any) => w.tableware?.name === "玉盏") ||
      p.personalArea.some((w: any) => w.tableware?.name === "玉盏") ||
      p.offeringArea.some((w: any) => w.tableware?.name === "玉盏")
  );

  // Check L3 plates remaining in reward deck
  const l3PlatesRemaining = rewardDeck.filter((c: any) => c.level === 3).length;
  const allL3Distributed = l3PlatesRemaining === 0;

  // NEW RULE: Jade judgment triggers every 5 offerings
  const progressToNextJade = totalOfferings % 5;
  const isAtJadeThreshold = totalOfferings > 0 && totalOfferings % 5 === 0;

  // Game end condition check
  const endConditionMet = jadeDistributed && allL3Distributed;

  return (
    <div className="w-64 bg-stone-900 border-r border-stone-800 p-6 flex flex-col gap-6 text-stone-200 shadow-2xl z-20 shrink-0">
      <h2 className="text-2xl font-bold text-amber-500 font-serif border-b border-stone-700 pb-2 flex items-center gap-2">
        <span>老太君</span>
        <span className="text-xs font-sans text-stone-500 font-normal self-end mb-1">Status</span>
      </h2>

      <div className="space-y-3">
        <div className="flex justify-between items-end">
          <span className="text-sm font-semibold text-stone-400">奉献对数</span>
          <span className="text-2xl font-bold text-amber-400 font-serif">{totalOfferings}</span>
        </div>

        {/* Game End Conditions */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            游戏结束条件
          </div>
          <div
            className={`flex items-center gap-2 p-2 rounded border ${
              jadeDistributed
                ? "bg-emerald-900/30 border-emerald-700 text-emerald-300"
                : "bg-stone-800 border-stone-700 text-stone-400"
            }`}
          >
            <span className={jadeDistributed ? "text-emerald-400" : "text-stone-600"}>
              {jadeDistributed ? "✓" : "○"}
            </span>
            <span className="text-sm">玉盏已发放</span>
          </div>
          <div
            className={`flex items-center gap-2 p-2 rounded border ${
              allL3Distributed
                ? "bg-emerald-900/30 border-emerald-700 text-emerald-300"
                : "bg-stone-800 border-stone-700 text-stone-400"
            }`}
          >
            <span className={allL3Distributed ? "text-emerald-400" : "text-stone-600"}>
              {allL3Distributed ? "✓" : "○"}
            </span>
            <span className="text-sm">L3盘子已发完 ({l3PlatesRemaining}剩余)</span>
          </div>
        </div>

        {endConditionMet && (
          <div className="text-xs p-3 rounded border bg-amber-900/30 border-amber-700 text-amber-200 animate-pulse">
            ⚡ 结束条件已满足！当前轮结束后游戏终止。
          </div>
        )}

        {!jadeDistributed && (
          <div
            className={`text-xs p-3 rounded border ${
              isAtJadeThreshold
                ? "bg-amber-900/20 border-amber-900/50 text-amber-200"
                : "bg-stone-800 border-stone-700 text-stone-400"
            } transition-colors duration-300`}
          >
            {isAtJadeThreshold
              ? "✨ 触发判定！本次奉献有机会获得【玉盏】赏赐。"
              : `⏳ 还差 ${5 - progressToNextJade} 盘触发下次【玉盏】判定。`}
          </div>
        )}
      </div>

      {/* Threshold Formula Reminder */}
      <div className="bg-stone-800/50 p-4 rounded-lg text-xs leading-relaxed border border-stone-700">
        <div className="font-bold text-stone-300 mb-2 border-b border-stone-700/50 pb-1">
          判定规则
        </div>
        <div className="flex flex-col gap-1 font-mono text-amber-500/90 mb-2">
          <div>2d6 + 我的奉献数 ≥ 12</div>
        </div>
        <div className="text-stone-400/80">
          每满 <span className="text-white font-bold">5盘</span> 触发一次判定。
          <br />
          奉献区每有 1盘，骰子 +1。
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

        {details && (
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

// L3奉献选择弹窗
const L3ChoiceModal: React.FC<{
  l3ChoicePending: any;
  myPlayerId: string;
  myOfferingCount: number;
  onChooseTeaTokens: () => void;
  onChooseJadeRoll: () => void;
}> = ({ l3ChoicePending, myPlayerId, myOfferingCount, onChooseTeaTokens, onChooseJadeRoll }) => {
  if (!l3ChoicePending || l3ChoicePending.playerId !== myPlayerId) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-gradient-to-b from-stone-800 to-stone-900 border-2 border-amber-600 rounded-2xl p-8 max-w-lg w-full shadow-[0_0_40px_rgba(217,119,6,0.4)]">
        <div className="text-center mb-6">
          <div className="text-amber-500 text-sm font-bold uppercase tracking-[0.2em] mb-2">
            珍宝盘奉献
          </div>
          <h2 className="text-2xl font-serif text-white mb-2">请选择奖励</h2>
          <p className="text-stone-400 text-sm">您奉献了一个L3珍宝盘，请选择您的奖励</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 选项1: 稳健赏赐 */}
          <button
            onClick={onChooseTeaTokens}
            className="group relative bg-stone-700/50 hover:bg-emerald-900/50 border-2 border-stone-600 hover:border-emerald-500 rounded-xl p-6 transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="text-4xl mb-3">🍵🍵</div>
            <div className="text-lg font-bold text-emerald-400 mb-2">稳健赏赐</div>
            <div className="text-sm text-stone-300 mb-3">立即获得 2枚茶券</div>
            <div className="text-xs text-stone-500">安全选择，确保收益</div>
          </button>

          {/* 选项2: 博取玉盏 */}
          <button
            onClick={onChooseJadeRoll}
            className="group relative bg-stone-700/50 hover:bg-amber-900/50 border-2 border-stone-600 hover:border-amber-500 rounded-xl p-6 transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="text-4xl mb-3">🎲✨</div>
            <div className="text-lg font-bold text-amber-400 mb-2">博取玉盏</div>
            <div className="text-sm text-stone-300 mb-3">进行玉盏判定</div>
            <div className="text-xs text-stone-500">2d6 + {myOfferingCount} ≥ 12</div>
            <div className="text-xs text-amber-500/70 mt-1">
              成功率:{" "}
              {Math.min(100, Math.max(0, Math.round(calculateSuccessRate(myOfferingCount) * 100)))}%
            </div>
          </button>
        </div>

        <div className="mt-6 text-center text-xs text-stone-500">
          您当前的奉献区有 <span className="text-amber-400 font-bold">{myOfferingCount}</span>{" "}
          盘，骰子修正 +{myOfferingCount}
        </div>
      </div>
    </div>
  );
};

// 计算成功率 (2d6 + modifier >= 12)
const calculateSuccessRate = (modifier: number): number => {
  // 2d6 可能的结果是 2-12
  // 需要 roll >= (12 - modifier)
  const target = 12 - modifier;
  if (target <= 2) return 1; // 100% success
  if (target > 12) return 0; // 0% success

  // Count combinations that meet or exceed target
  let successCombinations = 0;
  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = 1; d2 <= 6; d2++) {
      if (d1 + d2 >= target) successCombinations++;
    }
  }
  return successCombinations / 36;
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
                    <div className={`font-bold ${isWinner ? "text-amber-400" : "text-stone-300"}`}>
                      Player {pid}
                    </div>
                    <div className="text-xs text-stone-500">
                      Items: {players[pid].personalArea.length} Personal /{" "}
                      {players[pid].offeringArea.length} Offered
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-3xl font-bold font-serif">{scoreData.totalScore}</div>
                  <div className="text-[10px] text-stone-500 flex gap-2 justify-end">
                    <span>P: {scoreData.sumP_ind}</span>
                    <span>O: {scoreData.sumP_off}</span>
                    <span>Pen: -{scoreData.c_wait * 2}</span>
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
  const teaTokenUsedThisTurn = G.players[myPlayerId]?.teaTokenUsedThisTurn || false;
  const myOfferingCount = G.players[myPlayerId]?.offeringArea?.length || 0;

  // Start Game Handler
  const handleStartGame = () => {
    sendMove("startGame", connectedPlayerCount); // Pass connected count
  };

  // L3 Choice Handlers
  const handleL3ChooseTeaTokens = () => {
    sendMove("l3ChooseTeaTokens");
  };

  const handleL3ChooseJadeRoll = () => {
    sendMove("l3ChooseJadeRoll");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !isMyTurn) return;

    const draggedId = active.id as string;
    const dragType = active.data.current?.type; // 'card' or 'waitingItem'

    // Case 1: Dragging Card from Public Area (Take Card)
    // Note: DraggableCard doesn't put 'type' in data, let's fix that or assume default
    if (!dragType || dragType === "card") {
      // Assuming logic from DraggableCard
      if (over.id === "waiting-area") {
        sendMove("takeCard", { cardId: draggedId, targetSlotId: undefined });
      } else if (over.data.current?.type === "slot") {
        sendMove("takeCard", { cardId: draggedId, targetSlotId: over.id });
      }
      return;
    }

    // Case 2: Dragging Item from Waiting Area (Taste or Offer)
    if (dragType === "waitingItem") {
      const item = active.data.current?.item;
      if (!item) return;

      if (over.id === "personal-area") {
        sendMove("taste", { slotId: item.id });
      } else if (over.id === "offering-area") {
        sendMove("offer", { slotId: item.id });
      }
      return;
    }
  };

  const renderPublicSlot = (slot: PublicSlot) => {
    // If slot has Snack, it's on top of Tableware
    // Only the top card is draggable

    if (slot.snack) {
      // Snack is available
      // If Tableware is also there, render it as background
      return (
        <div
          key={slot.id}
          className="relative w-24 h-32 flex items-center justify-center bg-gray-800/50 rounded border border-gray-700"
        >
          {slot.tableware && (
            <div className="absolute opacity-50 pointer-events-none transform scale-90">
              <CardView card={slot.tableware} />
            </div>
          )}
          {isMyTurn && myAP > 0 ? (
            <DraggableCard card={slot.snack} />
          ) : (
            <CardView card={slot.snack} />
          )}
        </div>
      );
    } else if (slot.tableware) {
      // Only Tableware available
      return (
        <div
          key={slot.id}
          className="relative w-24 h-32 flex items-center justify-center bg-gray-800/50 rounded border border-gray-700"
        >
          {isMyTurn && myAP > 0 ? (
            <DraggableCard card={slot.tableware} />
          ) : (
            <CardView card={slot.tableware} />
          )}
        </div>
      );
    } else {
      // Empty slot (should be refilled automatically, but just in case)
      return (
        <div
          key={slot.id}
          className="w-24 h-32 bg-gray-800/20 rounded border border-gray-700 flex items-center justify-center"
        >
          <span className="text-xs text-gray-600">Empty</span>
        </div>
      );
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col min-h-screen bg-gray-900 text-white overflow-hidden">
        {/* Overlays */}
        <GameNotification notification={G.notification} />
        <GameOverScreen gameover={ctx.gameover} players={G.players} />
        <L3ChoiceModal
          l3ChoicePending={G.l3ChoicePending}
          myPlayerId={myPlayerId}
          myOfferingCount={myOfferingCount}
          onChooseTeaTokens={handleL3ChooseTeaTokens}
          onChooseJadeRoll={handleL3ChooseJadeRoll}
        />

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
          {isGameStarted && <GrandmotherStatus players={G.players} rewardDeck={G.rewardDeck} />}

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
                      {myTeaTokens > 0 && !teaTokenUsedThisTurn && (
                        <button
                          onClick={() => sendMove("useTeaToken")}
                          className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-1 px-2 rounded transition"
                          title="消耗一枚茶券获得 +1 AP"
                        >
                          +1 AP
                        </button>
                      )}
                      {teaTokenUsedThisTurn && (
                        <span className="text-xs text-gray-400">本回合已用</span>
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
                    Public Area (8 Slots)
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {G.publicArea.map((slot: PublicSlot) => renderPublicSlot(slot))}
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
