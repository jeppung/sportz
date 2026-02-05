import { Server, WebSocketServer } from "ws";
import { WebSocket } from "ws";
import z from "zod";
import { createMatchSchema } from "../validation/matches";
import { Server as HttpServer } from "http";
import { wsArcjet } from "../arcjet";
import { Request } from "express";

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
      if (ws.readyState !== WebSocket.OPEN) {
        ws.terminate();
      } else if (ws.isAlive === false) {
        ws.terminate();
      } else {
        ws.isAlive = false;
        ws.ping();
      }
    });
  }, 30000);

  wss.on("connection", async (socket: WebSocketWithAlive, req: Request) => {
    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);
        if (decision.isDenied()) {
          const code = decision.reason.isRateLimit() ? 1013 : 1008;
          const reason = decision.reason.isRateLimit()
            ? "Rate limit exceeded"
            : "Access denied";
          socket.close(code, reason);
        }
      } catch (e) {
        console.error("WS connection error", e);
        socket.close(1011, "Server security error");
      }
    }

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
