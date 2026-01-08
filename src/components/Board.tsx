import React from 'react';
import { useP2P } from '../network/P2PContext';
import { Card as CardType, WaitingItem, PublicSlot, getGameThresholds } from '../game/config';
import { DndContext, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';

// --- Visual Components ---

const CardView: React.FC<{ card: CardType; overlayCard?: CardType; onClick?: () => void }> = ({ card, overlayCard, onClick }) => {
  const isSnack = card.type === 'Snack';
  
  const renderAttributes = (c: CardType) => {
    const isC_Snack = c.type === 'Snack';
    const { colors, shapes, temps } = c.attributes;

    // Define fixed order for slots to ensure alignment
    const allColors = ['red', 'green', 'yellow'];
    const allShapes = ['circle', 'square', 'flower'];
    const allTemps = ['warm', 'cold'];

    const renderSlot = (type: 'color' | 'shape' | 'temp', value: string, isActive: boolean) => {
        const sizeClass = isC_Snack ? 'w-3 h-3' : 'w-5 h-5';
        let colorClass = '';
        let shapeStyle = 'rounded-full';

        // Styling logic
        if (isActive) {
            // Color Logic
            if (type === 'color') {
                if (value === 'red') colorClass = isC_Snack ? 'bg-rose-500' : 'border-rose-500 border-2';
                else if (value === 'green') colorClass = isC_Snack ? 'bg-emerald-500' : 'border-emerald-500 border-2';
                else if (value === 'yellow') colorClass = isC_Snack ? 'bg-amber-400' : 'border-amber-400 border-2';
            } 
            // Shape Logic
            else if (type === 'shape') {
                colorClass = isC_Snack ? 'bg-slate-600' : 'border-slate-600 border-2';
                if (value === 'square') shapeStyle = 'rounded-md';
                else if (value === 'flower') shapeStyle = 'rotate-45 rounded-sm'; 
            } 
            // Temp Logic
            else if (type === 'temp') {
                if (value === 'warm') {
                    colorClass = isC_Snack ? 'bg-orange-500' : 'border-orange-500 border-2';
                    shapeStyle = 'rounded-t-lg';
                } else { // cold
                    colorClass = isC_Snack ? 'bg-cyan-500' : 'border-cyan-500 border-2';
                    shapeStyle = 'rounded-b-lg';
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
            {allColors.map(val => renderSlot('color', val, colors.includes(val as any)))}
         </div>
         {/* Row 2: Shape */}
         <div className="flex justify-center items-center h-8 w-full gap-1">
            {allShapes.map(val => renderSlot('shape', val, shapes.includes(val as any)))}
         </div>
         {/* Row 3: Temp */}
         <div className="flex justify-center items-center h-8 w-full gap-1">
            {allTemps.map(val => renderSlot('temp', val, temps.includes(val as any)))}
         </div>
      </div>
    );
  };

  return (
    <div 
      onClick={onClick}
      className={`
        relative w-24 h-36 rounded-lg border shadow-sm m-1 transition-transform hover:scale-105
        ${isSnack ? 'bg-pink-50/90 border-pink-200' : 'bg-stone-50/90 border-stone-300'}
        flex flex-col items-center select-none overflow-hidden
      `}
    >
      {/* Header Level Indicator for Plates */}
      {!isSnack && (
         <div className={`absolute top-0 right-0 px-1.5 py-0.5 text-[8px] font-bold text-white rounded-bl-lg
            ${card.level === 1 ? 'bg-gray-400' : 
              card.level === 2 ? 'bg-blue-400' : 
              card.level === 3 ? 'bg-purple-500' : 'bg-amber-500'}
         `}>
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
        {isSnack ? '点心' : card.description || '食器'}
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
    data: { card }
  });
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 1000,
    cursor: 'grabbing',
  } : { cursor: 'grab' };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <CardView card={card} />
    </div>
  );
};

const DroppableSlot = ({ slot, children, isCurrentPlayer }: { slot: WaitingItem, children: React.ReactNode, isCurrentPlayer: boolean }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: slot.id,
        data: { type: 'slot', slot },
        disabled: !isCurrentPlayer // Only enable drop if it's my area
    });
    
    return (
        <div ref={setNodeRef} className={`relative ${isOver ? 'ring-2 ring-emerald-400 rounded-lg' : ''}`}>
            {children}
        </div>
    );
}

const DroppableWaitingArea = ({ children, isCurrentPlayer }: { children: React.ReactNode, isCurrentPlayer: boolean }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'waiting-area',
        data: { type: 'area' },
        disabled: !isCurrentPlayer
    });
    
    return (
        <div ref={setNodeRef} className={`flex-1 min-h-[120px] bg-gray-900/50 rounded p-2 border border-dashed transition-colors ${isOver ? 'border-emerald-400 bg-emerald-900/20' : 'border-gray-700'}`}>
            <div className="text-xs text-gray-500 mb-1">Waiting Area (Max 5)</div>
            <div className="flex flex-wrap">
                {children}
            </div>
        </div>
    );
}

