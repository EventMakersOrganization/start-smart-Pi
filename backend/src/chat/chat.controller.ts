import {
  Controller,
  Post,
  Get,
  Body,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  UnauthorizedException,
  Patch,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { ChatService } from "./chat.service";
import { AiService } from "./ai.service";
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
      req.user.role,
    );
  }

  @Get('instructors/available')
  async getAvailableInstructors(@Request() req) {
    return this.chatService.getAvailableInstructors(req.user.id, req.user.role);
  }

  @Post("room")
  async createRoom(
    @Request() req,
    @Body() body: { name: string; participants: string[] },
  ) {
    if (req.user.role !== "student") {
      throw new UnauthorizedException("Only students can create group chats.");
    }
    return this.chatService.createRoomForStudent(
      req.user.id,
      body.name,
      body.participants,
    );
  }

  @Get("sessions")
  async getUserSessions(@Request() req) {
    return this.chatService.getUserSessions(req.user.id, req.user.role);
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
    const isAllowed = await this.chatService.isParticipant(
      body.sessionType,
      body.sessionId,
      req.user.id,
    );
    if (!isAllowed) {
      throw new UnauthorizedException(
        "You are not a participant in this chat.",
      );
    }
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

  private resolveStudentId(raw: string, req: any): string {
    if (!raw || raw === "me") {
      return req.user.id;
    }
    return raw;
  }

  @Get("ai/learning-state/:studentId")
  async learningState(@Request() req, @Param("studentId") studentId: string) {
    return this.aiService.getLearningState(
      this.resolveStudentId(studentId, req),
    );
  }

  @Get("ai/analytics/learning/:studentId")
  async learningAnalytics(
    @Request() req,
    @Param("studentId") studentId: string,
    @Query("refresh") refresh?: string,
  ) {
    return this.aiService.getLearningAnalytics(
      this.resolveStudentId(studentId, req),
      refresh === "true",
    );
  }

  @Get("ai/analytics/pace/:studentId")
  async paceAnalytics(
    @Request() req,
    @Param("studentId") studentId: string,
    @Query("refresh") refresh?: string,
  ) {
    return this.aiService.getPaceAnalytics(
      this.resolveStudentId(studentId, req),
      refresh === "true",
    );
  }

  @Get("ai/analytics/concepts/:studentId")
  async conceptsAnalytics(
    @Request() req,
    @Param("studentId") studentId: string,
    @Query("refresh") refresh?: string,
  ) {
    return this.aiService.getConceptsAnalytics(
      this.resolveStudentId(studentId, req),
      refresh === "true",
    );
  }

  @Get("ai/interventions/effectiveness/:studentId")
  async interventionsEffectiveness(
    @Request() req,
    @Param("studentId") studentId: string,
  ) {
    return this.aiService.getInterventionsEffectiveness(
      this.resolveStudentId(studentId, req),
    );
  }

  @Get("ai/interventions/effectiveness")
  async interventionsEffectivenessGlobal() {
    return this.aiService.getInterventionsEffectivenessGlobal();
  }

  @Delete('message/:id')
  async deleteMessage(@Request() req, @Param('id') messageId: string) {
    return this.chatService.deleteMessage(messageId, req.user.id);
  }

  @Delete('ai/session/:id')
  async deleteAiSession(@Request() req, @Param('id') sessionId: string) {
    return this.chatService.deleteAiSession(sessionId, req.user.id);
  }

  @Delete('instructor/session/:id')
  async deleteInstructorSession(@Request() req, @Param('id') sessionId: string) {
    return this.chatService.deleteInstructorSession(sessionId, req.user.id);
  }

  @Delete('room/:id')
  async deleteRoom(@Request() req, @Param('id') roomId: string) {
    return this.chatService.deleteRoom(roomId, req.user.id);
  }

  @Patch("room/:id/members")
  async addMembers(
    @Request() req,
    @Param("id") roomId: string,
    @Body() body: { participants: string[] },
  ) {
    return this.chatService.addParticipantsToRoom(
      req.user.id,
      roomId,
      body.participants,
    );
  }

  @Post("room/:id/leave")
  async leaveRoom(@Request() req, @Param("id") roomId: string) {
    return this.chatService.leaveRoom(req.user.id, roomId);
  }

  @Patch("room/:id/rename")
  async renameRoom(
    @Request() req,
    @Param("id") roomId: string,
    @Body() body: { name: string },
  ) {
    return this.chatService.renameRoom(req.user.id, roomId, body.name);
  }

  @Post("room/:id/avatar")
  @UseInterceptors(
    FileInterceptor("avatar", {
      storage: diskStorage({
        destination: "./uploads/chat-avatars",
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async uploadAvatar(
    @Request() req,
    @Param("id") roomId: string,
    @UploadedFile() file: any,
  ) {
    const avatarUrl = `http://localhost:3000/uploads/chat-avatars/${file.filename}`;
    return this.chatService.updateAvatar(req.user.id, roomId, avatarUrl);
  }

  @Post("upload-attachments")
  @UseInterceptors(
    FilesInterceptor("files", 10, {
      storage: diskStorage({
        destination: "./uploads/chat-attachments",
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async uploadAttachments(@UploadedFiles() files: any[]) {
    return files.map((file) => ({
      url: `http://localhost:3000/uploads/chat-attachments/${file.filename}`,
      filename: file.originalname,
      fileType: file.mimetype,
    }));
  }
}
