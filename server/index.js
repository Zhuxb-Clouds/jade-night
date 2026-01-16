import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 日志目录
const LOGS_DIR = path.join(__dirname, "game_logs");

// 确保日志目录存在
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// 游戏日志记录器
class GameLogger {
  constructor(roomId) {
    this.roomId = roomId;
    this.startTime = new Date();
    this.filename = `${this.formatDate(this.startTime)}_${roomId}.jsonl`;
    this.filepath = path.join(LOGS_DIR, this.filename);
    this.moveCount = 0;

    // 写入游戏开始事件
    this.log({
      event: "GAME_CREATED",
      roomId: roomId,
      timestamp: this.startTime.toISOString(),
    });
  }

  formatDate(date) {
    return date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  }

  log(data) {
    const entry = {
      seq: this.moveCount++,
      ts: Date.now(),
      ...data,
    };

    // 追加写入 (JSONL 格式 - 每行一个 JSON)
    fs.appendFileSync(this.filepath, JSON.stringify(entry) + "\n", "utf-8");
  }

  logPlayerJoin(playerId, playerCount) {
    this.log({
      event: "PLAYER_JOINED",
      playerId,
      playerCount,
    });
  }

  logPlayerLeave(playerId, playerCount) {
    this.log({
      event: "PLAYER_LEFT",
      playerId,
      playerCount,
    });
  }

  logMove(playerId, moveType, moveData) {
    this.log({
      event: "MOVE",
      playerId,
      moveType,
      moveData,
    });
  }

  logStateUpdate(state) {
    // 只记录关键状态信息，避免日志过大
    const summary = {
      event: "STATE_UPDATE",
      turn: state?.ctx?.turn,
      currentPlayer: state?.ctx?.currentPlayer,
      phase: state?.ctx?.phase,
      gameover: state?.ctx?.gameover ? true : false,
    };

    // 记录每个玩家的简要状态
    if (state?.G?.players) {
      summary.playerStates = {};
      for (const [pid, player] of Object.entries(state.G.players)) {
        summary.playerStates[pid] = {
          waitingCount: player.waitingArea?.length || 0,
          personalCount: player.personalArea?.length || 0,
          offeringCount: player.offeringArea?.length || 0,
          teaTokens: player.teaTokens || 0,
          ap: player.actionPoints || 0,
        };
      }
    }

    this.log(summary);
  }

  logGameEnd(gameover) {
    this.log({
      event: "GAME_END",
      duration: Date.now() - this.startTime.getTime(),
      result: gameover,
    });
  }

  logHostDisconnect() {
    this.log({
      event: "HOST_DISCONNECTED",
      duration: Date.now() - this.startTime.getTime(),
    });
  }
}

const app = express();
const port = 9000;

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Add CORS middleware for HTTP requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Store rooms and clients
const rooms = new Map(); // { roomId: { players: [ws, ...], gameState: ..., logger: GameLogger } }

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
            const logger = new GameLogger(roomId);
            rooms.set(roomId, { players: [ws], gameState: null, logger });
            logger.logPlayerJoin("0", 1);
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

              // 记录玩家加入
              room.logger.logPlayerJoin(playerId, room.players.length);

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
            const previousState = room.gameState;
            room.gameState = data.state;

            // 记录状态更新
            room.logger.logStateUpdate(data.state);

            // 检查游戏是否结束
            if (data.state?.ctx?.gameover && !previousState?.ctx?.gameover) {
              room.logger.logGameEnd(data.state.ctx.gameover);
            }

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

            // 记录玩家操作
            room.logger.logMove(data.playerId || ws.playerId, data.moveType, data.args);

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
        room.logger.logHostDisconnect();

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

        // 记录玩家离开
        room.logger.logPlayerLeave(ws.playerId, room.players.length);

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
  console.log(`Game logs directory: ${LOGS_DIR}`);
});
