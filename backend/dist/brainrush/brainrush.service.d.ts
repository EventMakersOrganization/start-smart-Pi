import { Model } from 'mongoose';
import { GameSessionDocument } from './schemas/game-session.schema';
import { PlayerSessionDocument } from './schemas/player-session.schema';
import { QuestionInstance, QuestionInstanceDocument } from './schemas/question-instance.schema';
import { Score, ScoreDocument } from './schemas/score.schema';
import { AdaptationService } from './services/adaptation.service';
import { ScoringService } from './services/scoring.service';
import { AiService } from './services/ai.service';
import { LeaderboardService } from './services/leaderboard.service';
import { BrainrushGateway } from './brainrush.gateway';
import { CreateRoomDto } from './dto/create-room.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
export declare class BrainrushService {
    private gameSessionModel;
    private playerSessionModel;
    private questionModel;
    private scoreModel;
    private adaptationService;
    private scoringService;
    private aiService;
    private leaderboardService;
    private gateway;
    constructor(gameSessionModel: Model<GameSessionDocument>, playerSessionModel: Model<PlayerSessionDocument>, questionModel: Model<QuestionInstanceDocument>, scoreModel: Model<ScoreDocument>, adaptationService: AdaptationService, scoringService: ScoringService, aiService: AiService, leaderboardService: LeaderboardService, gateway: BrainrushGateway);
    startSoloGame(userId: string, initialDifficulty: 'easy' | 'medium' | 'hard'): Promise<{
        gameSessionId: any;
        playerSessionId: any;
        firstQuestion: import("mongoose").Document<unknown, {}, QuestionInstanceDocument> & QuestionInstance & import("mongoose").Document<any, any, any> & {
            _id: import("mongoose").Types.ObjectId;
        };
    }>;
    createRoom(userId: string, dto: CreateRoomDto): Promise<{
        gameSessionId: any;
        roomCode: string;
    }>;
    joinRoom(userId: string, roomCode: string): Promise<{
        gameSessionId: any;
    }>;
    submitAnswer(userId: string, dto: SubmitAnswerDto): Promise<{
        score: number;
        newQuestion: import("mongoose").Document<unknown, {}, QuestionInstanceDocument> & QuestionInstance & import("mongoose").Document<any, any, any> & {
            _id: import("mongoose").Types.ObjectId;
        };
        difficulty: "easy" | "medium" | "hard";
    }>;
    getLeaderboard(): Promise<Score[]>;
    private generateRoomCode;
}
