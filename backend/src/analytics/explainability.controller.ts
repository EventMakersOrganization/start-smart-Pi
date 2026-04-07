import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { ExplainabilityService } from './services/explainability.service';

@Controller('explainability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExplainabilityController {
  constructor(private readonly explainabilityService: ExplainabilityService) {}

  /**
   * Build a full explainability report for admins.
   */
  @Get('report/:userId')
  @Roles(UserRole.ADMIN)
  async getDetailedReport(@Param('userId') userId: string) {
    return this.explainabilityService.generateDetailedReport(userId);
  }
}
