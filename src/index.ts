import express from "express";
import { matchRouter } from "./routes/matches";
import { attachWebSocketServer } from "./ws/server";
import http from "http";

const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "127.0.0.1";

const app = express();
const server = http.createServer(app);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Sportz API" });
});

app.use("/matches", matchRouter);

const { broadcastMatchCreated } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

server.listen(PORT, HOST, () => {
  const baseUrl = `http://${HOST}:${PORT}`;
  console.log(`Server is running on ${baseUrl}`);
  console.log(
    `WebSocket server is running on ${baseUrl.replace("http", "ws")}/ws`,
  );
});
