import { Controller, Post, Get, Body, Param, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('ai/session')
  async createAiSession(@Request() req, @Body() body: { title?: string }) {
    return this.chatService.createAiSession(req.user.id, body.title);
  }

  @Post('instructor/session')
  async createInstructorSession(@Request() req, @Body() body: { instructorId: string }) {
    return this.chatService.createInstructorSession(req.user.id, body.instructorId);
  }

  @Post('room')
  async createRoom(@Request() req, @Body() body: { name: string; participants: string[] }) {
    if (req.user.role !== 'student') {
      throw new UnauthorizedException('Only students can create group chats.');
    }
    return this.chatService.createRoom(body.name, [req.user.id, ...body.participants]);
  }

  @Get('sessions')
  async getUserSessions(@Request() req) {
    return this.chatService.getUserSessions(req.user.id, req.user.role);
  }

  @Get('history/:sessionType/:sessionId')
  async getChatHistory(@Request() req, @Param('sessionType') sessionType: string, @Param('sessionId') sessionId: string) {
    return this.chatService.getChatHistory(sessionType, sessionId, req.user.id);
  }

  @Post('send')
  async sendMessage(@Request() req, @Body() body: { sessionType: string, sessionId: string, content: string }) {
    const isAllowed = await this.chatService.isParticipant(body.sessionType, body.sessionId, req.user.id);
    if (!isAllowed) {
      throw new UnauthorizedException('You are not a participant in this chat.');
    }
    return this.chatService.saveMessage({
      sessionType: body.sessionType,
      sessionId: body.sessionId,
      sender: req.user.id,
      content: body.content,
    });
  }
}
