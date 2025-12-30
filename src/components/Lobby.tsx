import React, { useState, useEffect } from 'react';
import { useP2P } from '../network/P2PContext';

export const Lobby: React.FC = () => {
  const { peerId, hostGame, joinGame, isConnected, isHost, error, availableRooms, refreshRooms } = useP2P();
  const [hostIdInput, setHostIdInput] = useState('');

  useEffect(() => {
    refreshRooms();
    const interval = setInterval(refreshRooms, 3000);
    return () => clearInterval(interval);
  }, [refreshRooms]);

  if (isConnected) {
    return null;
  }

  // Waiting screen for Host
  if (isHost && peerId) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center max-w-md w-full">
                <h2 className="text-2xl font-bold text-emerald-400 mb-4">Waiting for Players...</h2>
                <div className="bg-gray-900 p-4 rounded border border-gray-700 mb-6">
                    <p className="text-gray-400 text-sm mb-1">Room ID</p>
                    <p className="font-mono text-xl font-bold text-white select-all">{peerId}</p>
                </div>
                <div className="flex items-center justify-center space-x-2 text-emerald-500 text-sm animate-pulse">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span>Listening for connections...</span>
                </div>
                <p className="text-gray-500 text-xs mt-6">
                    Share the Room ID or wait for players to join from the lobby.
                </p>
            </div>
        </div>
    );
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

        {/* Room List Section */}
        <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-semibold text-gray-200">Available Rooms</h2>
                <button onClick={refreshRooms} className="text-sm text-emerald-400 hover:text-emerald-300">Refresh</button>
            </div>
            <div className="bg-gray-900 rounded border border-gray-700 max-h-48 overflow-y-auto">
                {availableRooms.length === 0 ? (
                    <div className="p-4 text-gray-500 text-center text-sm">
                        No rooms found. Start a server or create one!
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-800">
                        {availableRooms.map(room => (
                            <li key={room}>
                                <button 
                                    onClick={() => joinGame(room)}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-800 transition flex justify-between items-center group"
                                >
                                    <span className="font-mono text-emerald-300">{room}</span>
                                    <span className="text-xs bg-emerald-900 text-emerald-200 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition">Join</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={hostGame}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded transition"
          >
            Create New Room
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-700"></div>
            <span className="flex-shrink mx-4 text-gray-500">OR Join by ID</span>
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
              disabled={!hostIdInput}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join
            </button>
          </div>
        </div>
        
        <div className="mt-6 text-xs text-gray-500 text-center">
            <p>Ensure PeerServer is running locally on port 9000 for discovery.</p>
            <p className="font-mono mt-1">npm run server</p>
            {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                <p className="text-yellow-500 mt-2">
                    ⚠️ Tip: For LAN play, please access via your IP address (e.g., 192.168.x.x) instead of localhost.
                </p>
            )}
        </div>
      </div>
    </div>
  );
};
