import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { BrainrushController } from './brainrush.controller';
import { BrainrushService } from './brainrush.service';
import { BrainrushGateway } from './brainrush.gateway';
import { AdaptationService } from './services/adaptation.service';
import { ScoringService } from './services/scoring.service';
import { AiService } from './services/ai.service';
import { LeaderboardService } from './services/leaderboard.service';
import { GameSession, GameSessionSchema } from './schemas/game-session.schema';
import { PlayerSession, PlayerSessionSchema } from './schemas/player-session.schema';
import { QuestionInstance, QuestionInstanceSchema } from './schemas/question-instance.schema';
import { Score, ScoreSchema } from './schemas/score.schema';

@Module({
  imports: [
    AuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'your-secret-key'),
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: GameSession.name, schema: GameSessionSchema },
      { name: PlayerSession.name, schema: PlayerSessionSchema },
      { name: QuestionInstance.name, schema: QuestionInstanceSchema },
      { name: Score.name, schema: ScoreSchema },
    ]),
  ],
  controllers: [BrainrushController],
  providers: [
    BrainrushService,
    BrainrushGateway,
    AdaptationService,
    ScoringService,
    AiService,
    LeaderboardService,
  ],
  exports: [BrainrushService],
})
export class BrainrushModule {}
