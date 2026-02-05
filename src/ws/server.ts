import { Server, WebSocketServer } from "ws";
import { WebSocket } from "ws";
import z from "zod";
import { createMatchSchema } from "../validation/matches";
import { Server as HttpServer } from "http";

interface JsonPayload {
  [key: string]: unknown;
}

function sendJson(socket: WebSocket, payload: JsonPayload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcast(wss: Server, payload: JsonPayload) {
  for (const client of wss.clients) {
    sendJson(client, payload);
  }
}

export function attachWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  wss.on("connection", (socket) => {
    sendJson(socket, { type: "welcome" });
    socket.on("error", console.error);
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
