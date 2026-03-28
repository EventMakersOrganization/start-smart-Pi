import { BrainrushService } from './brainrush.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { LeaderboardService } from './services/leaderboard.service';
export declare class BrainrushController {
    private readonly brainrushService;
    private readonly leaderboardService;
    constructor(brainrushService: BrainrushService, leaderboardService: LeaderboardService);
    createRoom(dto: CreateRoomDto, req: any): Promise<import("./schemas/game-session.schema").GameSession & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    joinRoom(dto: JoinRoomDto, req: any): Promise<import("./schemas/game-session.schema").GameSession & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    getNextQuestion(sessionId: string, req: any): Promise<{
        questionId: any;
        questionText: string;
        options: string[];
    }>;
    submitAnswer(sessionId: string, dto: SubmitAnswerDto, req: any): Promise<{
        isCorrect: boolean;
        correctAnswer: string;
        pointsEarned: number;
        newScore: number;
    }>;
    finishGame(sessionId: string, req: any): Promise<import("./schemas/score.schema").Score & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    getLeaderboard(sessionId: string): Promise<Omit<import("./schemas/score.schema").Score & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }, never>[]>;
}
