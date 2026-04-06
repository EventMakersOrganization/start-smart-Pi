"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptiveLearningModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const adaptive_learning_controller_1 = require("./adaptive-learning.controller");
const adaptive_learning_service_1 = require("./adaptive-learning.service");
const student_profile_schema_1 = require("../users/schemas/student-profile.schema");
const student_performance_schema_1 = require("./schemas/student-performance.schema");
const recommendation_schema_1 = require("./schemas/recommendation.schema");
const level_test_schema_1 = require("./schemas/level-test.schema");
const question_schema_1 = require("./schemas/question.schema");
const chat_ai_schema_1 = require("../chat/schemas/chat-ai.schema");
const chat_instructor_schema_1 = require("../chat/schemas/chat-instructor.schema");
const chat_room_schema_1 = require("../chat/schemas/chat-room.schema");
const chat_message_schema_1 = require("../chat/schemas/chat-message.schema");
const score_schema_1 = require("../brainrush/schemas/score.schema");
const player_session_schema_1 = require("../brainrush/schemas/player-session.schema");
const goal_settings_schema_1 = require("./schemas/goal-settings.schema");
let AdaptiveLearningModule = class AdaptiveLearningModule {
};
exports.AdaptiveLearningModule = AdaptiveLearningModule;
exports.AdaptiveLearningModule = AdaptiveLearningModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                {
                    name: student_profile_schema_1.StudentProfile.name,
                    schema: student_profile_schema_1.StudentProfileSchema,
                },
                {
                    name: student_performance_schema_1.StudentPerformance.name,
                    schema: student_performance_schema_1.StudentPerformanceSchema,
                },
                {
                    name: recommendation_schema_1.Recommendation.name,
                    schema: recommendation_schema_1.RecommendationSchema,
                },
                {
                    name: level_test_schema_1.LevelTest.name,
                    schema: level_test_schema_1.LevelTestSchema,
                },
                {
                    name: question_schema_1.Question.name,
                    schema: question_schema_1.QuestionSchema,
                },
                {
                    name: chat_ai_schema_1.ChatAi.name,
                    schema: chat_ai_schema_1.ChatAiSchema,
                },
                {
                    name: chat_instructor_schema_1.ChatInstructor.name,
                    schema: chat_instructor_schema_1.ChatInstructorSchema,
                },
                {
                    name: chat_room_schema_1.ChatRoom.name,
                    schema: chat_room_schema_1.ChatRoomSchema,
                },
                {
                    name: chat_message_schema_1.ChatMessage.name,
                    schema: chat_message_schema_1.ChatMessageSchema,
                },
                {
                    name: score_schema_1.Score.name,
                    schema: score_schema_1.ScoreSchema,
                },
                {
                    name: player_session_schema_1.PlayerSession.name,
                    schema: player_session_schema_1.PlayerSessionSchema,
                },
                {
                    name: goal_settings_schema_1.GoalSettings.name,
                    schema: goal_settings_schema_1.GoalSettingsSchema,
                },
            ]),
        ],
        controllers: [adaptive_learning_controller_1.AdaptiveLearningController],
        providers: [adaptive_learning_service_1.AdaptiveLearningService],
        exports: [adaptive_learning_service_1.AdaptiveLearningService],
    })
], AdaptiveLearningModule);
//# sourceMappingURL=adaptive-learning.module.js.map