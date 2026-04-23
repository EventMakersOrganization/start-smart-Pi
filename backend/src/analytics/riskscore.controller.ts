import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { RiskScoreService } from './riskscore.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { ActivityData } from './services/risk-algorithm.service';

@Controller('riskscores')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RiskScoreController {
  constructor(private readonly riskScoreService: RiskScoreService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  create(@Body() createRiskScoreDto: any) {
    return this.riskScoreService.create(createRiskScoreDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  findAll() {
    return this.riskScoreService.findAll();
  }

  @Get('count')
  @Roles(UserRole.ADMIN)
  count() {
    return this.riskScoreService.count();
  }

  @Post('recalculate')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  recalculate(@Body() body?: { limit?: number }) {
    return this.riskScoreService.recalculateAllStudentRiskScores(body?.limit);
  }

  @Get('at-risk-insights')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  getAtRiskInsights(
    @Query('level') level?: 'high' | 'medium',
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    const safeLevel = level === 'medium' ? 'medium' : 'high';
    return this.riskScoreService.getAtRiskStudentInsights(safeLevel, limit || 25);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  findOne(@Param('id') id: string) {
    return this.riskScoreService.findOne(id);
  }

  @Get('user/:userId')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  findByUser(@Param('userId') userId: string) {
    return this.riskScoreService.findByUser(userId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  update(@Param('id') id: string, @Body() updateRiskScoreDto: any) {
    return this.riskScoreService.update(id, updateRiskScoreDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.riskScoreService.remove(id);
  }

  @Post('calculate')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  calculateRiskScore(@Body() activityData: ActivityData) {
    return this.riskScoreService.calculateAndSaveRiskScore(activityData);
  }

  @Post('calculate-batch')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  calculateBatchRiskScores(@Body() activityDataList: ActivityData[]) {
    return this.riskScoreService.calculateAndSaveBatchRiskScores(activityDataList);
  }
}
