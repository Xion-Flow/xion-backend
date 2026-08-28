import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

const prisma = new PrismaClient();

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

class SocketService {
  private io: Server | null = null;

  public init(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
        credentials: true,
      },
    });

    // JWT Auth Middleware for WebSockets
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
        if (!token) {
          return next(new Error('Authentication error: Token missing'));
        }

        const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string };
        const user = await prisma.user.findUnique({
          where: { id: decoded.sub },
          select: { id: true, email: true, name: true, role: true, isActive: true },
        });

        if (!user || !user.isActive) {
          return next(new Error('Authentication error: User invalid or inactive'));
        }

        socket.user = user;
        next();
      } catch (err) {
        next(new Error('Authentication error: Invalid token'));
      }
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`🔌 WebSocket Client connected: ${socket.id} (${socket.user?.name})`);

      // Client joins project room
      socket.on('join:project', async (data: { projectId: string }) => {
        if (!data || !data.projectId) return;

        // Check project membership (Admins bypass)
        if (socket.user?.role !== 'ADMIN') {
          const member = await prisma.projectMember.findUnique({
            where: {
              projectId_userId: { projectId: data.projectId, userId: socket.user!.id },
            },
          });
          if (!member) {
            socket.emit('error', { message: 'Cannot join project room: Not a project member' });
            return;
          }
        }

        const roomName = `room:project_${data.projectId}`;
        socket.join(roomName);
        console.log(`👤 User ${socket.user?.name} joined room: ${roomName}`);
      });

      // Client leaves project room
      socket.on('leave:project', (data: { projectId: string }) => {
        if (data && data.projectId) {
          const roomName = `room:project_${data.projectId}`;
          socket.leave(roomName);
          console.log(`👤 User ${socket.user?.name} left room: ${roomName}`);
        }
      });

      socket.on('disconnect', () => {
        console.log(`🔌 WebSocket Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Broadcast deliverable status or metadata change to all clients in project room.
   */
  public broadcastDeliverableUpdate(projectId: string, deliverable: any, updatedBy: any) {
    if (!this.io) return;
    const roomName = `room:project_${projectId}`;
    this.io.to(roomName).emit('deliverable:updated', {
      projectId,
      deliverable,
      updatedBy,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast updated overall project and phase progress metrics.
   */
  public broadcastProjectProgress(projectId: string, progressSummary: any) {
    if (!this.io) return;
    const roomName = `room:project_${projectId}`;
    this.io.to(roomName).emit('project:progress_updated', {
      projectId,
      progressSummary,
      timestamp: new Date().toISOString(),
    });
  }

  public getIO(): Server {
    if (!this.io) {
      throw new Error('Socket.io server has not been initialized.');
    }
    return this.io;
  }
}

export const socketService = new SocketService();
