import { Model, Types } from 'mongoose';
import { GameSession, GameSessionDocument } from './schemas/game-session.schema';
import { PlayerSessionDocument } from './schemas/player-session.schema';
import { QuestionInstanceDocument } from './schemas/question-instance.schema';
import { Score, ScoreDocument } from './schemas/score.schema';
import { PlayerAnswerDocument } from './schemas/player-answer.schema';
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
    private answerModel;
    private readonly aiService;
    private readonly adaptationService;
    private readonly scoringService;
    private readonly leaderboardService;
    constructor(gameSessionModel: Model<GameSessionDocument>, playerSessionModel: Model<PlayerSessionDocument>, questionModel: Model<QuestionInstanceDocument>, scoreModel: Model<ScoreDocument>, answerModel: Model<PlayerAnswerDocument>, aiService: AiService, adaptationService: AdaptationService, scoringService: ScoringService, leaderboardService: LeaderboardService);
    createRoom(dto: CreateRoomDto, userId: string): Promise<GameSession & import("mongoose").Document<any, any, any> & {
        _id: Types.ObjectId;
    }>;
    generateSoloSession(gameSessionId: string, userId: string, topic: string, difficulty: string): Promise<{
        status: string;
        questions: {
            questionId: any;
            question: any;
            options: any;
            correct_answer: any;
            time_limit: any;
            points: any;
        }[];
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
        points: number;
        nextDifficulty: string;
    }>;
    finishGame(gameSessionId: string, userId: string): Promise<Score & import("mongoose").Document<any, any, any> & {
        _id: Types.ObjectId;
    }>;
    getSoloStats(userId: string): Promise<{
        summary: {
            totalGames: number;
            avgScore: number;
            bestScore: number;
            successRate: number;
            avgResponseTime: number;
        };
        charts: {
            difficultyDistribution: any[];
            topicPerformance: any[];
            scoreProgression: any[];
            progression?: undefined;
            difficultyPerf?: undefined;
            topicDist?: undefined;
        };
        insights?: undefined;
    } | {
        summary: {
            totalGames: any;
            avgScore: number;
            bestScore: any;
            successRate: number;
            avgResponseTime: number;
        };
        charts: {
            progression: {
                date: any;
                score: any;
            }[];
            difficultyPerf: {
                _id: any;
                successRate: any;
            }[];
            topicDist: {
                _id: any;
                count: any;
            }[];
            difficultyDistribution?: undefined;
            topicPerformance?: undefined;
            scoreProgression?: undefined;
        };
        insights: {
            strengths: string;
            weaknesses: string;
        };
    }>;
}
