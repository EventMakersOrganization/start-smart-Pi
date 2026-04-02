const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'src', 'brainrush');

const dirs = [
  baseDir,
  path.join(baseDir, 'dto'),
  path.join(baseDir, 'schemas'),
  path.join(baseDir, 'services'),
  path.join(baseDir, 'gateways'),
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const files = {
  // --- Schemas ---
  'schemas/game-session.schema.ts': `
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GameSessionDocument = GameSession & Document;

export enum GameMode {
  SOLO = 'solo',
  MULTIPLAYER = 'multiplayer',
}

@Schema({ timestamps: true })
export class GameSession {
  @Prop({ required: true })
  roomCode: string;

  @Prop({ type: String, enum: Object.values(GameMode), required: true })
  mode: GameMode;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  players: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;
}

export const GameSessionSchema = SchemaFactory.createForClass(GameSession);
  `,

  'schemas/player-session.schema.ts': `
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PlayerSessionDocument = PlayerSession & Document;

@Schema({ timestamps: true })
export class PlayerSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'GameSession', required: true })
  gameSessionId: Types.ObjectId;

  @Prop({ default: 0 })
  score: number;

  @Prop({ default: 'medium' }) // easy, medium, hard
  currentDifficulty: string;

  @Prop({ default: 0 })
  consecutiveCorrect: number;

  @Prop({ default: 0 })
  consecutiveWrong: number;
}

export const PlayerSessionSchema = SchemaFactory.createForClass(PlayerSession);
  `,

  'schemas/question-instance.schema.ts': `
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuestionInstanceDocument = QuestionInstance & Document;

@Schema({ timestamps: true })
export class QuestionInstance {
  @Prop({ type: Types.ObjectId, ref: 'GameSession', required: true })
  gameSessionId: Types.ObjectId;

  @Prop({ required: true })
  questionText: string;

  @Prop({ type: [String], required: true })
  options: string[];

  @Prop({ required: true })
  correctAnswer: string;

  @Prop({ required: true })
  difficulty: string;
}

export const QuestionInstanceSchema = SchemaFactory.createForClass(QuestionInstance);
  `,

  'schemas/score.schema.ts': `
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ScoreDocument = Score & Document;

@Schema({ timestamps: true })
export class Score {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'GameSession', required: true })
  gameSessionId: Types.ObjectId;

  @Prop({ required: true })
  score: number;

  @Prop()
  timeSpent: number;

  @Prop()
  difficultyAchieved: string;

  @Prop()
  aiFeedback: string;
}

export const ScoreSchema = SchemaFactory.createForClass(Score);
  `,

  // --- DTOs ---
  'dto/create-room.dto.ts': `
import { IsEnum, IsNotEmpty } from 'class-validator';
import { GameMode } from '../schemas/game-session.schema';

export class CreateRoomDto {
  @IsEnum(GameMode)
  mode: GameMode;
}
  `,

  'dto/join-room.dto.ts': `
import { IsNotEmpty, IsString } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  roomCode: string;
}
  `,

  'dto/submit-answer.dto.ts': `
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class SubmitAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @IsNotEmpty()
  answer: string;

  @IsNumber()
  responseTime: number; // in milliseconds
}
  `,

  // --- Services ---
  'services/ai.service.ts': `
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';

  constructor(private readonly httpService: HttpService) {}

  async generateQuestion(level: string, difficulty: string, courseObjectives?: string): Promise<any> {
    const prompt = \`Generate a multiple choice question about testing or programming for a student at \${level} level. 
    Difficulty: \${difficulty}. 
    Objectives: \${courseObjectives || 'General knowledge'}.
    Provide the output strictly in JSON format: {"questionText": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "A"}\`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(this.OLLAMA_URL, {
          model: 'llama2', // Requires local model
          prompt,
          stream: false,
          format: 'json',
        }),
      );
      
      return JSON.parse(response.data.response);
    } catch (error) {
      this.logger.error('Failed to generate AI question, using fallback', error);
      return this.getFallbackQuestion(difficulty);
    }
  }

  async generateFeedback(strengths: string[], weaknesses: string[]): Promise<string> {
    const prompt = \`Generate constructive feedback for a student in a quiz. 
    Strengths: \${strengths.join(',')}. 
    Weaknesses: \${weaknesses.join(',')}.
    Keep it short, encouraging, and provide 1 recommendation.\`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(this.OLLAMA_URL, {
          model: 'llama2',
          prompt,
          stream: false,
        }),
      );
      return response.data.response;
    } catch (error) {
      return 'Great effort! Review the general concepts to improve further.';
    }
  }

  private getFallbackQuestion(difficulty: string) {
    return {
      questionText: 'What is the capital of France? (Fallback)',
      options: ['London', 'Berlin', 'Paris', 'Madrid'],
      correctAnswer: 'Paris',
    };
  }
}
  `,

  'services/adaptation.service.ts': `
import { Injectable } from '@nestjs/common';

@Injectable()
export class AdaptationService {
  private readonly TIME_THRESHOLD = 5000; // 5 seconds

  /**
   * Adaptive Difficulty Algorithm
   * Increases difficulty if correct answer and response time < threshold
   * Decreases difficulty if wrong answer or response time > threshold
   */
  adaptDifficulty(
    currentDifficulty: string,
    isCorrect: boolean,
    responseTime: number,
  ): string {
    const levels = ['easy', 'medium', 'hard'];
    let currentIndex = levels.indexOf(currentDifficulty);
    if (currentIndex === -1) currentIndex = 1; // default medium

    if (isCorrect && responseTime < this.TIME_THRESHOLD) {
      // Step up difficulty
      currentIndex = Math.min(currentIndex + 1, levels.length - 1);
    } else if (!isCorrect || responseTime > this.TIME_THRESHOLD) {
      // Step down difficulty
      currentIndex = Math.max(currentIndex - 1, 0);
    }

    return levels[currentIndex];
  }
}
  `,

  'services/scoring.service.ts': `
import { Injectable } from '@nestjs/common';

@Injectable()
export class ScoringService {
  calculateScore(isCorrect: boolean, responseTime: number, difficulty: string): number {
    if (!isCorrect) return 0;
    
    let baseScore = 10;
    if (difficulty === 'medium') baseScore = 20;
    if (difficulty === 'hard') baseScore = 30;

    // Time bonus
    const timeBonus = Math.max(0, 5000 - responseTime) / 1000; // Up to 5 bonus points
    return Math.floor(baseScore + timeBonus);
  }
}
  `,

  'services/leaderboard.service.ts': `
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Score, ScoreDocument } from '../schemas/score.schema';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectModel(Score.name) private scoreModel: Model<ScoreDocument>,
  ) {}

  async getLeaderboard(gameSessionId: string) {
    return this.scoreModel
      .find({ gameSessionId })
      .populate('userId', 'first_name last_name')
      .sort({ score: -1 })
      .exec();
  }
}
  `,

  'brainrush.service.ts': `
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
  `,

  'brainrush.controller.ts': `
import { Controller, Post, Body, UseGuards, Req, Param, Get } from '@nestjs/common';
import { BrainrushService } from './brainrush.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { LeaderboardService } from './services/leaderboard.service';

@Controller('brainrush')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
export class BrainrushController {
  constructor(
    private readonly brainrushService: BrainrushService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  @Post('create-room')
  createRoom(@Body() dto: CreateRoomDto, @Req() req: any) {
    return this.brainrushService.createRoom(dto, req.user._id);
  }

  @Post('join-room')
  joinRoom(@Body() dto: JoinRoomDto, @Req() req: any) {
    return this.brainrushService.joinRoom(dto, req.user._id);
  }

  @Get(':sessionId/next-question')
  getNextQuestion(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.brainrushService.getNextQuestion(sessionId, req.user._id);
  }

  @Post(':sessionId/submit-answer')
  submitAnswer(
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitAnswerDto,
    @Req() req: any,
  ) {
    return this.brainrushService.submitAnswer(sessionId, req.user._id, dto);
  }

  @Post(':sessionId/finish')
  finishGame(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.brainrushService.finishGame(sessionId, req.user._id);
  }

  @Get(':sessionId/leaderboard')
  getLeaderboard(@Param('sessionId') sessionId: string) {
    return this.leaderboardService.getLeaderboard(sessionId);
  }
}
  `,

  'gateways/brainrush.gateway.ts': `
import { 
  WebSocketGateway, 
  SubscribeMessage, 
  MessageBody, 
  ConnectedSocket, 
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { LeaderboardService } from '../services/leaderboard.service';

@WebSocketGateway({ namespace: '/brainrush', cors: true })
export class BrainrushGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  
  private logger = new Logger('BrainrushGateway');

  constructor(private leaderboardService: LeaderboardService) {}

  handleConnection(client: Socket) {
    this.logger.log(\`Client connected: \${client.id}\`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(\`Client disconnected: \${client.id}\`);
  }

  @SubscribeMessage('joinGameRoom')
  handleJoinRoom(@MessageBody() roomCode: string, @ConnectedSocket() client: Socket) {
    client.join(roomCode);
    this.logger.log(\`Client \${client.id} joined room \${roomCode}\`);
    this.server.to(roomCode).emit('playerJoined', { playerId: client.id });
  }

  @SubscribeMessage('updateScore')
  async handleUpdateScore(
    @MessageBody() payload: { gameSessionId: string, roomCode: string },
    @ConnectedSocket() client: Socket
  ) {
    const leaderboard = await this.leaderboardService.getLeaderboard(payload.gameSessionId);
    this.server.to(payload.roomCode).emit('leaderboardUpdate', leaderboard);
  }
}
  `,

  'brainrush.module.ts': `
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { BrainrushController } from './brainrush.controller';
import { BrainrushService } from './brainrush.service';
import { AiService } from './services/ai.service';
import { AdaptationService } from './services/adaptation.service';
import { ScoringService } from './services/scoring.service';
import { LeaderboardService } from './services/leaderboard.service';
import { BrainrushGateway } from './gateways/brainrush.gateway';
import { GameSession, GameSessionSchema } from './schemas/game-session.schema';
import { PlayerSession, PlayerSessionSchema } from './schemas/player-session.schema';
import { QuestionInstance, QuestionInstanceSchema } from './schemas/question-instance.schema';
import { Score, ScoreSchema } from './schemas/score.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GameSession.name, schema: GameSessionSchema },
      { name: PlayerSession.name, schema: PlayerSessionSchema },
      { name: QuestionInstance.name, schema: QuestionInstanceSchema },
      { name: Score.name, schema: ScoreSchema },
    ]),
    HttpModule,
  ],
  controllers: [BrainrushController],
  providers: [
    BrainrushService,
    AiService,
    AdaptationService,
    ScoringService,
    LeaderboardService,
    BrainrushGateway,
  ],
  exports: [BrainrushService],
})
export class BrainrushModule {}
  `
};

for (const [relativePath, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(baseDir, relativePath), content.trim() + '\n');
}

console.log('BrainRush Backend Module generated successfully.');
