"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrainrushService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const game_session_schema_1 = require("./schemas/game-session.schema");
const player_session_schema_1 = require("./schemas/player-session.schema");
const question_instance_schema_1 = require("./schemas/question-instance.schema");
const score_schema_1 = require("./schemas/score.schema");
const player_answer_schema_1 = require("./schemas/player-answer.schema");
const ai_service_1 = require("./services/ai.service");
const adaptation_service_1 = require("./services/adaptation.service");
const scoring_service_1 = require("./services/scoring.service");
const leaderboard_service_1 = require("./services/leaderboard.service");
let BrainrushService = class BrainrushService {
    constructor(gameSessionModel, playerSessionModel, questionModel, scoreModel, answerModel, aiService, adaptationService, scoringService, leaderboardService) {
        this.gameSessionModel = gameSessionModel;
        this.playerSessionModel = playerSessionModel;
        this.questionModel = questionModel;
        this.scoreModel = scoreModel;
        this.answerModel = answerModel;
        this.aiService = aiService;
        this.adaptationService = adaptationService;
        this.scoringService = scoringService;
        this.leaderboardService = leaderboardService;
    }
    async createRoom(dto, userId) {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const uid = new mongoose_2.Types.ObjectId(userId);
        const session = new this.gameSessionModel({
            roomCode,
            mode: dto.mode,
            topic: dto.topic || 'General',
            players: [uid],
        });
        await session.save();
        const playerSession = new this.playerSessionModel({
            userId: uid,
            gameSessionId: session._id,
            currentDifficulty: dto.difficulty || 'medium'
        });
        await playerSession.save();
        return session;
    }
    async generateSoloSession(gameSessionId, userId, topic, difficulty) {
        const questions = await this.aiService.generateSession(topic, difficulty, 5);
        const savedQuestions = [];
        for (const q of questions) {
            const qInst = new this.questionModel({
                gameSessionId: new mongoose_2.Types.ObjectId(gameSessionId),
                questionText: q.text,
                options: q.options,
                correctAnswer: q.correctAnswer,
                difficulty: q.difficulty || difficulty,
                topic: q.topic || topic,
                timeLimit: q.timeLimit || 20,
                points: q.points || 100
            });
            await qInst.save();
            savedQuestions.push(qInst);
        }
        return {
            status: 'success',
            questions: savedQuestions.map(q => ({
                questionId: q._id,
                question: q.questionText,
                options: q.options,
                correct_answer: q.correctAnswer,
                time_limit: q.timeLimit,
                points: q.points
            }))
        };
    }
    async joinRoom(dto, userId) {
        const session = await this.gameSessionModel.findOne({ roomCode: dto.roomCode, isActive: true });
        if (!session)
            throw new common_1.NotFoundException('Room not found or inactive');
        if (!session.players.includes(new mongoose_2.Types.ObjectId(userId))) {
            session.players.push(new mongoose_2.Types.ObjectId(userId));
            await session.save();
            const playerSession = new this.playerSessionModel({
                userId: new mongoose_2.Types.ObjectId(userId),
                gameSessionId: session._id,
            });
            await playerSession.save();
        }
        return session;
    }
    async getNextQuestion(gameSessionId, userId) {
        const playerSession = await this.playerSessionModel.findOne({
            gameSessionId: new mongoose_2.Types.ObjectId(gameSessionId),
            userId: new mongoose_2.Types.ObjectId(userId)
        });
        if (!playerSession)
            throw new common_1.NotFoundException('Player session not found');
        const aiQ = await this.aiService.generateQuestion('student', playerSession.currentDifficulty);
        const question = new this.questionModel({
            gameSessionId: new mongoose_2.Types.ObjectId(gameSessionId),
            questionText: aiQ.questionText,
            options: aiQ.options,
            correctAnswer: aiQ.correctAnswer,
            difficulty: playerSession.currentDifficulty,
        });
        await question.save();
        return {
            questionId: question._id,
            questionText: question.questionText,
            options: question.options,
        };
    }
    async submitAnswer(gameSessionId, userId, dto) {
        try {
            const question = await this.questionModel.findById(dto.questionId);
            if (!question)
                throw new common_1.NotFoundException('Question not found');
            const gid = new mongoose_2.Types.ObjectId(gameSessionId);
            const uid = new mongoose_2.Types.ObjectId(userId);
            const playerSession = await this.playerSessionModel.findOne({
                gameSessionId: { $in: [gid, gameSessionId] },
                userId: { $in: [uid, userId] }
            });
            if (!playerSession) {
                throw new common_1.NotFoundException(`Player session not found for UID: ${userId} in Game: ${gameSessionId}`);
            }
            const isCorrect = question.correctAnswer === dto.answer;
            const sessionDetail = await this.gameSessionModel.findById(gameSessionId);
            await new this.answerModel({
                userId: uid,
                gameSessionId: gid,
                questionId: new mongoose_2.Types.ObjectId(dto.questionId),
                answerGiven: dto.answer,
                isCorrect,
                responseTime: dto.responseTime,
                difficulty: question.difficulty || 'medium',
                topic: sessionDetail?.topic || 'General'
            }).save();
            playerSession.currentDifficulty = this.adaptationService.adaptDifficulty(playerSession.currentDifficulty, isCorrect, dto.responseTime);
            const points = this.scoringService.calculateScore(isCorrect, dto.responseTime, question.difficulty);
            playerSession.score += points;
            await playerSession.save();
            return { isCorrect, points, nextDifficulty: playerSession.currentDifficulty };
        }
        catch (error) {
            console.error('[Error] submitAnswer failed:', error);
            throw error;
        }
    }
    async finishGame(gameSessionId, userId) {
        try {
            const gid = new mongoose_2.Types.ObjectId(gameSessionId);
            const uid = new mongoose_2.Types.ObjectId(userId);
            const playerSession = await this.playerSessionModel.findOne({
                gameSessionId: { $in: [gid, gameSessionId] },
                userId: { $in: [uid, userId] }
            });
            if (!playerSession) {
                throw new common_1.NotFoundException(`Result session not found for user ${userId} and game ${gameSessionId}`);
            }
            let aiFeedback = 'Great progress! Keep sharpening your skills.';
            try {
                aiFeedback = await this.aiService.generateFeedback(['Speed'], ['Accuracy']);
            }
            catch (fError) {
                console.warn('Feedback generation failed, using default');
            }
            const finalScore = new this.scoreModel({
                userId: uid,
                gameSessionId: gid,
                score: playerSession.score || 0,
                timeSpent: 60,
                difficultyAchieved: playerSession.currentDifficulty || 'medium',
                aiFeedback,
            });
            await finalScore.save();
            return finalScore;
        }
        catch (error) {
            console.error('[Error] finishGame failed:', error);
            throw error;
        }
    }
    async getSoloStats(userId) {
        const uid = new mongoose_2.Types.ObjectId(userId);
        console.log('[Stats] Fetching for (UID/String):', userId);
        const soloSessions = await this.gameSessionModel.find({
            mode: game_session_schema_1.GameMode.SOLO,
            players: { $in: [uid, userId] }
        }).select('_id');
        console.log('[Stats] Solo Sessions found:', soloSessions.length);
        const sessionIds = soloSessions.map(s => s._id);
        if (sessionIds.length === 0) {
            return {
                summary: { totalGames: 0, avgScore: 0, bestScore: 0, successRate: 0, avgResponseTime: 0 },
                charts: { difficultyDistribution: [], topicPerformance: [], scoreProgression: [] }
            };
        }
        const answers = await this.answerModel.aggregate([
            { $match: { userId: { $in: [uid, userId] }, gameSessionId: { $in: sessionIds } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
                    avgResponse: { $avg: '$responseTime' }
                }
            }
        ]);
        const statsByDiff = await this.answerModel.aggregate([
            { $match: { userId: { $in: [uid, userId] }, gameSessionId: { $in: sessionIds } } },
            {
                $group: {
                    _id: '$difficulty',
                    count: { $sum: 1 },
                    successRate: { $avg: { $cond: ['$isCorrect', 100, 0] } }
                }
            }
        ]);
        const statsByTopic = await this.answerModel.aggregate([
            { $match: { userId: { $in: [uid, userId] }, gameSessionId: { $in: sessionIds } } },
            {
                $group: {
                    _id: '$topic',
                    count: { $sum: 1 },
                    avgSuccess: { $avg: { $cond: ['$isCorrect', 1, 0] } }
                }
            }
        ]);
        const scores = await this.scoreModel.aggregate([
            { $match: { userId: { $in: [uid, userId] }, gameSessionId: { $in: sessionIds } } },
            {
                $group: {
                    _id: null,
                    totalGames: { $sum: 1 },
                    avgScore: { $avg: '$score' },
                    maxScore: { $max: '$score' }
                }
            }
        ]);
        const progression = await this.scoreModel.aggregate([
            { $match: { userId: { $in: [uid, userId] }, gameSessionId: { $in: sessionIds } } },
            {
                $project: {
                    score: 1,
                    createdAt: 1,
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                }
            },
            { $sort: { createdAt: 1 } }
        ]);
        const summary = {
            totalGames: scores[0]?.totalGames || 0,
            avgScore: Math.round(scores[0]?.avgScore || 0),
            bestScore: scores[0]?.maxScore || 0,
            successRate: answers[0] ? Math.round((answers[0].correct / answers[0].total) * 100) : 0,
            avgResponseTime: answers[0] ? parseFloat((answers[0].avgResponse / 1000).toFixed(2)) : 0
        };
        let strengths = 'N/A';
        let weaknesses = 'N/A';
        if (statsByDiff.length > 0) {
            const sorted = [...statsByDiff].sort((a, b) => b.count - a.count);
            strengths = `${sorted[0]._id} difficulty`;
            weaknesses = sorted.length > 1 ? `${sorted[sorted.length - 1]._id} difficulty` : 'N/A';
        }
        return {
            summary,
            charts: {
                progression: progression.map(p => ({ date: p.date, score: p.score })),
                difficultyPerf: statsByDiff.map(d => ({ _id: d._id, successRate: d.successRate })),
                topicDist: statsByTopic.map(t => ({ _id: t._id, count: t.count }))
            },
            insights: { strengths, weaknesses }
        };
    }
};
exports.BrainrushService = BrainrushService;
exports.BrainrushService = BrainrushService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(game_session_schema_1.GameSession.name)),
    __param(1, (0, mongoose_1.InjectModel)(player_session_schema_1.PlayerSession.name)),
    __param(2, (0, mongoose_1.InjectModel)(question_instance_schema_1.QuestionInstance.name)),
    __param(3, (0, mongoose_1.InjectModel)(score_schema_1.Score.name)),
    __param(4, (0, mongoose_1.InjectModel)(player_answer_schema_1.PlayerAnswer.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        ai_service_1.AiService,
        adaptation_service_1.AdaptationService,
        scoring_service_1.ScoringService,
        leaderboard_service_1.LeaderboardService])
], BrainrushService);
//# sourceMappingURL=brainrush.service.js.map