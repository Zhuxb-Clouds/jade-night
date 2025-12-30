import React from 'react';
import { useP2P } from '../network/P2PContext';

export const Board: React.FC = () => {
  const { gameState, sendMove, playerId, isConnected, peerId, isHost } = useP2P();

  if (!isConnected || !gameState) {
    return null;
  }

  const myPosition = gameState.G.players[playerId || '0']?.position || 0;
  const opponentId = playerId === '0' ? '1' : '0';
  const opponentPosition = gameState.G.players[opponentId]?.position || 0;
  
  const winner = gameState.ctx.gameover?.winner;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="absolute top-4 left-4 text-xs text-gray-500">
        <p>Role: {isHost ? 'Host' : 'Guest'}</p>
        <p>ID: {peerId}</p>
      </div>

      <h2 className="text-2xl font-bold mb-8 text-emerald-400">Game Board</h2>

      {winner ? (
        <div className="text-4xl font-bold text-yellow-400 mb-8 animate-bounce">
          {winner === playerId ? 'You Win!' : 'You Lose!'}
        </div>
      ) : (
        <div className="mb-8 text-xl">
           Current Turn: Player {gameState.ctx.currentPlayer}
        </div>
      )}

      <div className="w-full max-w-2xl bg-gray-800 p-8 rounded-lg shadow-lg mb-8">
        {/* Track for Player 0 */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="font-bold text-blue-400">Player 0 (Host)</span>
            <span>Pos: {gameState.G.players['0'].position}</span>
          </div>
          <div className="relative h-4 bg-gray-700 rounded-full">
            <div 
              className="absolute top-0 left-0 h-4 bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(gameState.G.players['0'].position * 10, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Track for Player 1 */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="font-bold text-red-400">Player 1 (Guest)</span>
            <span>Pos: {gameState.G.players['1'].position}</span>
          </div>
          <div className="relative h-4 bg-gray-700 rounded-full">
            <div 
              className="absolute top-0 left-0 h-4 bg-red-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(gameState.G.players['1'].position * 10, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => sendMove('move', 1)}
          disabled={!!winner || gameState.ctx.currentPlayer !== playerId}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg shadow-lg transform transition hover:scale-105"
        >
          Move Forward (+1)
        </button>
      </div>
      
      {gameState.ctx.currentPlayer !== playerId && !winner && (
          <p className="mt-4 text-gray-400 animate-pulse">Waiting for opponent...</p>
      )}
    </div>
  );
};