const DroppablePersonalArea = ({ children, isCurrentPlayer }: { children: React.ReactNode, isCurrentPlayer: boolean }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'personal-area',
        data: { type: 'area', area: 'personal' },
        disabled: !isCurrentPlayer
    });
    
    return (
        <div ref={setNodeRef} className={`flex-1 min-h-[120px] bg-gray-900/50 rounded p-2 border border-dashed transition-colors ${isOver ? 'border-amber-400 bg-amber-900/20' : 'border-gray-700'}`}>
            <div className="text-xs text-gray-500 mb-1">Personal Area (Max 5)</div>
            <div className="flex flex-wrap">
                {children}
            </div>
        </div>
    );
};

const DroppableOfferingArea = ({ children, isCurrentPlayer }: { children: React.ReactNode, isCurrentPlayer: boolean }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'offering-area',
        data: { type: 'area', area: 'offering' },
        disabled: !isCurrentPlayer
    });
    
    return (
        <div ref={setNodeRef} className={`flex-1 min-h-[120px] bg-gray-900/50 rounded p-2 border border-dashed transition-colors ${isOver ? 'border-purple-400 bg-purple-900/20' : 'border-gray-700'}`}>
            <div className="text-xs text-gray-500 mb-1">Offering Area (Max 5)</div>
            <div className="flex flex-wrap">
                {children}
            </div>
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
          if (item.tableware && item.snack) {
            return <CardView key={item.id} card={item.tableware} overlayCard={item.snack} />;
          }
          const card = item.tableware || item.snack;
          return card ? <CardView key={item.id} card={card} /> : null;
      })();
      
      if (!content) return null;

      if (isDraggable) {
          return (
            <DraggableWaitingItem item={item}>
                {content}
            </DraggableWaitingItem>
          );
      }
      return content;
  };
    
  return (
    <div className={`p-4 rounded-lg border ${isCurrentPlayer ? 'bg-gray-800 border-emerald-500' : 'bg-gray-800/50 border-gray-700'}`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className={`font-bold ${isCurrentPlayer ? 'text-emerald-400' : 'text-gray-400'}`}>
          {isCurrentPlayer ? 'My Area' : `Player ${playerId}`}
        </h3>
        <div className="text-xs text-gray-500">
          <span className="mr-2">AP: {playerState.actionPoints}</span>
          <span>Score: 0</span>
        </div>
      </div>

      {/* Areas */}
      <div className="flex gap-4">
        {/* Waiting Area */}
        {isCurrentPlayer ? (
            <DroppableWaitingArea isCurrentPlayer={isCurrentPlayer}>
                {playerState.waitingArea.length === 0 && <span className="text-gray-600 text-xs p-2">Drag cards here</span>}
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
    </div>
  );
};

// Define DraggableWaitingItem to handle dragging existing items
const DraggableWaitingItem = ({ item, children }: { item: WaitingItem, children: React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
      id: item.id,
      data: { type: 'waitingItem', item }
    });
    const style = transform ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      zIndex: 1000,
      cursor: 'grabbing',
    } : { cursor: 'grab' };
  
    return (
      <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
        {children}
      </div>
    );
};


