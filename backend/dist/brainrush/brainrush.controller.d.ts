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
    initializeSolo(sessionId: string, body: {
        topic: string;
        difficulty: string;
    }, req: any): Promise<{
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
    getNextQuestion(sessionId: string, req: any): Promise<{
        questionId: any;
        questionText: string;
        options: string[];
    }>;
    submitAnswer(sessionId: string, dto: SubmitAnswerDto, req: any): Promise<{
        isCorrect: boolean;
        points: number;
        nextDifficulty: string;
    }>;
    finishGame(sessionId: string, req: any): Promise<import("./schemas/score.schema").Score & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    getSoloStats(req: any): Promise<{
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
    getLeaderboard(sessionId: string): Promise<Omit<import("./schemas/score.schema").Score & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }, never>[]>;
}
