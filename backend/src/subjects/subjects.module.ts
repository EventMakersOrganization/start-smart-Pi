import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Course, CourseSchema } from "../courses/schemas/course.schema";
import { Exercise, ExerciseSchema } from "../exercises/schemas/exercise.schema";
import {
  CourseUploadAsset,
  CourseUploadAssetSchema,
} from "./schemas/course-upload-asset.schema";
import { Subject, SubjectSchema } from "./schemas/subject.schema";
import {
  PrositQuizAsset,
  PrositQuizAssetSchema,
} from "./schemas/prosit-quiz-asset.schema";
import {
  ResourceAddAsset,
  ResourceAddAssetSchema,
} from "./schemas/resource-add-asset.schema";
import { VideoAsset, VideoAssetSchema } from "./schemas/video-asset.schema";
import {
  QuizSubmission,
  QuizSubmissionSchema,
} from "./schemas/quiz-submission.schema";
import {
  QuizFileSubmission,
  QuizFileSubmissionSchema,
} from "./schemas/quiz-file-submission.schema";
import { SubjectsController } from "./subjects.controller";
import { SubjectsService } from "./subjects.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Course.name, schema: CourseSchema }]),
    MongooseModule.forFeature([
      { name: Exercise.name, schema: ExerciseSchema },
    ]),
    MongooseModule.forFeature([
      { name: CourseUploadAsset.name, schema: CourseUploadAssetSchema },
    ]),
    MongooseModule.forFeature([
      { name: PrositQuizAsset.name, schema: PrositQuizAssetSchema },
    ]),
    MongooseModule.forFeature([
      { name: ResourceAddAsset.name, schema: ResourceAddAssetSchema },
    ]),
    MongooseModule.forFeature([
      { name: VideoAsset.name, schema: VideoAssetSchema },
    ]),
    MongooseModule.forFeature([{ name: Subject.name, schema: SubjectSchema }]),
    MongooseModule.forFeature([
      { name: QuizSubmission.name, schema: QuizSubmissionSchema },
    ]),
    MongooseModule.forFeature([
      { name: QuizFileSubmission.name, schema: QuizFileSubmissionSchema },
    ]),
    AuthModule,
  ],
  controllers: [SubjectsController],
  providers: [SubjectsService],
  exports: [SubjectsService],
})
export class SubjectsModule {}
