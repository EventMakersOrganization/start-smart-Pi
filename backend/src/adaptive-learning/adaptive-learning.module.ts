import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AdaptiveLearningController } from "./adaptive-learning.controller";
import { AdaptiveLearningService } from "./adaptive-learning.service";
import {
  StudentProfile,
  StudentProfileSchema,
} from "../users/schemas/student-profile.schema";
import {
  StudentPerformance,
  StudentPerformanceSchema,
} from "./schemas/student-performance.schema";
import {
  Recommendation,
  RecommendationSchema,
} from "./schemas/recommendation.schema";
import { LevelTest, LevelTestSchema } from "./schemas/level-test.schema";
import {
  PostEvaluationTest,
  PostEvaluationTestSchema,
} from "./schemas/post-evaluation-test.schema";
import { Question, QuestionSchema } from "./schemas/question.schema";
import { ChatAi, ChatAiSchema } from "../chat/schemas/chat-ai.schema";
import {
  ChatInstructor,
  ChatInstructorSchema,
} from "../chat/schemas/chat-instructor.schema";
import { ChatRoom, ChatRoomSchema } from "../chat/schemas/chat-room.schema";
import {
  ChatMessage,
  ChatMessageSchema,
} from "../chat/schemas/chat-message.schema";
import { Score, ScoreSchema } from "../brainrush/schemas/score.schema";
import {
  PlayerSession,
  PlayerSessionSchema,
} from "../brainrush/schemas/player-session.schema";
import {
  GoalSettings,
  GoalSettingsSchema,
} from "./schemas/goal-settings.schema";
import {
  QuizSubmission,
  QuizSubmissionSchema,
} from "../subjects/schemas/quiz-submission.schema";
import {
  QuizFileSubmission,
  QuizFileSubmissionSchema,
} from "../subjects/schemas/quiz-file-submission.schema";
import { Subject, SubjectSchema } from "../subjects/schemas/subject.schema";
import {
  PrositSubmission,
  PrositSubmissionSchema,
} from "../prosits/schemas/prosit-submission.schema";
import {
  ClassEnrollment,
  ClassEnrollmentSchema,
} from "../academic/schemas/class-enrollment.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: StudentProfile.name,
        schema: StudentProfileSchema,
      },
      {
        name: StudentPerformance.name,
        schema: StudentPerformanceSchema,
      },
      {
        name: Recommendation.name,
        schema: RecommendationSchema,
      },
      {
        name: LevelTest.name,
        schema: LevelTestSchema,
      },
      {
        name: PostEvaluationTest.name,
        schema: PostEvaluationTestSchema,
      },
      {
        name: Question.name,
        schema: QuestionSchema,
      },
      {
        name: ChatAi.name,
        schema: ChatAiSchema,
      },
      {
        name: ChatInstructor.name,
        schema: ChatInstructorSchema,
      },
      {
        name: ChatRoom.name,
        schema: ChatRoomSchema,
      },
      {
        name: ChatMessage.name,
        schema: ChatMessageSchema,
      },
      {
        name: Score.name,
        schema: ScoreSchema,
      },
      {
        name: PlayerSession.name,
        schema: PlayerSessionSchema,
      },
      {
        name: GoalSettings.name,
        schema: GoalSettingsSchema,
      },
      {
        name: QuizSubmission.name,
        schema: QuizSubmissionSchema,
      },
      {
        name: QuizFileSubmission.name,
        schema: QuizFileSubmissionSchema,
      },
      {
        name: Subject.name,
        schema: SubjectSchema,
      },
      {
        name: PrositSubmission.name,
        schema: PrositSubmissionSchema,
      },
      {
        name: ClassEnrollment.name,
        schema: ClassEnrollmentSchema,
      },
    ]),
  ],
  controllers: [AdaptiveLearningController],
  providers: [AdaptiveLearningService],
  exports: [AdaptiveLearningService],
})
export class AdaptiveLearningModule {}
