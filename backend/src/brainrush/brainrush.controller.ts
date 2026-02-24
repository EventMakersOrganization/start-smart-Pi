import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { BrainrushService } from './brainrush.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { StartSoloGameDto } from './dto/start-solo-game.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

@Controller('brainrush')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
export class BrainrushController {
  constructor(private readonly brainrushService: BrainrushService) {}

  @Post('start-solo')
  async startSoloGame(@Body() dto: StartSoloGameDto, @Request() req) {
    return this.brainrushService.startSoloGame(req.user.id, dto.initialDifficulty);
  }

  @Post('create-room')
  async createRoom(@Body() dto: CreateRoomDto, @Request() req) {
    return this.brainrushService.createRoom(req.user.id, dto);
  }

  @Post('join-room')
  async joinRoom(@Body() dto: JoinRoomDto, @Request() req) {
    return this.brainrushService.joinRoom(req.user.id, dto.roomCode);
  }

  @Post('submit-answer')
  async submitAnswer(@Body() dto: SubmitAnswerDto, @Request() req) {
    return this.brainrushService.submitAnswer(req.user.id, dto);
  }

  @Get('leaderboard')
  async getLeaderboard() {
    return this.brainrushService.getLeaderboard();
  }
}
