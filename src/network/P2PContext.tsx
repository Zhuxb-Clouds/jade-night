import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { Client } from 'boardgame.io/client';
import { JadeNightGame, JadeNightState } from '../game/config';
import { State } from 'boardgame.io';

interface P2PContextType {
  peerId: string | null;
  isConnected: boolean;
  isHost: boolean;
  gameState: State<JadeNightState> | null;
  hostGame: () => void;
  joinGame: (hostId: string) => void;
  sendMove: (moveName: string, ...args: any[]) => void;
  playerId: string | null;
  error: string | null;
}

const P2PContext = createContext<P2PContextType | null>(null);

export const useP2P = () => {
  const context = useContext(P2PContext);
  if (!context) {
    throw new Error('useP2P must be used within a P2PProvider');
  }
  return context;
};

export const P2PProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [peerId, setPeerId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState<State<JadeNightState> | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const gameClientRef = useRef<any>(null);

  // Initialize PeerJS
  const initPeer = () => {
    const peer = new Peer();
    
    peer.on('open', (id) => {
      setPeerId(id);
      console.log('My peer ID is: ' + id);
    });

    peer.on('error', (err) => {
      console.error(err);
      setError(err.message);
    });

    peerRef.current = peer;
    return peer;
  };

  const hostGame = () => {
    const peer = initPeer();
    setIsHost(true);
    setPlayerId('0');

    // Initialize Boardgame.io Client (Master)
    const client = Client({ game: JadeNightGame });
    client.start();
    gameClientRef.current = client;

    // Subscribe to state changes and broadcast to guest
    client.subscribe((state: State<JadeNightState>) => {
      setGameState(state);
      if (connRef.current && connRef.current.open) {
        connRef.current.send({ type: 'STATE', state });
      }
    });

    // Listen for incoming connections
    peer.on('connection', (conn) => {
      console.log('Guest connected');
      connRef.current = conn;
      setIsConnected(true);

      conn.on('open', () => {
        // Send initial state
        const state = client.getState();
        conn.send({ type: 'STATE', state });
      });

      conn.on('data', (data: any) => {
        if (data.type === 'MOVE') {
          console.log('Received move from guest:', data);
          // Execute move on behalf of player 1
          // We temporarily switch playerID to '1' to execute the move
          // Note: This requires the game logic to not strictly validate credentials 
          // or we need a more complex setup. For prototype, this is fine.
          // However, Client.moves usually uses the configured playerID.
          // We can manually dispatch the action.
          
          // A hacky but effective way for local master:
          client.updatePlayerID('1');
          if (client.moves[data.moveName]) {
             client.moves[data.moveName](...data.args);
          }
          client.updatePlayerID('0');
        }
      });
      
      conn.on('close', () => {
          setIsConnected(false);
          connRef.current = null;
      });
    });
  };

  const joinGame = (hostId: string) => {
    const peer = initPeer();
    setIsHost(false);
    setPlayerId('1');

    peer.on('open', () => {
        const conn = peer.connect(hostId);
        connRef.current = conn;

        conn.on('open', () => {
            setIsConnected(true);
            console.log('Connected to host');
        });

        conn.on('data', (data: any) => {
            if (data.type === 'STATE') {
                setGameState(data.state);
            }
        });
        
        conn.on('close', () => {
            setIsConnected(false);
            connRef.current = null;
        });
        
        conn.on('error', (err) => {
            console.error("Connection error:", err);
            setError(err.message);
        });
    });
  };

  const sendMove = (moveName: string, ...args: any[]) => {
    if (isHost) {
      // Execute locally
      if (gameClientRef.current) {
        gameClientRef.current.moves[moveName](...args);
      }
    } else {
      // Send to host
      if (connRef.current && connRef.current.open) {
        connRef.current.send({ type: 'MOVE', moveName, args });
      }
    }
  };

  return (
    <P2PContext.Provider value={{ 
      peerId, 
      isConnected, 
      isHost, 
      gameState, 
      hostGame, 
      joinGame, 
      sendMove,
      playerId,
      error
    }}>
      {children}
    </P2PContext.Provider>
  );
};
