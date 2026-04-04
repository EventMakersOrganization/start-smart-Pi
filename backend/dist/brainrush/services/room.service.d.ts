export interface RoomPlayer {
    socketId: string;
    username: string;
    avatar: string;
    userId?: string;
    isHost: boolean;
    joinedAt: Date;
    score: number;
    hasAnswered: boolean;
    lastAnswerCorrect?: boolean;
    lastResponseTime?: number;
}
export interface MultiplayerQuestion {
    id: string;
    text: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    timeLimit: number;
    points: number;
}
export interface MultiplayerGameState {
    status: 'countdown' | 'playing' | 'question_ended' | 'finished';
    questions: MultiplayerQuestion[];
    currentQuestionIndex: number;
    timeLeft: number;
}
export interface Room {
    roomCode: string;
    hostId: string;
    players: RoomPlayer[];
    status: 'waiting' | 'playing' | 'finished';
    createdAt: Date;
    gameState?: MultiplayerGameState;
}
export declare class RoomService {
    private rooms;
    private socketToRoom;
    private readonly logger;
    private generateCode;
    createRoom(socketId: string, username: string, avatar: string, userId?: string): Room;
    joinRoom(roomCode: string, socketId: string, username: string, avatar: string, userId?: string): {
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
