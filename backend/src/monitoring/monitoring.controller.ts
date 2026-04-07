import { Controller, Get, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { AiMonitorProxyService } from './ai-monitor-proxy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@Controller('monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly aiMonitorProxy: AiMonitorProxyService,
  ) {}

  @Get('system')
  @Roles(UserRole.ADMIN)
  async getSystemMetrics() {
    const metrics = await this.monitoringService.getSystemMetrics();

    return {
      ...metrics,
      timestamp: new Date().toISOString(),
    };
  }

  /** Proxy to ai-service /monitor/health + /monitor/throughput (see AI_SERVICE_URL). */
  @Get('ai-service')
  @Roles(UserRole.ADMIN)
  async getAiServiceMonitor() {
    return this.aiMonitorProxy.getSnapshot();
  }
}
