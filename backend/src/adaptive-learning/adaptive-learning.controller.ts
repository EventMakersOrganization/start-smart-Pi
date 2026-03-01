import {
  Controller, Get, Post, Put,
  Delete, Patch, Param, Body
} from '@nestjs/common';
import { AdaptiveLearningService }
  from './adaptive-learning.service';
import { CreateStudentProfileDto }
  from './dto/create-student-profile.dto';
import { CreateStudentPerformanceDto }
  from './dto/create-student-performance.dto';
import { CreateRecommendationDto }
  from './dto/create-recommendation.dto';
import { CreateQuestionDto }
  from './dto/create-question.dto';

@Controller('adaptive')
export class AdaptiveLearningController {

  constructor(
    private readonly adaptiveService: AdaptiveLearningService
  ) { }

  // ── StudentProfile ──────────────────
  @Post('profiles')
  createProfile(@Body() dto: CreateStudentProfileDto) {
    return this.adaptiveService.createProfile(dto);
  }

  @Get('profiles')
  findAllProfiles() {
    return this.adaptiveService.findAllProfiles();
  }

  @Get('profiles/:userId')
  findProfile(@Param('userId') userId: string) {
    return this.adaptiveService.findProfileByUserId(userId);
  }

  @Put('profiles/:userId')
  updateProfile(
    @Param('userId') userId: string,
    @Body() updateData: any
  ) {
    return this.adaptiveService.updateProfile(userId, updateData);
  }

  @Delete('profiles/:userId')
  deleteProfile(@Param('userId') userId: string) {
    return this.adaptiveService.deleteProfile(userId);
  }

  // ── StudentPerformance ──────────────
  @Post('performances')
  createPerformance(@Body() dto: CreateStudentPerformanceDto) {
    return this.adaptiveService.createPerformance(dto);
  }

  @Get('performances')
  findAllPerformances() {
    return this.adaptiveService.findAllPerformances();
  }

  @Get('performances/student/:studentId')
  findPerformanceByStudent(
    @Param('studentId') studentId: string
  ) {
    return this.adaptiveService
      .findPerformanceByStudent(studentId);
  }

  @Get('performances/student/:studentId/average')
  getAverageScore(@Param('studentId') studentId: string) {
    return this.adaptiveService.getAverageScore(studentId);
  }

  @Delete('performances/:id')
  deletePerformance(@Param('id') id: string) {
    return this.adaptiveService.deletePerformance(id);
  }

  // ── Recommendation ──────────────────
  @Post('recommendations')
  createRecommendation(@Body() dto: CreateRecommendationDto) {
    return this.adaptiveService.createRecommendation(dto);
  }

  @Get('recommendations/student/:studentId')
  findRecommendationsByStudent(
    @Param('studentId') studentId: string
  ) {
    return this.adaptiveService
      .findRecommendationsByStudent(studentId);
  }

  @Patch('recommendations/:id/viewed')
  markViewed(@Param('id') id: string) {
    return this.adaptiveService.markRecommendationViewed(id);
  }

  @Delete('recommendations/:id')
  deleteRecommendation(@Param('id') id: string) {
    return this.adaptiveService.deleteRecommendation(id);
  }

  // ── Question Bank ─────────────────────
  @Post('questions')
  createQuestion(@Body() dto: CreateQuestionDto) {
    return this.adaptiveService.createQuestion(dto);
  }

  @Get('questions')
  findAllQuestions() {
    return this.adaptiveService.findAllQuestions();
  }

  // ── LevelTest ───────────────────────
  @Post('level-test/:studentId')
  createLevelTest(@Param('studentId') studentId: string) {
    return this.adaptiveService.createLevelTest(studentId);
  }

  @Post('level-test/:id/submit')
  submitLevelTest(
    @Param('id') id: string,
    @Body() body: { answers: any[] }
  ) {
    return this.adaptiveService
      .submitLevelTest(id, body.answers);
  }

  @Get('level-test/student/:studentId')
  findLevelTest(@Param('studentId') studentId: string) {
    return this.adaptiveService
      .findLevelTestByStudent(studentId);
  }
}