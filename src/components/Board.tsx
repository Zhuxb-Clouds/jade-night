import React from 'react';
import { useP2P } from '../network/P2PContext';
import { Card as CardType, WaitingItem, PublicSlot } from '../game/config';
import { DndContext, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';

// --- Visual Components ---

const CardView: React.FC<{ card: CardType; overlayCard?: CardType; onClick?: () => void }> = ({ card, overlayCard, onClick }) => {
  const isSnack = card.type === 'Snack';
  
  const renderPattern = (c: CardType) => {
    const isC_Snack = c.type === 'Snack';
    return (
      <div className="absolute inset-0 flex items-center justify-around w-full h-full px-1 pointer-events-none">
        {c.pattern.map((val, idx) => (
          <div key={idx} className="flex items-center justify-center w-4 h-4">
            {val === 1 && (
              <div 
                className={`
                  rounded-full flex items-center justify-center
                  ${isC_Snack 
                    ? 'w-2 h-2 bg-pink-500' // Dot
                    : 'w-4 h-4 border-2 border-emerald-500' // Ring
                  }
                `}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div 
      onClick={onClick}
      className={`
        relative w-20 h-28 rounded-lg border-2 shadow-md m-1 transition-transform hover:scale-105
        ${isSnack ? 'bg-pink-50/90 border-pink-200' : 'bg-emerald-50/90 border-emerald-200'}
        flex flex-col items-center select-none
      `}
    >
      <div className="text-[10px] font-bold mt-1 text-gray-600 truncate w-full text-center px-1 z-10">
        {card.name}
      </div>
      
      <div className="flex-grow w-full relative">
        {renderPattern(card)}
        {overlayCard && renderPattern(overlayCard)}
      </div>
      
      <div className="text-[8px] text-gray-400 mb-1 z-10">
        {isSnack ? '点心' : '食器'}
      </div>
      
      {overlayCard && (
          <div className="absolute inset-0 bg-pink-50/30 rounded-lg pointer-events-none border-2 border-pink-300/50"></div>
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

// --- Player Area ---

const PlayerArea: React.FC<{ 
  playerId: string; 
  playerState: any; 
  isCurrentPlayer: boolean; 
}> = ({ playerId, playerState, isCurrentPlayer }) => {
  
  const renderWaitingItem = (item: WaitingItem) => {
      // If it's a combined item (Tableware + Snack)
      if (item.tableware && item.snack) {
          return <CardView key={item.id} card={item.tableware} overlayCard={item.snack} />;
      }
      // Single item
      const card = item.tableware || item.snack;
      if (!card) return null; // Should not happen
      return <CardView key={item.id} card={card} />;
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
                        {renderWaitingItem(item)}
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

        {/* Personal Area */}
        <div className="flex-1 min-h-[120px] bg-gray-900/50 rounded p-2 border border-dashed border-gray-700">
          <div className="text-xs text-gray-500 mb-1">Personal Area (Max 7)</div>
          <div className="flex flex-wrap">
             {playerState.personalArea.length === 0 && <span className="text-gray-600 text-xs p-2">Empty</span>}
          </div>
        </div>

        {/* Offering Area */}
        <div className="flex-1 min-h-[120px] bg-gray-900/50 rounded p-2 border border-dashed border-gray-700">
          <div className="text-xs text-gray-500 mb-1">Offering Area (Max 4)</div>
          <div className="flex flex-wrap">
             {playerState.offeringArea.length === 0 && <span className="text-gray-600 text-xs p-2">Empty</span>}
          </div>
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

      const cardId = active.id as string;
      
      // Drop on Waiting Area (New Slot)
      if (over.id === 'waiting-area') {
          sendMove('takeCard', { cardId, targetSlotId: undefined });
      }
      // Drop on Existing Slot (Stacking)
      else if (over.data.current?.type === 'slot') {
          sendMove('takeCard', { cardId, targetSlotId: over.id });
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
        {/* Header Info */}
        <div className="bg-gray-800 p-2 flex justify-between items-center shadow-md z-10">
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

        {/* Main Game Area */}
        <div className="flex-grow flex flex-col p-4 gap-4 overflow-y-auto">
            
            {/* Top: Opponents */}
            <div className="flex gap-2 overflow-x-auto pb-2">
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
    </DndContext>
  );
};
