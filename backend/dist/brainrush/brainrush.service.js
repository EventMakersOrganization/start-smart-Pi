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
const ai_service_1 = require("./services/ai.service");
const adaptation_service_1 = require("./services/adaptation.service");
const scoring_service_1 = require("./services/scoring.service");
const leaderboard_service_1 = require("./services/leaderboard.service");
let BrainrushService = class BrainrushService {
    constructor(gameSessionModel, playerSessionModel, questionModel, scoreModel, aiService, adaptationService, scoringService, leaderboardService) {
        this.gameSessionModel = gameSessionModel;
        this.playerSessionModel = playerSessionModel;
        this.questionModel = questionModel;
        this.scoreModel = scoreModel;
        this.aiService = aiService;
        this.adaptationService = adaptationService;
        this.scoringService = scoringService;
        this.leaderboardService = leaderboardService;
    }
    async createRoom(dto, userId) {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const session = new this.gameSessionModel({
            roomCode,
            mode: dto.mode,
            players: [new mongoose_2.Types.ObjectId(userId)],
        });
        await session.save();
        const playerSession = new this.playerSessionModel({
            userId: new mongoose_2.Types.ObjectId(userId),
            gameSessionId: session._id,
        });
        await playerSession.save();
        return session;
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
        const question = await this.questionModel.findById(dto.questionId);
        if (!question)
            throw new common_1.NotFoundException('Question not found');
        const playerSession = await this.playerSessionModel.findOne({
            gameSessionId: new mongoose_2.Types.ObjectId(gameSessionId),
            userId: new mongoose_2.Types.ObjectId(userId)
        });
        const isCorrect = question.correctAnswer === dto.answer;
        playerSession.currentDifficulty = this.adaptationService.adaptDifficulty(playerSession.currentDifficulty, isCorrect, dto.responseTime);
        const points = this.scoringService.calculateScore(isCorrect, dto.responseTime, question.difficulty);
        playerSession.score += points;
        if (isCorrect) {
            playerSession.consecutiveCorrect += 1;
            playerSession.consecutiveWrong = 0;
        }
        else {
            playerSession.consecutiveWrong += 1;
            playerSession.consecutiveCorrect = 0;
        }
        await playerSession.save();
        return {
            isCorrect,
            correctAnswer: question.correctAnswer,
            pointsEarned: points,
            newScore: playerSession.score,
        };
    }
    async finishGame(gameSessionId, userId) {
        const playerSession = await this.playerSessionModel.findOne({
            gameSessionId: new mongoose_2.Types.ObjectId(gameSessionId),
            userId: new mongoose_2.Types.ObjectId(userId)
        });
        const aiFeedback = await this.aiService.generateFeedback(['Speed'], ['Accuracy']);
        const finalScore = new this.scoreModel({
            userId: new mongoose_2.Types.ObjectId(userId),
            gameSessionId: new mongoose_2.Types.ObjectId(gameSessionId),
            score: playerSession.score,
            timeSpent: 60,
            difficultyAchieved: playerSession.currentDifficulty,
            aiFeedback,
        });
        await finalScore.save();
        return finalScore;
    }
};
exports.BrainrushService = BrainrushService;
exports.BrainrushService = BrainrushService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(game_session_schema_1.GameSession.name)),
    __param(1, (0, mongoose_1.InjectModel)(player_session_schema_1.PlayerSession.name)),
    __param(2, (0, mongoose_1.InjectModel)(question_instance_schema_1.QuestionInstance.name)),
    __param(3, (0, mongoose_1.InjectModel)(score_schema_1.Score.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        ai_service_1.AiService,
        adaptation_service_1.AdaptationService,
        scoring_service_1.ScoringService,
        leaderboard_service_1.LeaderboardService])
], BrainrushService);
//# sourceMappingURL=brainrush.service.js.map