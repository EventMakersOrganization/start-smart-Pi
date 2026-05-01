import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
} from "@nestjs/common";
import { AdaptiveLearningService } from "./adaptive-learning.service";
import { CreateStudentProfileDto } from "./dto/create-student-profile.dto";
import { CreateStudentPerformanceDto } from "./dto/create-student-performance.dto";
import { CreateRecommendationDto } from "./dto/create-recommendation.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";

@Controller("adaptive")
export class AdaptiveLearningController {
  constructor(private readonly adaptiveService: AdaptiveLearningService) {}

  // ── StudentProfile ──────────────────
  @Post("profiles")
  createProfile(@Body() dto: CreateStudentProfileDto) {
    return this.adaptiveService.createProfile(dto);
  }

  @Get("profiles")
  findAllProfiles() {
    return this.adaptiveService.findAllProfiles();
  }

  @Get("profiles/:userId")
  findProfile(@Param("userId") userId: string) {
    return this.adaptiveService.findProfileByUserId(userId);
  }

  @Put("profiles/:userId")
  updateProfile(@Param("userId") userId: string, @Body() updateData: any) {
    return this.adaptiveService.updateProfile(userId, updateData);
  }

  @Delete("profiles/:userId")
  deleteProfile(@Param("userId") userId: string) {
    return this.adaptiveService.deleteProfile(userId);
  }

  @Get("goals/:studentId")
  getGoalSettings(@Param("studentId") studentId: string) {
    return this.adaptiveService.getGoalSettings(studentId);
  }

  @Put("goals/:studentId")
  saveGoalSettings(@Param("studentId") studentId: string, @Body() goals: any) {
    return this.adaptiveService.saveGoalSettings(studentId, goals);
  }

  @Delete("goals/:studentId")
  resetGoalSettings(@Param("studentId") studentId: string) {
    return this.adaptiveService.resetGoalSettings(studentId);
  }

  // ── StudentPerformance ──────────────
  @Post("performances")
  createPerformance(@Body() dto: CreateStudentPerformanceDto) {
    return this.adaptiveService.createPerformance(dto);
  }

  @Get("performances")
  findAllPerformances() {
    return this.adaptiveService.findAllPerformances();
  }

  @Get("performances/student/:studentId")
  findPerformanceByStudent(@Param("studentId") studentId: string) {
    return this.adaptiveService.findPerformanceByStudent(studentId);
  }

  @Get("performances/:id")
  findPerformanceById(@Param("id") id: string) {
    return this.adaptiveService.findPerformanceById(id);
  }

  @Get("performances/student/:studentId/average")
  getAverageScore(@Param("studentId") studentId: string) {
    return this.adaptiveService.getAverageScore(studentId);
  }

  @Delete("performances/:id")
  deletePerformance(@Param("id") id: string) {
    return this.adaptiveService.deletePerformance(id);
  }

  @Patch("performances/:id")
  updatePerformance(@Param("id") id: string, @Body() updateData: any) {
    return this.adaptiveService.updatePerformance(id, updateData);
  }

  // ── Difficulty Adaptation ───────────
  @Post("adapt/:studentId")
  adaptDifficulty(@Param("studentId") studentId: string) {
    return this.adaptiveService.adaptDifficulty(studentId);
  }

  @Get("adapt/:studentId/topic/:topic")
  adaptDifficultyByTopic(
    @Param("studentId") studentId: string,
    @Param("topic") topic: string,
  ) {
    return this.adaptiveService.adaptDifficultyByTopic(studentId, topic);
  }

  // ── Generate Recommendations ────────
  @Post("recommendations/generate/:studentId")
  generateRecommendations(@Param("studentId") studentId: string) {
    return this.adaptiveService.generateRecommendations(studentId);
  }

  @Post("recommendations/generate/v2/:studentId")
  generateRecommendationsV2(@Param("studentId") studentId: string) {
    return this.adaptiveService.generateRecommendationsV2(studentId);
  }

  @Post("recommendations/from-level-test/:studentId")
  generateInitialRecommendationsFromLevelTest(
    @Param("studentId") studentId: string,
  ) {
    return this.adaptiveService.generateInitialRecommendationsFromLevelTest(
      studentId,
    );
  }

  @Get("recommendations/weak-areas/:studentId")
  getWeakAreaRecommendations(@Param("studentId") studentId: string) {
    return this.adaptiveService.getWeakAreaRecommendations(studentId);
  }

  @Get("tracking/:studentId")
  getExerciseCompletionTracking(@Param("studentId") studentId: string) {
    return this.adaptiveService.getExerciseCompletionTracking(studentId);
  }

  @Get("velocity/:studentId")
  getLearningVelocity(@Param("studentId") studentId: string) {
    return this.adaptiveService.getLearningVelocity(studentId);
  }

