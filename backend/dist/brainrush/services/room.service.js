"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var RoomService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomService = void 0;
const common_1 = require("@nestjs/common");
let RoomService = RoomService_1 = class RoomService {
    constructor() {
        this.rooms = new Map();
        this.socketToRoom = new Map();
        this.logger = new common_1.Logger(RoomService_1.name);
    }
    generateCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }
    createRoom(socketId, username, avatar, userId) {
        let roomCode;
        do {
            roomCode = this.generateCode();
        } while (this.rooms.has(roomCode));
        const host = {
            socketId,
            username,
            avatar,
            userId,
            isHost: true,
            joinedAt: new Date(),
            score: 0,
            hasAnswered: false,
        };
        const room = {
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
    joinRoom(roomCode, socketId, username, avatar, userId) {
        const room = this.rooms.get(roomCode);
        if (!room)
            return { room: null, error: 'Room not found' };
        if (room.status === 'playing')
            return { room: null, error: 'Game already started' };
        const existing = room.players.find((p) => p.socketId === socketId);
        if (existing)
            return { room };
        const player = {
            socketId,
            username,
            avatar,
            userId,
            isHost: false,
            joinedAt: new Date(),
            score: 0,
            hasAnswered: false,
        };
        room.players.push(player);
        this.socketToRoom.set(socketId, roomCode);
        this.logger.log(`${username} joined room ${roomCode}`);
        return { room };
    }
    getRoom(roomCode) {
        return this.rooms.get(roomCode);
    }
    getRoomBySocketId(socketId) {
        const code = this.socketToRoom.get(socketId);
        return code ? this.rooms.get(code) : undefined;
    }
    startGame(roomCode, socketId) {
        const room = this.rooms.get(roomCode);
        if (!room)
            return { room: null, error: 'Room not found' };
        if (room.hostId !== socketId)
            return { room: null, error: 'Only host can start the game' };
        if (room.players.length < 1)
            return { room: null, error: 'Not enough players' };
        room.status = 'playing';
        this.logger.log(`Game started in room ${roomCode}`);
        return { room };
    }
    removePlayer(socketId) {
        const roomCode = this.socketToRoom.get(socketId);
        if (!roomCode)
            return { wasHost: false };
        const room = this.rooms.get(roomCode);
        if (!room) {
            this.socketToRoom.delete(socketId);
            return { wasHost: false };
        }
        const wasHost = room.hostId === socketId;
        room.players = room.players.filter((p) => p.socketId !== socketId);
        this.socketToRoom.delete(socketId);
        if (room.players.length === 0) {
            this.rooms.delete(roomCode);
            this.logger.log(`Room ${roomCode} deleted (empty)`);
            return { wasHost, roomCode };
        }
        if (wasHost && room.players.length > 0) {
            const newHost = room.players[0];
            newHost.isHost = true;
            room.hostId = newHost.socketId;
            this.logger.log(`Host transferred to ${newHost.username} in room ${roomCode}`);
        }
        return { room, wasHost, roomCode };
    }
    validateRoom(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room)
            return { valid: false, error: 'Room not found' };
        if (room.status === 'playing')
            return { valid: false, error: 'Game already in progress' };
        return { valid: true };
    }
};
exports.RoomService = RoomService;
exports.RoomService = RoomService = RoomService_1 = __decorate([
    (0, common_1.Injectable)()
], RoomService);
//# sourceMappingURL=room.service.js.map