import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import { AlertConfigService } from './alert-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

class UpdateAlertConfigDto {
  @IsInt()
  @Min(0)
  @Max(100)
  lowThreshold: number;

  @IsInt()
  @Min(0)
  @Max(100)
  mediumThreshold: number;

  @IsInt()
  @Min(0)
  @Max(100)
  highThreshold: number;
}

@Controller('alert-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertConfigController {
  constructor(private readonly alertConfigService: AlertConfigService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  getConfig() {
    return this.alertConfigService.getConfig();
  }

  @Put()
  @Roles(UserRole.ADMIN)
  updateConfig(@Body() dto: UpdateAlertConfigDto) {
    return this.alertConfigService.updateConfig(dto);
  }
}
