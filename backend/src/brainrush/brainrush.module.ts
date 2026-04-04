import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { BrainrushController } from './brainrush.controller';
import { BrainrushService } from './brainrush.service';
import { AiService } from './services/ai.service';
import { AdaptationService } from './services/adaptation.service';
import { ScoringService } from './services/scoring.service';
import { LeaderboardService } from './services/leaderboard.service';
import { RoomService } from './services/room.service';
import { BrainrushGateway } from './gateways/brainrush.gateway';
import { MultiplayerGameService } from './services/multiplayer-game.service';
import { GameSession, GameSessionSchema } from './schemas/game-session.schema';
import { PlayerSession, PlayerSessionSchema } from './schemas/player-session.schema';
import { QuestionInstance, QuestionInstanceSchema } from './schemas/question-instance.schema';
import { Score, ScoreSchema } from './schemas/score.schema';
import { PlayerAnswer, PlayerAnswerSchema } from './schemas/player-answer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GameSession.name, schema: GameSessionSchema },
      { name: PlayerSession.name, schema: PlayerSessionSchema },
      { name: QuestionInstance.name, schema: QuestionInstanceSchema },
      { name: Score.name, schema: ScoreSchema },
      { name: PlayerAnswer.name, schema: PlayerAnswerSchema },
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
    RoomService,
    MultiplayerGameService,
    BrainrushGateway,
  ],
  exports: [BrainrushService],
})
export class BrainrushModule { }
