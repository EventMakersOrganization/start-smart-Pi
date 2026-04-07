import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { AnalyticsWebhookService } from './analytics-webhook.service';
import { CreateAnalyticsWebhookDto } from './dto/create-analytics-webhook.dto';

@Controller('analytics/webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsWebhookController {
  constructor(private readonly webhookService: AnalyticsWebhookService) {}

  private userId(req: any): string {
    const u = req?.user;
    return String(u?.userId || u?.id || u?._id || '');
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  create(@Req() req: any, @Body() dto: CreateAnalyticsWebhookDto) {
    return this.webhookService.create(this.userId(req), dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  findAll(@Req() req: any) {
    return this.webhookService.findAllForOwner(this.userId(req));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.webhookService.remove(id, this.userId(req));
  }

  @Post(':id/test')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  test(@Req() req: any, @Param('id') id: string) {
    return this.webhookService.testPing(id, this.userId(req));
  }
}
