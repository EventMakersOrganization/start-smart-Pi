"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptiveLearningController = void 0;
const common_1 = require("@nestjs/common");
const adaptive_learning_service_1 = require("./adaptive-learning.service");
const create_student_profile_dto_1 = require("./dto/create-student-profile.dto");
const create_student_performance_dto_1 = require("./dto/create-student-performance.dto");
const create_recommendation_dto_1 = require("./dto/create-recommendation.dto");
const create_question_dto_1 = require("./dto/create-question.dto");
let AdaptiveLearningController = class AdaptiveLearningController {
    constructor(adaptiveService) {
        this.adaptiveService = adaptiveService;
    }
    createProfile(dto) {
        return this.adaptiveService.createProfile(dto);
    }
    findAllProfiles() {
        return this.adaptiveService.findAllProfiles();
    }
    findProfile(userId) {
        return this.adaptiveService.findProfileByUserId(userId);
    }
    updateProfile(userId, updateData) {
        return this.adaptiveService.updateProfile(userId, updateData);
    }
    deleteProfile(userId) {
        return this.adaptiveService.deleteProfile(userId);
    }
    createPerformance(dto) {
        return this.adaptiveService.createPerformance(dto);
    }
    findAllPerformances() {
        return this.adaptiveService.findAllPerformances();
    }
    findPerformanceByStudent(studentId) {
        return this.adaptiveService.findPerformanceByStudent(studentId);
    }
    getAverageScore(studentId) {
        return this.adaptiveService.getAverageScore(studentId);
    }
    deletePerformance(id) {
        return this.adaptiveService.deletePerformance(id);
    }
    adaptDifficulty(studentId) {
        return this.adaptiveService.adaptDifficulty(studentId);
    }
    adaptDifficultyByTopic(studentId, topic) {
        return this.adaptiveService.adaptDifficultyByTopic(studentId, topic);
    }
    generateRecommendations(studentId) {
        return this.adaptiveService.generateRecommendations(studentId);
    }
    generateRecommendationsV2(studentId) {
        return this.adaptiveService.generateRecommendationsV2(studentId);
    }
    generateInitialRecommendationsFromLevelTest(studentId) {
        return this.adaptiveService.generateInitialRecommendationsFromLevelTest(studentId);
    }
    getWeakAreaRecommendations(studentId) {
        return this.adaptiveService.getWeakAreaRecommendations(studentId);
    }
    getExerciseCompletionTracking(studentId) {
        return this.adaptiveService.getExerciseCompletionTracking(studentId);
    }
    getLearningVelocity(studentId) {
        return this.adaptiveService.getLearningVelocity(studentId);
    }
    getAchievementBadges(studentId) {
        return this.adaptiveService.getAchievementBadges(studentId);
    }
    getLearningPath(studentId) {
        return this.adaptiveService.getLearningPath(studentId);
    }
    getCollaborativeRecommendations(studentId) {
        return this.adaptiveService.getCollaborativeRecommendations(studentId);
    }
    getStudyGroupSuggestions(studentId) {
        return this.adaptiveService.getStudyGroupSuggestions(studentId);
    }
    detectLearningStyle(studentId) {
        return this.adaptiveService.detectLearningStyle(studentId);
    }
    getSpacedRepetitionSchedule(studentId) {
        return this.adaptiveService.getSpacedRepetitionSchedule(studentId);
    }
    createRecommendation(dto) {
        return this.adaptiveService.createRecommendation(dto);
    }
    findRecommendationsByStudent(studentId) {
        return this.adaptiveService.findRecommendationsByStudent(studentId);
    }
    markViewed(id) {
        return this.adaptiveService.markRecommendationViewed(id);
    }
    deleteRecommendation(id) {
        return this.adaptiveService.deleteRecommendation(id);
    }
    createQuestion(dto) {
        return this.adaptiveService.createQuestion(dto);
    }
    findAllQuestions() {
        return this.adaptiveService.findAllQuestions();
    }
    createLevelTest(studentId) {
        return this.adaptiveService.createLevelTest(studentId);
    }
    submitLevelTest(id, body) {
        return this.adaptiveService.submitLevelTest(id, body.answers);
    }
    findLevelTest(studentId) {
        return this.adaptiveService.findLevelTestByStudent(studentId);
    }
};
exports.AdaptiveLearningController = AdaptiveLearningController;
__decorate([
    (0, common_1.Post)("profiles"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_student_profile_dto_1.CreateStudentProfileDto]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "createProfile", null);
__decorate([
    (0, common_1.Get)("profiles"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "findAllProfiles", null);
__decorate([
    (0, common_1.Get)("profiles/:userId"),
    __param(0, (0, common_1.Param)("userId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "findProfile", null);
__decorate([
    (0, common_1.Put)("profiles/:userId"),
    __param(0, (0, common_1.Param)("userId")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Delete)("profiles/:userId"),
    __param(0, (0, common_1.Param)("userId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "deleteProfile", null);
__decorate([
    (0, common_1.Post)("performances"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_student_performance_dto_1.CreateStudentPerformanceDto]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "createPerformance", null);
__decorate([
    (0, common_1.Get)("performances"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "findAllPerformances", null);
__decorate([
    (0, common_1.Get)("performances/student/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "findPerformanceByStudent", null);
__decorate([
    (0, common_1.Get)("performances/student/:studentId/average"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "getAverageScore", null);
__decorate([
    (0, common_1.Delete)("performances/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "deletePerformance", null);
__decorate([
    (0, common_1.Post)("adapt/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "adaptDifficulty", null);
__decorate([
    (0, common_1.Get)("adapt/:studentId/topic/:topic"),
    __param(0, (0, common_1.Param)("studentId")),
    __param(1, (0, common_1.Param)("topic")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "adaptDifficultyByTopic", null);
__decorate([
    (0, common_1.Post)("recommendations/generate/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "generateRecommendations", null);
__decorate([
    (0, common_1.Post)("recommendations/generate/v2/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "generateRecommendationsV2", null);
__decorate([
    (0, common_1.Post)("recommendations/from-level-test/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "generateInitialRecommendationsFromLevelTest", null);
__decorate([
    (0, common_1.Get)("recommendations/weak-areas/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "getWeakAreaRecommendations", null);
__decorate([
    (0, common_1.Get)("tracking/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "getExerciseCompletionTracking", null);
__decorate([
    (0, common_1.Get)("velocity/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "getLearningVelocity", null);
__decorate([
    (0, common_1.Get)("badges/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "getAchievementBadges", null);
__decorate([
    (0, common_1.Get)("learning-path/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "getLearningPath", null);
__decorate([
    (0, common_1.Get)("recommendations/collaborative/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "getCollaborativeRecommendations", null);
__decorate([
    (0, common_1.Get)("study-groups/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "getStudyGroupSuggestions", null);
__decorate([
    (0, common_1.Get)("learning-style/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "detectLearningStyle", null);
__decorate([
    (0, common_1.Get)("spaced-repetition/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "getSpacedRepetitionSchedule", null);
__decorate([
    (0, common_1.Post)("recommendations"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recommendation_dto_1.CreateRecommendationDto]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "createRecommendation", null);
__decorate([
    (0, common_1.Get)("recommendations/student/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "findRecommendationsByStudent", null);
__decorate([
    (0, common_1.Patch)("recommendations/:id/viewed"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "markViewed", null);
__decorate([
    (0, common_1.Delete)("recommendations/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "deleteRecommendation", null);
__decorate([
    (0, common_1.Post)("questions"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_question_dto_1.CreateQuestionDto]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "createQuestion", null);
__decorate([
    (0, common_1.Get)("questions"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "findAllQuestions", null);
__decorate([
    (0, common_1.Post)("level-test/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "createLevelTest", null);
__decorate([
    (0, common_1.Post)("level-test/:id/submit"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "submitLevelTest", null);
__decorate([
    (0, common_1.Get)("level-test/student/:studentId"),
    __param(0, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdaptiveLearningController.prototype, "findLevelTest", null);
exports.AdaptiveLearningController = AdaptiveLearningController = __decorate([
    (0, common_1.Controller)("adaptive"),
    __metadata("design:paramtypes", [adaptive_learning_service_1.AdaptiveLearningService])
], AdaptiveLearningController);
//# sourceMappingURL=adaptive-learning.controller.js.map