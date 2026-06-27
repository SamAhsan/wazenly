import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") }); // root fallback
import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { Server as SocketServer } from "socket.io";

import { authRouter } from "./routes/auth";
import { numbersRouter } from "./routes/numbers";
import { campaignsRouter } from "./routes/campaigns";
import { templatesRouter } from "./routes/templates";
import { contactsRouter } from "./routes/contacts";
import { messagesRouter } from "./routes/messages";
import { conversationsRouter } from "./routes/conversations";
import { webhooksRouter } from "./routes/webhooks";
import { analyticsRouter } from "./routes/analytics";
import { flowsRouter } from "./routes/flows";
import { settingsRouter } from "./routes/settings";
import { apiV1Router } from "./routes/api-v1";
import { docsRouter } from "./routes/docs";

import { errorHandler } from "./middleware/error-handler";
import { setupSocketHandlers } from "./socket/handlers";

const app = express();
const httpServer = http.createServer(app);

const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

export const io = new SocketServer(httpServer, {
  cors: { origin: CORS_ORIGIN, credentials: true },
});

// ─── Middleware ───────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/numbers", numbersRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/flows", flowsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/v1", apiV1Router);
app.use("/api/docs", docsRouter);

app.get("/api/health", (_, res) => res.json({ status: "ok", version: "1.0.0" }));

// ─── Socket.io ────────────────────────────────────────────
setupSocketHandlers(io);

// ─── Error handler ────────────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`✅ WAZENLY API running on http://localhost:${PORT}`);
  console.log(`📖 API Docs: http://localhost:${PORT}/api/docs`);
});

export { app };
