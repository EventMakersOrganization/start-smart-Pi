import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChatModule } from './chat/chat.module';
import { CoursesModule } from './courses/courses.module';
import { ExercisesModule } from './exercises/exercises.module';
import { BrainrushModule } from './brainrush/brainrush.module';
import { AdaptiveModule } from './adaptive/adaptive.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [AuthModule, UsersModule, ChatModule, CoursesModule, ExercisesModule, BrainrushModule, AdaptiveModule, AnalyticsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
