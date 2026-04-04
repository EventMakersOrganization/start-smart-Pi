export interface RoomPlayer {
    socketId: string;
    username: string;
    userId?: string;
    isHost: boolean;
    joinedAt: Date;
}
export interface Room {
    roomCode: string;
    hostId: string;
    players: RoomPlayer[];
    status: 'waiting' | 'playing';
    createdAt: Date;
}
export declare class RoomService {
    private rooms;
    private socketToRoom;
    private readonly logger;
    private generateCode;
    createRoom(socketId: string, username: string, userId?: string): Room;
    joinRoom(roomCode: string, socketId: string, username: string, userId?: string): {
        room: Room;
        error?: string;
    };
    getRoom(roomCode: string): Room | undefined;
    getRoomBySocketId(socketId: string): Room | undefined;
    startGame(roomCode: string, socketId: string): {
        room: Room;
        error?: string;
    };
    removePlayer(socketId: string): {
        room?: Room;
        wasHost: boolean;
        roomCode?: string;
    };
    validateRoom(roomCode: string): {
        valid: boolean;
        error?: string;
    };
}
