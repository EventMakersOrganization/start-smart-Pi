"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubjectsModule = void 0;
const auth_module_1 = require("../auth/auth.module");
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const subjects_controller_1 = require("./subjects.controller");
const subjects_service_1 = require("./subjects.service");
const subject_schema_1 = require("./schemas/subject.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const course_schema_1 = require("../courses/schemas/course.schema");
const exercise_schema_1 = require("../exercises/schemas/exercise.schema");
const course_upload_asset_schema_1 = require("./schemas/course-upload-asset.schema");
const prosit_quiz_asset_schema_1 = require("./schemas/prosit-quiz-asset.schema");
const resource_add_asset_schema_1 = require("./schemas/resource-add-asset.schema");
const video_asset_schema_1 = require("./schemas/video-asset.schema");
const quiz_submission_schema_1 = require("./schemas/quiz-submission.schema");
const quiz_file_submission_schema_1 = require("./schemas/quiz-file-submission.schema");
let SubjectsModule = class SubjectsModule {
};
exports.SubjectsModule = SubjectsModule;
exports.SubjectsModule = SubjectsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: course_schema_1.Course.name, schema: course_schema_1.CourseSchema }]),
            mongoose_1.MongooseModule.forFeature([
                { name: exercise_schema_1.Exercise.name, schema: exercise_schema_1.ExerciseSchema },
            ]),
            mongoose_1.MongooseModule.forFeature([
                { name: course_upload_asset_schema_1.CourseUploadAsset.name, schema: course_upload_asset_schema_1.CourseUploadAssetSchema },
            ]),
            mongoose_1.MongooseModule.forFeature([
                { name: prosit_quiz_asset_schema_1.PrositQuizAsset.name, schema: prosit_quiz_asset_schema_1.PrositQuizAssetSchema },
            ]),
            mongoose_1.MongooseModule.forFeature([
                { name: resource_add_asset_schema_1.ResourceAddAsset.name, schema: resource_add_asset_schema_1.ResourceAddAssetSchema },
            ]),
            mongoose_1.MongooseModule.forFeature([
                { name: video_asset_schema_1.VideoAsset.name, schema: video_asset_schema_1.VideoAssetSchema },
            ]),
            mongoose_1.MongooseModule.forFeature([{ name: subject_schema_1.Subject.name, schema: subject_schema_1.SubjectSchema }]),
            mongoose_1.MongooseModule.forFeature([
                { name: quiz_submission_schema_1.QuizSubmission.name, schema: quiz_submission_schema_1.QuizSubmissionSchema },
            ]),
            mongoose_1.MongooseModule.forFeature([
                { name: quiz_file_submission_schema_1.QuizFileSubmission.name, schema: quiz_file_submission_schema_1.QuizFileSubmissionSchema },
            ]),
            (0, common_1.forwardRef)(() => auth_module_1.AuthModule),
            mongoose_1.MongooseModule.forFeature([
                { name: subject_schema_1.Subject.name, schema: subject_schema_1.SubjectSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
            ]),
        ],
        controllers: [subjects_controller_1.SubjectsController],
        providers: [subjects_service_1.SubjectsService],
        exports: [subjects_service_1.SubjectsService],
    })
], SubjectsModule);
//# sourceMappingURL=subjects.module.js.map