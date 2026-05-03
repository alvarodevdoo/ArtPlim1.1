import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  organizationId?: string;
  userRole?: string;
}

export class WebSocketServer {
  private io: SocketIOServer;
  private organizationRooms: Map<string, Set<string>> = new Map();
  private userSockets: Map<string, string> = new Map(); // userId -> socketId
  private prisma: PrismaClient;

  constructor(httpServer: HttpServer, prisma: PrismaClient) {
    this.prisma = prisma;
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: [
          'http://localhost:3000',
          'http://localhost:3001',
          process.env.FRONTEND_URL || 'http://localhost:3000',
          'https://erp.artplim.com.br'
        ],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    console.log('🔌 WebSocket Server initialized');
  }

  private setupEventHandlers() {
    this.io.use(this.authenticateSocket.bind(this));

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`✅ User ${socket.userId} connected from org ${socket.organizationId}`);
      
      // Adicionar à sala da organização
      if (socket.organizationId) {
        this.joinOrganizationRoom(socket, socket.organizationId);
      }

      // Mapear usuário para socket
      if (socket.userId) {
        this.userSockets.set(socket.userId, socket.id);
      }

      // Event handlers
      socket.on('join-organization', (orgId: string) => {
        if (socket.organizationId === orgId) {
          this.joinOrganizationRoom(socket, orgId);
        }
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
  }

  private async authenticateSocket(socket: any, next: any) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      // Buscar dados do usuário
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { organization: true }
      });

      if (!user || !user.active) {
        return next(new Error('User not found or inactive'));
      }

      socket.userId = user.id;
      socket.organizationId = user.organizationId;
      socket.userRole = user.role;

      next();
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  }

  private joinOrganizationRoom(socket: AuthenticatedSocket, orgId: string) {
    const roomName = `org-${orgId}`;
    socket.join(roomName);

    // Manter registro das salas
    if (!this.organizationRooms.has(orgId)) {
      this.organizationRooms.set(orgId, new Set());
    }
    this.organizationRooms.get(orgId)!.add(socket.id);

    console.log(`👥 User ${socket.userId} joined organization room: ${roomName}`);
  }

  private handleDisconnect(socket: AuthenticatedSocket) {
    console.log(`❌ User ${socket.userId} disconnected`);

    // Remover das salas da organização
    if (socket.organizationId) {
      const orgSockets = this.organizationRooms.get(socket.organizationId);
      if (orgSockets) {
        orgSockets.delete(socket.id);
        if (orgSockets.size === 0) {
          this.organizationRooms.delete(socket.organizationId);
        }
      }
    }

    // Remover do mapeamento de usuários
    if (socket.userId) {
      this.userSockets.delete(socket.userId);
    }
  }

  // Métodos públicos para envio de notificações

  /**
   * Notifica todos os usuários de uma organização
   */
  public notifyOrganization(orgId: string, event: string, data: any) {
    const roomName = `org-${orgId}`;
    this.io.to(roomName).emit(event, data);
    console.log(`📢 Notification sent to organization ${orgId}: ${event}`);
  }

  /**
   * Notifica usuários específicos com determinado role
   */
  public notifyByRole(orgId: string, roles: string[], event: string, data: any) {
    const roomName = `org-${orgId}`;
    const sockets = this.io.sockets.adapter.rooms.get(roomName);
    
    if (sockets) {
      sockets.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId) as AuthenticatedSocket;
        if (socket && roles.includes(socket.userRole || '')) {
          socket.emit(event, data);
        }
      });
    }
    
    console.log(`📢 Notification sent to roles ${roles.join(', ')} in org ${orgId}: ${event}`);
  }

  /**
   * Notifica um usuário específico
   */
  public notifyUser(userId: string, event: string, data: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(event, data);
        console.log(`📢 Notification sent to user ${userId}: ${event}`);
        return true;
      }
    }
    console.log(`⚠️ User ${userId} not connected for notification: ${event}`);
    return false;
  }

  /**
   * Obtém estatísticas de conexões
   */
  public getStats() {
    return {
      totalConnections: this.io.sockets.sockets.size,
      organizationRooms: Array.from(this.organizationRooms.entries()).map(([orgId, sockets]) => ({
        organizationId: orgId,
        connections: sockets.size
      })),
      connectedUsers: this.userSockets.size
    };
  }

  /**
   * Verifica se um usuário está conectado
   */
  public isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  /**
   * Obtém todos os usuários conectados de uma organização
   */
  public getOrganizationConnectedUsers(orgId: string): string[] {
    const roomName = `org-${orgId}`;
    const sockets = this.io.sockets.adapter.rooms.get(roomName);
    const connectedUsers: string[] = [];
    
    if (sockets) {
      sockets.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId) as AuthenticatedSocket;
        if (socket && socket.userId) {
          connectedUsers.push(socket.userId);
        }
      });
    }
    
    return connectedUsers;
  }

  /**
   * Força desconexão de um usuário
   */
  public disconnectUser(userId: string, reason?: string) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
        console.log(`🔌 User ${userId} forcefully disconnected: ${reason || 'No reason provided'}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Envia mensagem de broadcast para toda a aplicação (usar com cuidado)
   */
  public broadcast(event: string, data: any) {
    this.io.emit(event, data);
    console.log(`📡 Broadcast sent: ${event}`);
  }

  /**
   * Fecha o servidor WebSocket
   */
  public close() {
    this.io.close();
    this.organizationRooms.clear();
    this.userSockets.clear();
    console.log('🔌 WebSocket Server closed');
  }
}

export default WebSocketServer;