  @Get("badges/:studentId")
  getAchievementBadges(@Param("studentId") studentId: string) {
    return this.adaptiveService.getAchievementBadges(studentId);
  }

  @Get("learning-path/:studentId")
  getLearningPath(@Param("studentId") studentId: string) {
    return this.adaptiveService.getLearningPath(studentId);
  }

  @Get("recommendations/collaborative/:studentId")
  getCollaborativeRecommendations(@Param("studentId") studentId: string) {
    return this.adaptiveService.getCollaborativeRecommendations(studentId);
  }

  @Get("study-groups/:studentId")
  getStudyGroupSuggestions(@Param("studentId") studentId: string) {
    return this.adaptiveService.getStudyGroupSuggestions(studentId);
  }

  @Get("learning-style/:studentId")
  detectLearningStyle(@Param("studentId") studentId: string) {
    return this.adaptiveService.detectLearningStyle(studentId);
  }

  // ── Recommendation ──────────────────
  @Get("spaced-repetition/:studentId")
  getSpacedRepetitionSchedule(@Param("studentId") studentId: string) {
    return this.adaptiveService.getSpacedRepetitionSchedule(studentId);
  }
  @Post("recommendations")
  createRecommendation(@Body() dto: CreateRecommendationDto) {
    return this.adaptiveService.createRecommendation(dto);
  }

  @Get("recommendations")
  findAllRecommendations() {
    return this.adaptiveService.findAllRecommendations();
  }

  @Get("recommendations/student/:studentId")
  findRecommendationsByStudent(@Param("studentId") studentId: string) {
    return this.adaptiveService.findRecommendationsByStudent(studentId);
  }

  @Get("students/:studentId/unified-profile")
  getUnifiedStudentProfile(@Param("studentId") studentId: string) {
    return this.adaptiveService.getUnifiedStudentProfile(studentId);
  }

  @Get("students/:studentId/comparison")
  getStudentComparisonAnalytics(@Param("studentId") studentId: string) {
    return this.adaptiveService.getStudentComparisonAnalytics(studentId);
  }

  @Get("recommendations/:id")
  findRecommendationById(@Param("id") id: string) {
    return this.adaptiveService.findRecommendationById(id);
  }

  @Patch("recommendations/:id/viewed")
  markViewed(@Param("id") id: string) {
    return this.adaptiveService.markRecommendationViewed(id);
  }

  @Patch("recommendations/:id")
  updateRecommendation(@Param("id") id: string, @Body() updateData: any) {
    return this.adaptiveService.updateRecommendation(id, updateData);
  }

  @Delete("recommendations/:id")
  deleteRecommendation(@Param("id") id: string) {
    return this.adaptiveService.deleteRecommendation(id);
  }

  // ── Question Bank ─────────────────────
  @Post("questions")
  createQuestion(@Body() dto: CreateQuestionDto) {
    return this.adaptiveService.createQuestion(dto);
  }

  @Get("questions")
  findAllQuestions() {
    return this.adaptiveService.findAllQuestions();
  }

  // ── LevelTest ───────────────────────
  @Post("level-test/:studentId")
  createLevelTest(@Param("studentId") studentId: string) {
    return this.adaptiveService.createLevelTest(studentId);
  }

  @Post("level-test/:id/submit")
  submitLevelTest(@Param("id") id: string, @Body() body: { answers: any[] }) {
    return this.adaptiveService.submitLevelTest(id, body.answers);
  }

  @Get("level-test/student/:studentId")
  findLevelTest(@Param("studentId") studentId: string) {
    return this.adaptiveService.findLevelTestByStudent(studentId);
  }

  @Get("level-test/student/:studentId/latest-completed")
  findLatestCompletedLevelTest(@Param("studentId") studentId: string) {
    return this.adaptiveService.findLatestCompletedLevelTestByStudent(
      studentId,
    );
  }

  @Post("level-test/student/:studentId/sync-profile")
  syncProfileFromAiLevelTest(
    @Param("studentId") studentId: string,
    @Body() body: { profile: any; sessionId?: string; levelTestResult?: any },
  ) {
    return this.adaptiveService.syncProfileFromAiLevelTest(
      studentId,
      body?.profile,
      body?.sessionId,
      body?.levelTestResult,
    );
  }

  @Post("post-evaluation/student/:studentId/sync-profile")
  syncProfileFromAiPostEvaluation(
    @Param("studentId") studentId: string,
    @Body()
    body: { profile: any; sessionId?: string; postEvaluationResult?: any },
  ) {
    return this.adaptiveService.syncProfileFromAiPostEvaluation(
      studentId,
      body?.profile,
      body?.sessionId,
      body?.postEvaluationResult,
    );
  }

  @Get("post-evaluation/student/:studentId/latest-completed")
  findLatestCompletedPostEvaluation(@Param("studentId") studentId: string) {
    return this.adaptiveService.findLatestCompletedPostEvaluationByStudent(
      studentId,
    );
  }
}
