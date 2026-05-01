import { Controller, Post, Body, UseGuards, Req, Param, Get } from '@nestjs/common';
import { BrainrushService } from './brainrush.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { LeaderboardService } from './services/leaderboard.service';

@Controller('brainrush')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
export class BrainrushController {
  constructor(
    private readonly brainrushService: BrainrushService,
    private readonly leaderboardService: LeaderboardService,
  ) { }

  @Post('create-room')
  createRoom(@Body() dto: CreateRoomDto, @Req() req: any) {
    return this.brainrushService.createRoom(dto, req.user.id || req.user._id);
  }

  @Post('join-room')
  joinRoom(@Body() dto: JoinRoomDto, @Req() req: any) {
    return this.brainrushService.joinRoom(dto, req.user.id || req.user._id);
  }

  @Post(':sessionId/initialize-solo')
  initializeSolo(
    @Param('sessionId') sessionId: string,
    @Body() body: { topic: string; difficulty: string },
    @Req() req: any
  ) {
    return this.brainrushService.generateSoloSession(sessionId, req.user.id || req.user._id, body.topic, body.difficulty);
  }

  @Get(':sessionId/next-question')
  getNextQuestion(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.brainrushService.getNextQuestion(sessionId, req.user.id || req.user._id);
  }

  @Post(':sessionId/submit-answer')
  submitAnswer(
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitAnswerDto,
    @Req() req: any,
  ) {
    return this.brainrushService.submitAnswer(sessionId, req.user.id || req.user._id, dto);
  }

  @Post(':sessionId/finish')
  finishGame(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.brainrushService.finishGame(sessionId, req.user.id || req.user._id);
  }

  @Get('stats/solo')
  getSoloStats(@Req() req: any) {
    return this.brainrushService.getSoloStats(req.user.id || req.user._id);
  }

  @Get(':sessionId/leaderboard')
  getLeaderboard(@Param('sessionId') sessionId: string) {
    return this.leaderboardService.getLeaderboard(sessionId);
  }
}
