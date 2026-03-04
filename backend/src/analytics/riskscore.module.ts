import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RiskScoreController } from './riskscore.controller';
import { RiskScoreService } from './riskscore.service';
import { RiskScore, RiskScoreSchema } from './schemas/riskscore.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RiskScore.name, schema: RiskScoreSchema },
    ]),
  ],
  controllers: [RiskScoreController],
  providers: [RiskScoreService],
  exports: [RiskScoreService],
})
export class RiskScoreModule {}
