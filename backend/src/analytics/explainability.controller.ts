import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { ExplainabilityService } from './services/explainability.service';

@Controller('analytics/explainability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExplainabilityController {
  constructor(private readonly explainabilityService: ExplainabilityService) {}

  /**
   * Recent explainability logs (admin / instructor dashboards).
   */
  @Get('recent')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getRecent(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.explainabilityService.listRecentLogs(limit ?? 50);
  }

  /**
   * Build a full explainability report for admins.
   */
  @Get('report/:userId')
  @Roles(UserRole.ADMIN)
  async getDetailedReport(@Param('userId') userId: string) {
    return this.explainabilityService.generateDetailedReport(userId);
  }
}
