import { Server, WebSocketServer } from "ws";
import { WebSocket } from "ws";
import z from "zod";
import { createMatchSchema } from "../validation/matches";
import { Server as HttpServer } from "http";

interface JsonPayload {
  [key: string]: unknown;
}

interface WebSocketWithAlive extends WebSocket {
  isAlive: boolean;
}

function sendJson(socket: WebSocket, payload: JsonPayload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcast(wss: Server, payload: JsonPayload) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(JSON.stringify(payload));
  }
}

export function attachWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  const interval = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as WebSocketWithAlive;
      if (ws.isAlive === false) {
        ws.terminate();
      } else {
        ws.isAlive = false;
        ws.ping();
      }
    });
  }, 30000);

  wss.on("connection", (socket: WebSocketWithAlive) => {
    socket.isAlive = true;
    sendJson(socket, { type: "welcome" });

    socket.on("pong", () => (socket.isAlive = true));
    socket.on("error", console.error);
  });

  wss.on("close", () => {
    clearInterval(interval);
  });

  function broadcastMatchCreated(match: z.infer<typeof createMatchSchema>) {
    broadcast(wss, {
      type: "match_created",
      data: match,
    });
  }

  return {
    broadcastMatchCreated,
  };
}
