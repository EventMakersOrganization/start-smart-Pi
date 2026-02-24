import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameSession, GameSessionDocument } from './schemas/game-session.schema';
import { PlayerSession, PlayerSessionDocument } from './schemas/player-session.schema';
import { QuestionInstance, QuestionInstanceDocument } from './schemas/question-instance.schema';
import { Score, ScoreDocument } from './schemas/score.schema';
import { AdaptationService } from './services/adaptation.service';
import { ScoringService } from './services/scoring.service';
import { AiService } from './services/ai.service';
import { LeaderboardService } from './services/leaderboard.service';
import { BrainrushGateway } from './brainrush.gateway';
import { CreateRoomDto } from './dto/create-room.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

@Injectable()
export class BrainrushService {
  constructor(
    @InjectModel(GameSession.name) private gameSessionModel: Model<GameSessionDocument>,
    @InjectModel(PlayerSession.name) private playerSessionModel: Model<PlayerSessionDocument>,
    @InjectModel(QuestionInstance.name) private questionModel: Model<QuestionInstanceDocument>,
    @InjectModel(Score.name) private scoreModel: Model<ScoreDocument>,
    private adaptationService: AdaptationService,
    private scoringService: ScoringService,
    private aiService: AiService,
    private leaderboardService: LeaderboardService,
    private gateway: BrainrushGateway,
  ) {}

  async startSoloGame(userId: string, initialDifficulty: 'easy' | 'medium' | 'hard') {
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

    // Generate first question
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

  async createRoom(userId: string, dto: CreateRoomDto) {
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

  async joinRoom(userId: string, roomCode: string) {
    const session = await this.gameSessionModel.findOne({ roomCode, active: true });
    if (!session) throw new Error('Room not found');

    if (session.players.includes(userId)) throw new Error('Already in room');

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

  async submitAnswer(userId: string, dto: SubmitAnswerDto) {
    const question = await this.questionModel.findById(dto.questionId);
    if (!question) throw new Error('Question not found');

    const isCorrect = question.correctAnswer === dto.answer;
    const score = this.scoringService.calculateScore(isCorrect, dto.timeSpent, question.difficulty);

    const playerSession = await this.playerSessionModel.findOne({
      userId,
      gameSessionId: dto.gameSessionId,
    });
    if (!playerSession) throw new Error('Player session not found');

    playerSession.score += score;
    playerSession.totalTimeSpent += dto.timeSpent;
    playerSession.questionsAnswered += 1;
    if (isCorrect) playerSession.correctAnswers += 1;
    await playerSession.save();

    // Adapt difficulty
    const newDifficulty = this.adaptationService.adaptDifficulty(
      question.difficulty,
      isCorrect,
      dto.timeSpent,
    );

    // Generate new question
    const newQuestionData = await this.aiService.generateQuestion(
      'intermediate', // placeholder
      playerSession.weaknesses,
      [], // course objectives
      newDifficulty,
    );

    const newQuestion = new this.questionModel({
      gameSessionId: dto.gameSessionId,
      question: newQuestionData.question,
      options: newQuestionData.options,
      correctAnswer: newQuestionData.correctAnswer,
      difficulty: newDifficulty,
    });
    await newQuestion.save();

    // Emit to room if multiplayer
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

  private generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}
