import React, { useState } from 'react';
import { useP2P } from '../network/P2PContext';

export const Lobby: React.FC = () => {
  const { peerId, hostGame, joinGame, isConnected, error } = useP2P();
  const [hostIdInput, setHostIdInput] = useState('');

  if (isConnected) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-4xl font-bold mb-8 text-emerald-400">玉盏春夜宴</h1>
      
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded mb-4">
                {error}
            </div>
        )}

        <div className="mb-6">
          <p className="text-gray-400 mb-2">Your Peer ID:</p>
          <div className="bg-gray-900 p-3 rounded font-mono text-sm break-all border border-gray-700">
            {peerId || 'Initializing...'}
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={hostGame}
            disabled={!peerId}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Game (Host)
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-700"></div>
            <span className="flex-shrink mx-4 text-gray-500">OR</span>
            <div className="flex-grow border-t border-gray-700"></div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter Host ID"
              value={hostIdInput}
              onChange={(e) => setHostIdInput(e.target.value)}
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => joinGame(hostIdInput)}
              disabled={!peerId || !hostIdInput}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
