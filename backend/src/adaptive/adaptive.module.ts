import { Module } from '@nestjs/common';
import { AdaptiveService } from './adaptive.service';
import { AdaptiveController } from './adaptive.controller';

@Module({
  providers: [AdaptiveService],
  controllers: [AdaptiveController]
})
export class AdaptiveModule {}
