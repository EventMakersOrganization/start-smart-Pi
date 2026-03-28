import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ChatService } from "./chat.service";
import {
  AiService,
  ClassifyDifficultyPayload,
  ClassifyDifficultyBatchPayload,
  EvaluateAnswerPayload,
  EvaluateBatchPayload,
  MonitorErrorsQuery,
  MonitorThroughputQuery,
  FeedbackStatsQuery,
  MonitorStatsQuery,
  LearningEventPayload,
  RecordFeedbackPayload,
  UserRatingPayload,
} from "./ai.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("chat")
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly aiService: AiService,
  ) {}

  @Post("ai/session")
  async createAiSession(@Request() req, @Body() body: { title?: string }) {
    return this.chatService.createAiSession(req.user.id, body.title);
  }

  @Post("instructor/session")
  async createInstructorSession(
    @Request() req,
    @Body() body: { instructorId: string },
  ) {
    return this.chatService.createInstructorSession(
      req.user.id,
      body.instructorId,
    );
  }

  @Post("room")
  async createRoom(
    @Request() req,
    @Body() body: { name: string; participants: string[] },
  ) {
    return this.chatService.createRoom(body.name, [
      req.user.id,
      ...body.participants,
    ]);
  }

  @Get("sessions")
  async getUserSessions(@Request() req) {
    return this.chatService.getUserSessions(req.user.id);
  }

  @Get("history/:sessionType/:sessionId")
  async getChatHistory(
    @Request() req,
    @Param("sessionType") sessionType: string,
    @Param("sessionId") sessionId: string,
  ) {
    return this.chatService.getChatHistory(sessionType, sessionId, req.user.id);
  }

  @Post("send")
  async sendMessage(
    @Request() req,
    @Body() body: { sessionType: string; sessionId: string; content: string },
  ) {
    return this.chatService.saveMessage({
      sessionType: body.sessionType,
      sessionId: body.sessionId,
      sender: req.user.id,
      content: body.content,
    });
  }

  @Get("ai/search")
  async semanticSearch(
    @Query("q") query: string,
    @Query("n") nResults?: string,
  ) {
    const results = await this.aiService.semanticSearch(
      query,
      nResults ? parseInt(nResults, 10) : 10,
    );
    return { results };
  }

  @Get("ai/health")
  async aiHealth() {
    return this.aiService.healthCheck();
  }

  @Get("ai/latency")
  async aiLatencyStats() {
    return { status: "success", stats: this.aiService.getAiLatencyStats() };
  }

  @Get("ai/monitor/stats")
  async monitorStats(@Query("minutes") minutes?: string) {
    const payload: MonitorStatsQuery = {
      minutes: minutes ? Number(minutes) : 60,
    };
    return this.aiService.getMonitorStats(payload);
  }

  @Get("ai/monitor/health")
  async monitorHealth() {
    return this.aiService.getMonitorHealth();
  }

  @Get("ai/monitor/errors")
  async monitorErrors(@Query("last_n") lastN?: string) {
    const payload: MonitorErrorsQuery = {
      last_n: lastN ? Number(lastN) : 50,
    };
    return this.aiService.getMonitorErrors(payload);
  }

  @Get("ai/monitor/throughput")
  async monitorThroughput(@Query("minutes") minutes?: string) {
    const payload: MonitorThroughputQuery = {
      minutes: minutes ? Number(minutes) : 60,
    };
    return this.aiService.getMonitorThroughput(payload);
  }

  // ----- Sprint 7: Level-test routes -----

  @Post("ai/level-test/start")
  async levelTestStart(@Request() req, @Body() body: { subjects?: string[] }) {
    return this.aiService.startLevelTest(req.user.id, body.subjects);
  }

  @Post("ai/level-test/submit-answer")
  async levelTestSubmitAnswer(
    @Body() body: { session_id: string; answer: string },
  ) {
    return this.aiService.submitAnswer(body.session_id, body.answer);
  }

  @Post("ai/level-test/complete")
  async levelTestComplete(@Body() body: { session_id: string }) {
    return this.aiService.completeLevelTest(body.session_id);
  }

  @Get("ai/level-test/session/:sessionId")
  async levelTestSession(@Param("sessionId") sessionId: string) {
    return this.aiService.getLevelTestSession(sessionId);
  }

  @Post("ai/recommendations")
  async personalizedRecommendations(
    @Body() body: { student_profile: Record<string, any>; n_results?: number },
  ) {
    return this.aiService.getPersonalizedRecommendations(
      body.student_profile,
      body.n_results ?? 5,
    );
  }

  @Post("ai/adaptive/event")
  async recordAdaptiveLearningEvent(
    @Request() req,
    @Body() body: LearningEventPayload,
  ) {
    return this.aiService.recordLearningEvent(req.user.id, body);
  }

  @Post("ai/evaluate/answer")
  async evaluateAnswer(@Body() body: EvaluateAnswerPayload) {
    return this.aiService.evaluateAnswer(body);
  }

  @Post("ai/evaluate/batch")
  async evaluateBatch(@Body() body: EvaluateBatchPayload) {
    return this.aiService.evaluateBatch(body);
  }

  @Post("ai/classify/difficulty")
  async classifyDifficulty(@Body() body: ClassifyDifficultyPayload) {
    return this.aiService.classifyDifficulty(body);
  }

  @Post("ai/classify/suggest-adjustment")
  async classifySuggestAdjustment(@Body() body: ClassifyDifficultyPayload) {
    return this.aiService.classifySuggestAdjustment(body);
  }

  @Post("ai/classify/difficulty-batch")
  async classifyDifficultyBatch(@Body() body: ClassifyDifficultyBatchPayload) {
    return this.aiService.classifyDifficultyBatch(body);
  }

  @Post("ai/feedback/record")
  async recordFeedback(@Body() body: RecordFeedbackPayload) {
    return this.aiService.recordFeedback(body);
  }

  @Post("ai/feedback/user-rating")
  async recordUserRating(@Body() body: UserRatingPayload) {
    return this.aiService.recordUserRating(body);
  }

  @Get("ai/feedback/recommendations")
  async getFeedbackRecommendations() {
    return this.aiService.getFeedbackRecommendations();
  }

  @Get("ai/feedback/stats/:signalType")
  async getFeedbackStats(
    @Param("signalType") signalType: string,
    @Query("last_n") lastN?: string,
  ) {
    const payload: FeedbackStatsQuery = {
      signal_type: signalType,
      last_n: lastN ? Number(lastN) : 200,
    };
    return this.aiService.getFeedbackStats(payload);
  }

  @Get("ai/adaptive/state")
  async getAdaptiveLearningState(@Request() req) {
    return this.aiService.getLearningState(req.user.id);
  }

  @Get("ai/analytics/learning/:studentId")
  async getLearningAnalytics(
    @Request() req,
    @Param("studentId") studentId: string,
    @Query("refresh") refresh?: string,
  ) {
    const resolvedStudentId =
      studentId && studentId !== "me" ? studentId : req.user.id;
    return this.aiService.getLearningAnalytics(
      resolvedStudentId,
      this.isTruthy(refresh),
    );
  }

  @Get("ai/analytics/pace/:studentId")
  async getPaceAnalytics(
    @Request() req,
    @Param("studentId") studentId: string,
    @Query("refresh") refresh?: string,
  ) {
    const resolvedStudentId =
      studentId && studentId !== "me" ? studentId : req.user.id;
    return this.aiService.getPaceAnalytics(
      resolvedStudentId,
      this.isTruthy(refresh),
    );
  }

  @Get("ai/analytics/concepts/:studentId")
  async getConceptsAnalytics(
    @Request() req,
    @Param("studentId") studentId: string,
    @Query("refresh") refresh?: string,
  ) {
    const resolvedStudentId =
      studentId && studentId !== "me" ? studentId : req.user.id;
    return this.aiService.getConceptsAnalytics(
      resolvedStudentId,
      this.isTruthy(refresh),
    );
  }

  @Get("ai/interventions/effectiveness/:studentId")
  async getInterventionsEffectiveness(
    @Request() req,
    @Param("studentId") studentId: string,
  ) {
    const resolvedStudentId =
      studentId && studentId !== "me" ? studentId : req.user.id;
    return this.aiService.getInterventionsEffectiveness(resolvedStudentId);
  }

  @Get("ai/interventions/effectiveness")
  async getInterventionsEffectivenessGlobal() {
    return this.aiService.getInterventionsEffectivenessGlobal();
  }

  private isTruthy(value?: string): boolean {
    if (!value) {
      return false;
    }
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  }
}
