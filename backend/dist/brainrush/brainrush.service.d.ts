import { Model, Types } from 'mongoose';
import { GameSession, GameSessionDocument } from './schemas/game-session.schema';
import { PlayerSessionDocument } from './schemas/player-session.schema';
import { QuestionInstanceDocument } from './schemas/question-instance.schema';
import { Score, ScoreDocument } from './schemas/score.schema';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { AiService } from './services/ai.service';
import { AdaptationService } from './services/adaptation.service';
import { ScoringService } from './services/scoring.service';
import { LeaderboardService } from './services/leaderboard.service';
export declare class BrainrushService {
    private gameSessionModel;
    private playerSessionModel;
    private questionModel;
    private scoreModel;
    private readonly aiService;
    private readonly adaptationService;
    private readonly scoringService;
    private readonly leaderboardService;
    constructor(gameSessionModel: Model<GameSessionDocument>, playerSessionModel: Model<PlayerSessionDocument>, questionModel: Model<QuestionInstanceDocument>, scoreModel: Model<ScoreDocument>, aiService: AiService, adaptationService: AdaptationService, scoringService: ScoringService, leaderboardService: LeaderboardService);
    createRoom(dto: CreateRoomDto, userId: string): Promise<GameSession & import("mongoose").Document<any, any, any> & {
        _id: Types.ObjectId;
    }>;
    joinRoom(dto: JoinRoomDto, userId: string): Promise<GameSession & import("mongoose").Document<any, any, any> & {
        _id: Types.ObjectId;
    }>;
    getNextQuestion(gameSessionId: string, userId: string): Promise<{
        questionId: any;
        questionText: string;
        options: string[];
    }>;
    submitAnswer(gameSessionId: string, userId: string, dto: SubmitAnswerDto): Promise<{
        isCorrect: boolean;
        correctAnswer: string;
        pointsEarned: number;
        newScore: number;
    }>;
    finishGame(gameSessionId: string, userId: string): Promise<Score & import("mongoose").Document<any, any, any> & {
        _id: Types.ObjectId;
    }>;
}
