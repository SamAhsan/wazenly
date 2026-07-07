import { Server as SocketServer } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "@wazenly/db";

export function setupSocketHandlers(io: SocketServer): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) return next(new Error("Authentication required"));

    try {
      const payload = jwt.verify(token, process.env.NEXTAUTH_SECRET || "secret") as {
        sub: string;
        workspaceId?: string;
      };
      socket.data.userId = payload.sub;
      socket.data.workspaceId = payload.workspaceId;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const { workspaceId, userId } = socket.data as { workspaceId: string; userId: string };

    // Join workspace room
    if (workspaceId) {
      socket.join(`workspace:${workspaceId}`);
      socket.join(`user:${userId}`);
    }

    socket.on("conversation:join", async (conversationId: string) => {
      // Without this check, any authenticated socket could join any conversation room
      // by id and receive another company's typing indicators.
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, workspaceId },
        select: { id: true },
      });
      if (conversation) socket.join(`conversation:${conversationId}`);
    });

    socket.on("conversation:leave", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on("typing:start", (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit("typing:start", { userId });
    });

    socket.on("typing:stop", (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit("typing:stop", { userId });
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] User ${userId} disconnected`);
    });

    console.log(`[Socket] User ${userId} connected to workspace ${workspaceId}`);
  });
}
