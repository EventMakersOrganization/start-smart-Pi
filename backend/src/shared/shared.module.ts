import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [ActivityModule],
  exports: [ActivityModule],
})
export class SharedModule {}
