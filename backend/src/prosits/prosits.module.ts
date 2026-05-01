import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PrositsController } from "./prosits.controller";
import { PrositsService } from "./prosits.service";
import {
  PrositSubmission,
  PrositSubmissionSchema,
} from "./schemas/prosit-submission.schema";
import { Subject, SubjectSchema } from "../subjects/schemas/subject.schema";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    forwardRef(() => AuthModule),
    MongooseModule.forFeature([
      {
        name: PrositSubmission.name,
        schema: PrositSubmissionSchema,
      },
      { name: Subject.name, schema: SubjectSchema },
    ]),
  ],
  controllers: [PrositsController],
  providers: [PrositsService],
  exports: [PrositsService],
})
export class PrositsModule {}
