import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GameSession, GameSessionDocument, GameMode } from './schemas/game-session.schema';
import { PlayerSession, PlayerSessionDocument } from './schemas/player-session.schema';
import { QuestionInstance, QuestionInstanceDocument } from './schemas/question-instance.schema';
import { Score, ScoreDocument } from './schemas/score.schema';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { AiService } from './services/ai.service';
import { AdaptationService } from './services/adaptation.service';
import { ScoringService } from './services/scoring.service';
import { LeaderboardService } from './services/leaderboard.service';

@Injectable()
export class BrainrushService {
  constructor(
    @InjectModel(GameSession.name) private gameSessionModel: Model<GameSessionDocument>,
    @InjectModel(PlayerSession.name) private playerSessionModel: Model<PlayerSessionDocument>,
    @InjectModel(QuestionInstance.name) private questionModel: Model<QuestionInstanceDocument>,
    @InjectModel(Score.name) private scoreModel: Model<ScoreDocument>,
    private readonly aiService: AiService,
    private readonly adaptationService: AdaptationService,
    private readonly scoringService: ScoringService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  async createRoom(dto: CreateRoomDto, userId: string) {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const session = new this.gameSessionModel({
      roomCode,
      mode: dto.mode,
      players: [new Types.ObjectId(userId)],
    });
    await session.save();

    const playerSession = new this.playerSessionModel({
      userId: new Types.ObjectId(userId),
      gameSessionId: session._id,
    });
    await playerSession.save();

    return session;
  }

  async joinRoom(dto: JoinRoomDto, userId: string) {
    const session = await this.gameSessionModel.findOne({ roomCode: dto.roomCode, isActive: true });
    if (!session) throw new NotFoundException('Room not found or inactive');

    if (!session.players.includes(new Types.ObjectId(userId))) {
      session.players.push(new Types.ObjectId(userId));
      await session.save();

      const playerSession = new this.playerSessionModel({
        userId: new Types.ObjectId(userId),
        gameSessionId: session._id,
      });
      await playerSession.save();
    }
    return session;
  }

  async getNextQuestion(gameSessionId: string, userId: string) {
    const playerSession = await this.playerSessionModel.findOne({ 
      gameSessionId: new Types.ObjectId(gameSessionId), 
      userId: new Types.ObjectId(userId) 
    });
    
    if (!playerSession) throw new NotFoundException('Player session not found');

    const aiQ = await this.aiService.generateQuestion('student', playerSession.currentDifficulty);
    
    const question = new this.questionModel({
      gameSessionId: new Types.ObjectId(gameSessionId),
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

  async submitAnswer(gameSessionId: string, userId: string, dto: SubmitAnswerDto) {
    const question = await this.questionModel.findById(dto.questionId);
    if (!question) throw new NotFoundException('Question not found');

    const playerSession = await this.playerSessionModel.findOne({ 
      gameSessionId: new Types.ObjectId(gameSessionId), 
      userId: new Types.ObjectId(userId) 
    });

    const isCorrect = question.correctAnswer === dto.answer;
    
    // Adapt difficulty
    playerSession.currentDifficulty = this.adaptationService.adaptDifficulty(
      playerSession.currentDifficulty,
      isCorrect,
      dto.responseTime
    );

    // Score
    const points = this.scoringService.calculateScore(isCorrect, dto.responseTime, question.difficulty);
    playerSession.score += points;

    if (isCorrect) {
      playerSession.consecutiveCorrect += 1;
      playerSession.consecutiveWrong = 0;
    } else {
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

  async finishGame(gameSessionId: string, userId: string) {
    const playerSession = await this.playerSessionModel.findOne({ 
      gameSessionId: new Types.ObjectId(gameSessionId), 
      userId: new Types.ObjectId(userId) 
    });

    const aiFeedback = await this.aiService.generateFeedback(['Speed'], ['Accuracy']);

    const finalScore = new this.scoreModel({
      userId: new Types.ObjectId(userId),
      gameSessionId: new Types.ObjectId(gameSessionId),
      score: playerSession.score,
      timeSpent: 60, // Example static
      difficultyAchieved: playerSession.currentDifficulty,
      aiFeedback,
    });
    await finalScore.save();

    return finalScore;
  }
}
