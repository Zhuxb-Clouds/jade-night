import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { Client } from "boardgame.io/client";
import { JadeNightGame, JadeNightState } from "../game/config";
import { State } from "boardgame.io";

interface P2PContextType {
  roomId: string | null;
  isConnected: boolean;
  isHost: boolean;
  gameState: State<JadeNightState> | null;
  hostGame: () => void;
  joinGame: (roomId: string) => void;
  sendMove: (moveName: string, ...args: any[]) => void;
  playerId: string | null;
  error: string | null;
  availableRooms: Array<{ roomId: string; playerCount: number; maxPlayers: number }>;
  refreshRooms: () => void;
  connectedPlayerCount: number;
}

const P2PContext = createContext<P2PContextType | null>(null);

export const useP2P = () => {
  const context = useContext(P2PContext);
  if (!context) {
    throw new Error("useP2P must be used within a P2PProvider");
  }
  return context;
};

export const P2PProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState<State<JadeNightState> | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableRooms, setAvailableRooms] = useState<
    Array<{ roomId: string; playerCount: number; maxPlayers: number }>
  >([]);
  const [connectedPlayerCount, setConnectedPlayerCount] = useState(1);

  const wsRef = useRef<WebSocket | null>(null);
  const gameClientRef = useRef<any>(null);

  const getWSUrl = () => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${hostname}:9000`;
  };

  // Initialize WebSocket connection
  const initWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket(getWSUrl());

    ws.onopen = () => {
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "HOSTED":
            setConnectedPlayerCount(1);
            setRoomId(data.roomId);
            break;
          case "JOINED":
            setRoomId(data.roomId);
            if (data.playerId) {
              setPlayerId(data.playerId);
            }
            if (typeof data.playerCount === "number") {
              setConnectedPlayerCount(data.playerCount);
            }
            setIsConnected(true);
            break;
          case "STATE":
            setGameState(data.state);
            break;
          case "MOVE":
            // Host processes moves
            // Check if this client is host by checking if gameClientRef is initialized
            if (gameClientRef.current) {
              const movePlayerId = data.playerId || "1"; // Default to 1 if not sent (compat)
              gameClientRef.current.updatePlayerID(movePlayerId);
              if (gameClientRef.current.moves[data.moveName]) {
                gameClientRef.current.moves[data.moveName](...data.args);
              }
              gameClientRef.current.updatePlayerID("0"); // Restore host ID? Actually host is usually 0.
            }
            break;
          case "PLAYER_JOINED":
            setConnectedPlayerCount(data.playerCount);
            setIsConnected(true);
            break;
          case "PLAYER_LEFT":
            setConnectedPlayerCount(data.playerCount);
            break;
          case "HOST_DISCONNECTED":
            setError("Host disconnected");
            setIsConnected(false);
            setGameState(null);
            break;
          case "ERROR":
            setError(data.message);
            break;
        }
      } catch (err) {
        console.error("Error processing message:", err);
      }
    };

    ws.onerror = () => {
      setError("WebSocket error");
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    wsRef.current = ws;
  }, []);

  const refreshRooms = useCallback(async () => {
    try {
      const hostname = window.location.hostname;
      const apiUrl = `http://${hostname}:9000/api/rooms`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error("Failed to fetch rooms");
      const rooms = await response.json();
      setAvailableRooms(rooms);
    } catch (err) {
      console.error("Error fetching rooms:", err);
    }
  }, []);

  const hostGame = () => {
    initWebSocket();

    const newRoomId = "JadeRoom-" + Math.floor(1000 + Math.random() * 9000);
    setIsHost(true);
    setPlayerId("0");

    // Wait for WebSocket to be ready
    const checkConnection = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        clearInterval(checkConnection);

        // Send host game message
        wsRef.current?.send(
          JSON.stringify({
            type: "HOST_GAME",
            roomId: newRoomId,
          })
        );

        // Initialize Boardgame.io Client (Master) with max players
        const client = Client({ game: JadeNightGame, numPlayers: 5 });
        client.start();
        gameClientRef.current = client;

        // Subscribe to state changes and broadcast to guests
        client.subscribe((state) => {
          setGameState(state);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "STATE",
                state,
              })
            );
          }
        });
      }
    }, 100);

    setTimeout(() => clearInterval(checkConnection), 5000);
  };

  const joinGame = (roomIdToJoin: string) => {
    initWebSocket();

    setIsHost(false);
    // playerId will be set when JOINED message is received

    const checkConnection = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        clearInterval(checkConnection);

        wsRef.current?.send(
          JSON.stringify({
            type: "JOIN_GAME",
            roomId: roomIdToJoin,
          })
        );
      }
    }, 100);

    setTimeout(() => clearInterval(checkConnection), 5000);
  };

  const sendMove = (moveName: string, ...args: any[]) => {
    if (isHost) {
      // Execute locally
      if (gameClientRef.current) {
        gameClientRef.current.moves[moveName](...args);
      }
    } else {
      // Send to host via WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "MOVE",
            moveName,
            args,
          })
        );
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (gameClientRef.current) {
        gameClientRef.current.stop();
      }
    };
  }, []);

  return (
    <P2PContext.Provider
      value={{
        roomId,
        isConnected,
        isHost,
        gameState,
        hostGame,
        joinGame,
        sendMove,
        playerId,
        error,
        availableRooms,
        refreshRooms,
        connectedPlayerCount,
      }}
    >
      {children}
    </P2PContext.Provider>
  );
};
