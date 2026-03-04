import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { RiskScoreService } from './riskscore.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

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
}
