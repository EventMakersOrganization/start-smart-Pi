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
const adaptation_service_1 = require("./services/adaptation.service");
const scoring_service_1 = require("./services/scoring.service");
const ai_service_1 = require("./services/ai.service");
const leaderboard_service_1 = require("./services/leaderboard.service");
const brainrush_gateway_1 = require("./brainrush.gateway");
let BrainrushService = class BrainrushService {
    constructor(gameSessionModel, playerSessionModel, questionModel, scoreModel, adaptationService, scoringService, aiService, leaderboardService, gateway) {
        this.gameSessionModel = gameSessionModel;
        this.playerSessionModel = playerSessionModel;
        this.questionModel = questionModel;
        this.scoreModel = scoreModel;
        this.adaptationService = adaptationService;
        this.scoringService = scoringService;
        this.aiService = aiService;
        this.leaderboardService = leaderboardService;
        this.gateway = gateway;
    }
    async startSoloGame(userId, initialDifficulty) {
        const session = new this.gameSessionModel({
            mode: 'solo',
            difficulty: initialDifficulty,
            players: [userId],
        });
        await session.save();
        const playerSession = new this.playerSessionModel({
            userId,
            gameSessionId: session._id.toString(),
        });
        await playerSession.save();
        const questionData = await this.aiService.generateQuestion('beginner', {}, [], initialDifficulty);
        const question = new this.questionModel({
            gameSessionId: session._id.toString(),
            question: questionData.question,
            options: questionData.options,
            correctAnswer: questionData.correctAnswer,
            difficulty: initialDifficulty,
        });
        await question.save();
        return { gameSessionId: session._id, playerSessionId: playerSession._id, firstQuestion: question };
    }
    async createRoom(userId, dto) {
        const roomCode = dto.roomCode || this.generateRoomCode();
        const session = new this.gameSessionModel({
            roomCode,
            mode: 'multiplayer',
            difficulty: dto.initialDifficulty,
            players: [userId],
        });
        await session.save();
        const playerSession = new this.playerSessionModel({
            userId,
            gameSessionId: session._id.toString(),
        });
        await playerSession.save();
        return { gameSessionId: session._id, roomCode };
    }
    async joinRoom(userId, roomCode) {
        const session = await this.gameSessionModel.findOne({ roomCode, active: true });
        if (!session)
            throw new Error('Room not found');
        if (session.players.includes(userId))
            throw new Error('Already in room');
        session.players.push(userId);
        await session.save();
        const playerSession = new this.playerSessionModel({
            userId,
            gameSessionId: session._id.toString(),
        });
        await playerSession.save();
        this.gateway.emitPlayerJoined(roomCode, { userId });
        return { gameSessionId: session._id };
    }
    async submitAnswer(userId, dto) {
        const question = await this.questionModel.findById(dto.questionId);
        if (!question)
            throw new Error('Question not found');
        const isCorrect = question.correctAnswer === dto.answer;
        const score = this.scoringService.calculateScore(isCorrect, dto.timeSpent, question.difficulty);
        const playerSession = await this.playerSessionModel.findOne({
            userId,
            gameSessionId: dto.gameSessionId,
        });
        if (!playerSession)
            throw new Error('Player session not found');
        playerSession.score += score;
        playerSession.totalTimeSpent += dto.timeSpent;
        playerSession.questionsAnswered += 1;
        if (isCorrect)
            playerSession.correctAnswers += 1;
        await playerSession.save();
        const newDifficulty = this.adaptationService.adaptDifficulty(question.difficulty, isCorrect, dto.timeSpent);
        const newQuestionData = await this.aiService.generateQuestion('intermediate', playerSession.weaknesses, [], newDifficulty);
        const newQuestion = new this.questionModel({
            gameSessionId: dto.gameSessionId,
            question: newQuestionData.question,
            options: newQuestionData.options,
            correctAnswer: newQuestionData.correctAnswer,
            difficulty: newDifficulty,
        });
        await newQuestion.save();
        const gameSession = await this.gameSessionModel.findById(dto.gameSessionId);
        if (gameSession.roomCode) {
            this.gateway.emitNewQuestion(gameSession.roomCode, newQuestion);
            this.gateway.emitLeaderboardUpdate(gameSession.roomCode, await this.leaderboardService.getLeaderboard());
        }
        return { score, newQuestion: gameSession.roomCode ? null : newQuestion, difficulty: newDifficulty };
    }
    async getLeaderboard() {
        return this.leaderboardService.getLeaderboard();
    }
    generateRoomCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
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
        adaptation_service_1.AdaptationService,
        scoring_service_1.ScoringService,
        ai_service_1.AiService,
        leaderboard_service_1.LeaderboardService,
        brainrush_gateway_1.BrainrushGateway])
], BrainrushService);
//# sourceMappingURL=brainrush.service.js.map