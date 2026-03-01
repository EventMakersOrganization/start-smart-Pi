import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdaptiveLearningController }
  from './adaptive-learning.controller';
import { AdaptiveLearningService }
  from './adaptive-learning.service';
import { StudentProfile, StudentProfileSchema }
  from '../users/schemas/student-profile.schema';
import { StudentPerformance, StudentPerformanceSchema }
  from './schemas/student-performance.schema';
import { Recommendation, RecommendationSchema }
  from './schemas/recommendation.schema';
import { LevelTest, LevelTestSchema }
  from './schemas/level-test.schema';
import { Question, QuestionSchema }
  from './schemas/question.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: StudentProfile.name,
        schema: StudentProfileSchema
      },
      {
        name: StudentPerformance.name,
        schema: StudentPerformanceSchema
      },
      {
        name: Recommendation.name,
        schema: RecommendationSchema
      },
      {
        name: LevelTest.name,
        schema: LevelTestSchema
      },
      {
        name: Question.name,
        schema: QuestionSchema
      }
    ])
  ],
  controllers: [AdaptiveLearningController],
  providers: [AdaptiveLearningService],
  exports: [AdaptiveLearningService],
})
export class AdaptiveLearningModule { }