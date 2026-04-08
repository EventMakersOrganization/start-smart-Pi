import { Controller, Get, UseGuards } from '@nestjs/common';
import { KpiService } from './services/kpi.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@Controller('analytics/kpis')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KpiController {
  constructor(private readonly kpiService: KpiService) {}

  /**
   * Get all KPIs at once
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  getAllKpis() {
    return this.kpiService.getAllKpis();
  }

  /**
   * Get total users count
   */
  @Get('total-users')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  getTotalUsers() {
    return this.kpiService.getTotalUsers();
  }

  /**
   * Get active users count (last 24 hours)
   */
  @Get('active-users')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  getActiveUsers() {
    return this.kpiService.getActiveUsers();
  }

  /**
   * Get high risk users count
   */
  @Get('high-risk-users')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  getHighRiskUsers() {
    return this.kpiService.getHighRiskUsers();
  }

  /**
   * Get total alerts count
   */
  @Get('total-alerts')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  getTotalAlerts() {
    return this.kpiService.getTotalAlerts();
  }

  /**
   * Get risk distribution (low, medium, high percentages)
   */
  @Get('risk-distribution')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  getRiskDistribution() {
    return this.kpiService.getRiskDistribution();
  }
}