const GrandmotherStatus: React.FC<{ players: Record<string, any>; numPlayers: number }> = ({ players, numPlayers }) => {
    const allPlayers = Object.values(players);
    const totalOfferings = allPlayers.reduce((sum: number, p: any) => sum + p.offeringArea.length, 0);
    
    // Dynamic thresholds
    const { endThreshold, jadeThreshold } = getGameThresholds(numPlayers);
    
    const maxOfferings = endThreshold; 
    const percentage = Math.min((totalOfferings / maxOfferings) * 100, 100);
    const isThresholdMet = totalOfferings >= jadeThreshold;
    
    // Calculate position for the marker
    const markerPosition = (jadeThreshold / maxOfferings) * 100;

    return (
        <div className="w-64 bg-stone-900 border-r border-stone-800 p-6 flex flex-col gap-6 text-stone-200 shadow-2xl z-20 shrink-0">
            <h2 className="text-2xl font-bold text-amber-500 font-serif border-b border-stone-700 pb-2 flex items-center gap-2">
                <span>老太君</span>
                <span className="text-xs font-sans text-stone-500 font-normal self-end mb-1">Status</span>
            </h2>
            
            <div className="space-y-3">
                <div className="flex justify-between items-end">
                    <span className="text-sm font-semibold text-stone-400">奉献对数</span>
                    <span className="text-2xl font-bold text-amber-400 font-serif">{totalOfferings} <span className="text-sm text-stone-600">/ {maxOfferings}</span></span>
                </div>
                
                {/* Progress Bar */}
                <div className="relative pt-1">
                    <div className="overflow-hidden h-4 text-xs flex rounded bg-stone-800 border border-stone-700">
                        <div 
                            style={{ width: `${percentage}%` }} 
                            className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-700 ease-out 
                                ${isThresholdMet ? 'bg-gradient-to-r from-amber-700 to-amber-500' : 'bg-stone-700'}
                            `}
                        ></div>
                    </div>
                    {/* Marker for Jade Threshold */}
                    <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-white/10 z-10" 
                        style={{ left: `${markerPosition}%` }}
                        title={`Threshold N=${jadeThreshold}`}
                    >
                        <div className="absolute -top-4 -translate-x-1/2 text-[10px] text-stone-500">{jadeThreshold}</div>
                    </div>
                </div>

                <div className={`text-xs p-3 rounded border ${isThresholdMet ? 'bg-amber-900/20 border-amber-900/50 text-amber-200' : 'bg-stone-800 border-stone-700 text-stone-400'} transition-colors duration-300`}>
                    {isThresholdMet 
                        ? "✨ 老太君心情愉悦！现在奉献有几率获得【玉盏】赏赐。" 
                        : `⏳ 老太君正在品尝... 奉献总数达到 ${jadeThreshold} 时将开启【玉盏】判定。`}
                </div>
            </div>

            {/* Threshold Formula Reminder */}
            {isThresholdMet && (
                <div className="bg-stone-800/50 p-4 rounded-lg text-xs leading-relaxed border border-stone-700">
                    <div className="font-bold text-stone-300 mb-2 border-b border-stone-700/50 pb-1">判定公式</div>
                    <div className="flex flex-col gap-1 font-mono text-amber-500/90 mb-2">
                         <div>T = (N - {jadeThreshold - 1}) + 我的奉献数 + 配对分</div>
                         <div className="text-[10px] text-stone-500">N = {totalOfferings}</div>
                    </div>
                    <div className="text-stone-400/80">
                        若 <span className="text-white font-bold">2d6 &lt; T</span>，获得玉盏。<br/>
                        失败无惩罚。
                    </div>
                </div>
            )}

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
    if (notification.type !== 'offering') return null;

    const { message, details } = notification;
    const isSuccess = details?.success;

    return (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-none">
            <div className={`
                flex flex-col items-center gap-2 px-6 py-4 rounded-xl shadow-2xl border-2 backdrop-blur-md
                ${isSuccess ? 'bg-amber-900/90 border-amber-500 text-amber-100' : 'bg-gray-900/90 border-gray-600 text-gray-200'}
            `}>
                <div className="font-bold text-lg text-center font-serif whitespace-pre-wrap">{message}</div>
                
                {details && (
                    <div className="grid grid-cols-3 gap-4 text-xs mt-2 w-full pt-2 border-t border-white/10">
                         <div className="flex flex-col items-center">
                             <span className="opacity-50">Score T</span>
                             <span className="font-bold text-lg">{details.threshold}</span>
                         </div>
                         <div className="flex flex-col items-center">
                             <span className="opacity-50">Rolled</span>
                             <span className={`font-bold text-lg ${isSuccess ? 'text-emerald-400' : 'text-rose-400'}`}>{details.roll}</span>
                             <span className="text-[9px] opacity-70">({details.dice[0]} + {details.dice[1]})</span>
                         </div>
                         <div className="flex flex-col items-center">
                             <span className="opacity-50">Result</span>
                             <span className="font-bold">{isSuccess ? 'SUCCESS' : 'FAIL'}</span>
                         </div>
                    </div>
                )}
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
                     <div className="text-amber-500 text-sm font-bold uppercase tracking-[0.3em] mb-2">Game Over</div>
                     <h1 className="text-5xl font-serif text-white mb-2">
                         {winnerId ? `Player ${winnerId} Wins!` : 'Game Over'}
                     </h1>
                     <div className="text-stone-400 italic">The feast has concluded.</div>
                 </div>
                 
                 <div className="space-y-4">
                     {Object.keys(players).map(pid => {
                         const scoreData = scores[pid];
                         const isWinner = pid === winnerId;
                         
                         return (
                             <div key={pid} className={`flex items-center justify-between p-4 rounded-lg border ${isWinner ? 'bg-amber-900/30 border-amber-500/50' : 'bg-stone-800 border-stone-700'}`}>
                                 <div className="flex items-center gap-4">
                                     {isWinner && <span className="text-2xl">👑</span>}
                                     <div>
                                         <div className={`font-bold ${isWinner ? 'text-amber-400' : 'text-stone-300'}`}>Player {pid}</div>
                                         <div className="text-xs text-stone-500">
                                             Items: {players[pid].personalArea.length} Personal / {players[pid].offeringArea.length} Offered
                                         </div>
                                     </div>
                                 </div>
                                 
                                 <div className="text-right">
                                     <div className="text-3xl font-bold font-serif">{scoreData.totalScore}</div>
                                     <div className="text-[10px] text-stone-500 flex gap-2 justify-end">
                                         <span>P: {scoreData.sumP_ind}</span>
                                         <span>O: {scoreData.sumP_off}</span>
                                         <span>B: {scoreData.c_off}</span>
                                         <span>Pen: -{scoreData.c_wait}</span>
                                     </div>
                                 </div>
                             </div>
                         );
                     })}
                 </div>
                 
                 <div className="mt-8 text-center">
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
  const { gameState, sendMove, playerId, isConnected, peerId, isHost } = useP2P();

  if (!isConnected || !gameState) {
    return <div className="text-white p-10">Connecting to game state...</div>;
  }

  const { G, ctx } = gameState;
  const myPlayerId = playerId || '0';
  const isGameStarted = G.isGameStarted;
  const isMyTurn = ctx.currentPlayer === myPlayerId;
  const myAP = G.players[myPlayerId]?.actionPoints || 0;

  // Start Game Handler
  const handleStartGame = () => {
    sendMove('startGame');
  };

  const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      
      if (!over || !isMyTurn) return;

      const draggedId = active.id as string;
      const dragType = active.data.current?.type; // 'card' or 'waitingItem'
      
      // Case 1: Dragging Card from Public Area (Take Card)
      // Note: DraggableCard doesn't put 'type' in data, let's fix that or assume default
      if (!dragType || dragType === 'card') { // Assuming logic from DraggableCard
           if (over.id === 'waiting-area') {
               sendMove('takeCard', { cardId: draggedId, targetSlotId: undefined });
           }
           else if (over.data.current?.type === 'slot') {
               sendMove('takeCard', { cardId: draggedId, targetSlotId: over.id });
           }
           return;
      }

      // Case 2: Dragging Item from Waiting Area (Taste or Offer)
      if (dragType === 'waitingItem') {
          const item = active.data.current?.item;
          if (!item) return;

          if (over.id === 'personal-area') {
              sendMove('taste', { slotId: item.id });
          }
          else if (over.id === 'offering-area') {
              sendMove('offer', { slotId: item.id });
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
              <div key={slot.id} className="relative w-24 h-32 flex items-center justify-center bg-gray-800/50 rounded border border-gray-700">
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
              <div key={slot.id} className="relative w-24 h-32 flex items-center justify-center bg-gray-800/50 rounded border border-gray-700">
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
              <div key={slot.id} className="w-24 h-32 bg-gray-800/20 rounded border border-gray-700 flex items-center justify-center">
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

        {/* Header Info */}
        <div className="bg-gray-800 p-2 flex justify-between items-center shadow-md z-30 relative shrink-0">
            <div className="text-xs text-gray-400">
            <span className="mr-4">Room: {peerId}</span>
            <span className="mr-4">Role: {isHost ? 'Host' : 'Guest'}</span>
            <span>Player ID: {myPlayerId}</span>
            </div>
            <div className="font-bold text-emerald-400">玉盏春夜宴</div>
            <div className="text-xs text-gray-400">
            Turn: Player {ctx.currentPlayer}
            </div>
        </div>

        {/* Content Wrapper */}
        <div className="flex-grow flex overflow-hidden">
            {/* Sidebar: Grandmother Status */}
            {isGameStarted && <GrandmotherStatus players={G.players} numPlayers={Object.keys(G.players).length} />}

            {/* Main Game Area */}
            <div className="flex-grow flex flex-col p-4 gap-4 overflow-y-auto">
                
                {/* Top: Opponents */}
                <div className="flex gap-2 overflow-x-auto pb-2 shrink-0">
                {Object.keys(G.players).map(pid => {
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
            <div className={`flex-grow flex flex-col items-center justify-center min-h-[200px] bg-gray-800/30 rounded-xl border border-gray-700 p-4 relative transition-all duration-300 ${!isMyTurn ? 'opacity-60 grayscale-[0.3]' : ''}`}>
            
            {/* AP Indicator */}
            {isGameStarted && isMyTurn && (
                <div className="absolute top-4 right-4 bg-gray-900/90 p-3 rounded-lg border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] z-20 animate-pulse">
                    <div className="text-[10px] text-emerald-300 uppercase tracking-wider font-bold">Action Points</div>
                    <div className="text-4xl font-black text-emerald-400 text-center leading-none mt-1">{myAP}</div>
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
                    <p className="text-gray-400 animate-pulse">Waiting for host to start the game...</p>
                )}
                <div className="mt-4 text-sm text-gray-500">
                    Players connected: {Object.keys(G.players).length}
                </div>
                </div>
            ) : (
                <div className="w-full">
                <div className="text-center text-gray-400 text-sm mb-2">Public Area (8 Slots)</div>
                <div className="flex flex-wrap justify-center gap-2">
                    {G.publicArea.map((slot: PublicSlot) => renderPublicSlot(slot))}
                </div>
                </div>
            )}
            </div>

            {/* Bottom: My Area */}
            <div className={`mt-auto transition-all duration-300 ${!isMyTurn ? 'opacity-60 grayscale-[0.3] pointer-events-none' : ''}`}>
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
