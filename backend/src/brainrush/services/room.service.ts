import { Injectable, Logger } from '@nestjs/common';

export interface RoomPlayer {
    socketId: string;
    username: string;
    userId?: string;
    isHost: boolean;
    joinedAt: Date;
}

export interface Room {
    roomCode: string;
    hostId: string;       // socketId of host
    players: RoomPlayer[];
    status: 'waiting' | 'playing';
    createdAt: Date;
}

@Injectable()
export class RoomService {
    private rooms = new Map<string, Room>();
    private socketToRoom = new Map<string, string>(); // socketId → roomCode
    private readonly logger = new Logger(RoomService.name);

    // ──────────────────────────────────────────
    // Generate a random 6-char uppercase code
    // ──────────────────────────────────────────
    private generateCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid ambiguous chars
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    // ──────────────────────────────────────────
    // Create Room
    // ──────────────────────────────────────────
    createRoom(socketId: string, username: string, userId?: string): Room {
        // Ensure unique code
        let roomCode: string;
        do {
            roomCode = this.generateCode();
        } while (this.rooms.has(roomCode));

        const host: RoomPlayer = {
            socketId,
            username,
            userId,
            isHost: true,
            joinedAt: new Date(),
        };

        const room: Room = {
            roomCode,
            hostId: socketId,
            players: [host],
            status: 'waiting',
            createdAt: new Date(),
        };

        this.rooms.set(roomCode, room);
        this.socketToRoom.set(socketId, roomCode);
        this.logger.log(`Room created: ${roomCode} by ${username} (${socketId})`);
        return room;
    }

    // ──────────────────────────────────────────
    // Join Room
    // ──────────────────────────────────────────
    joinRoom(
        roomCode: string,
        socketId: string,
        username: string,
        userId?: string,
    ): { room: Room; error?: string } {
        const room = this.rooms.get(roomCode);
        if (!room) return { room: null, error: 'Room not found' };
        if (room.status === 'playing') return { room: null, error: 'Game already started' };

        // Check if already in room (reconnection)
        const existing = room.players.find((p) => p.socketId === socketId);
        if (existing) return { room };

        const player: RoomPlayer = {
            socketId,
            username,
            userId,
            isHost: false,
            joinedAt: new Date(),
        };

        room.players.push(player);
        this.socketToRoom.set(socketId, roomCode);
        this.logger.log(`${username} joined room ${roomCode}`);
        return { room };
    }

    // ──────────────────────────────────────────
    // Get Room
    // ──────────────────────────────────────────
    getRoom(roomCode: string): Room | undefined {
        return this.rooms.get(roomCode);
    }

    getRoomBySocketId(socketId: string): Room | undefined {
        const code = this.socketToRoom.get(socketId);
        return code ? this.rooms.get(code) : undefined;
    }

    // ──────────────────────────────────────────
    // Start Game
    // ──────────────────────────────────────────
    startGame(roomCode: string, socketId: string): { room: Room; error?: string } {
        const room = this.rooms.get(roomCode);
        if (!room) return { room: null, error: 'Room not found' };
        if (room.hostId !== socketId) return { room: null, error: 'Only host can start the game' };
        if (room.players.length < 1) return { room: null, error: 'Not enough players' };

        room.status = 'playing';
        this.logger.log(`Game started in room ${roomCode}`);
        return { room };
    }

    // ──────────────────────────────────────────
    // Remove Player on Disconnect
    // ──────────────────────────────────────────
    removePlayer(socketId: string): { room?: Room; wasHost: boolean; roomCode?: string } {
        const roomCode = this.socketToRoom.get(socketId);
        if (!roomCode) return { wasHost: false };

        const room = this.rooms.get(roomCode);
        if (!room) {
            this.socketToRoom.delete(socketId);
            return { wasHost: false };
        }

        const wasHost = room.hostId === socketId;
        room.players = room.players.filter((p) => p.socketId !== socketId);
        this.socketToRoom.delete(socketId);

        // If room is empty, delete it
        if (room.players.length === 0) {
            this.rooms.delete(roomCode);
            this.logger.log(`Room ${roomCode} deleted (empty)`);
            return { wasHost, roomCode };
        }

        // Transfer host if needed
        if (wasHost && room.players.length > 0) {
            const newHost = room.players[0];
            newHost.isHost = true;
            room.hostId = newHost.socketId;
            this.logger.log(`Host transferred to ${newHost.username} in room ${roomCode}`);
        }

        return { room, wasHost, roomCode };
    }

    // ──────────────────────────────────────────
    // Validate Room
    // ──────────────────────────────────────────
    validateRoom(roomCode: string): { valid: boolean; error?: string } {
        const room = this.rooms.get(roomCode);
        if (!room) return { valid: false, error: 'Room not found' };
        if (room.status === 'playing') return { valid: false, error: 'Game already in progress' };
        return { valid: true };
    }
}
