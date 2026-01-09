import express from "express";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();
const port = 9000;

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Add CORS middleware for HTTP requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Store rooms and clients
const rooms = new Map(); // { roomId: { players: [ws, ...], gameState: ... } }

const MAX_PLAYERS = 5;

app.get("/api/rooms", (req, res) => {
  const availableRooms = Array.from(rooms.entries())
    .filter(([_, room]) => room.players.length < MAX_PLAYERS) // Room has space
    .map(([roomId, room]) => ({
      roomId,
      playerCount: room.players.length,
      maxPlayers: MAX_PLAYERS,
    }));
  res.json(availableRooms);
});

wss.on("connection", (ws) => {
  console.log("Client connected");
  let clientRoom = null;

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Received:", data.type);

      switch (data.type) {
        case "HOST_GAME": {
          const roomId = data.roomId;
          if (!rooms.has(roomId)) {
            ws.playerId = "0";
            rooms.set(roomId, { players: [ws], gameState: null });
          }
          clientRoom = roomId;
          console.log(`Player 0 created room: ${roomId}`);
          ws.send(JSON.stringify({ type: "HOSTED", roomId }));
          break;
        }

        case "JOIN_GAME": {
          const roomId = data.roomId;
          if (rooms.has(roomId)) {
            const room = rooms.get(roomId);
            if (room.players.length < MAX_PLAYERS) {
              const playerId = String(room.players.length); // 0, 1, 2, 3, 4...
              ws.playerId = playerId;
              room.players.push(ws);
              clientRoom = roomId;

              // Notify all existing players in room
              const broadcastData = JSON.stringify({
                type: "PLAYER_JOINED",
                playerCount: room.players.length,
                playerId: playerId,
              });

              room.players.forEach((player) => {
                if (player !== ws && player.readyState === 1) {
                  player.send(broadcastData);
                }
              });

              // Send current state to new player
              if (room.gameState) {
                ws.send(
                  JSON.stringify({
                    type: "STATE",
                    state: room.gameState,
                  })
                );
              }

              ws.send(
                JSON.stringify({
                  type: "JOINED",
                  roomId,
                  playerId,
                  playerCount: room.players.length,
                })
              );
              console.log(`Player ${playerId} joined room: ${roomId}`);
            } else {
              ws.send(JSON.stringify({ type: "ERROR", message: "Room is full" }));
            }
          } else {
            ws.send(JSON.stringify({ type: "ERROR", message: "Room not found" }));
          }
          break;
        }

        case "STATE": {
          if (clientRoom && rooms.has(clientRoom)) {
            const room = rooms.get(clientRoom);
            room.gameState = data.state;

            // Broadcast state to all players in room
            room.players.forEach((player) => {
              if (player !== ws && player.readyState === 1) {
                player.send(JSON.stringify({ type: "STATE", state: data.state }));
              }
            });
          }
          break;
        }

        case "MOVE": {
          if (clientRoom && rooms.has(clientRoom)) {
            const room = rooms.get(clientRoom);
            const host = room.players[0]; // Player 0 is the host

            // Non-host players send move to host; host broadcasts to others
            if (ws.playerId !== "0" && host && host.readyState === 1) {
              // Attach playerId so host knows who sent it
              host.send(JSON.stringify({ ...data, playerId: ws.playerId }));
            } else if (ws.playerId === "0") {
              room.players.forEach((player) => {
                if (player !== ws && player.readyState === 1) {
                  player.send(JSON.stringify(data));
                }
              });
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");

    // Clean up room if necessary
    if (clientRoom && rooms.has(clientRoom)) {
      const room = rooms.get(clientRoom);

      if (ws.playerId === "0") {
        // Host (player 0) disconnected, close room
        room.players.forEach((player) => {
          if (player !== ws && player.readyState === 1) {
            player.send(JSON.stringify({ type: "HOST_DISCONNECTED" }));
            player.close();
          }
        });
        rooms.delete(clientRoom);
        console.log(`Room deleted: ${clientRoom}`);
      } else {
        // Other player disconnected
        room.players = room.players.filter((p) => p !== ws);
        const broadcastData = JSON.stringify({
          type: "PLAYER_LEFT",
          playerCount: room.players.length,
        });

        room.players.forEach((player) => {
          if (player.readyState === 1) {
            player.send(broadcastData);
          }
        });
      }
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
});

server.listen(port, () => {
  console.log(`WebSocket server running on ws://localhost:${port}`);
  console.log(`API endpoint: http://localhost:${port}/api/rooms`);
});
