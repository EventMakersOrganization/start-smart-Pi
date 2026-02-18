import { Module } from '@nestjs/common';
import { BrainrushService } from './brainrush.service';
import { BrainrushController } from './brainrush.controller';

@Module({
  providers: [BrainrushService],
  controllers: [BrainrushController]
})
export class BrainrushModule {}
