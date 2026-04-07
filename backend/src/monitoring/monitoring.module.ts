import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { AiMonitorProxyService } from './ai-monitor-proxy.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Alert, AlertSchema } from '../analytics/schemas/alert.schema';
import { RiskScore, RiskScoreSchema } from '../analytics/schemas/riskscore.schema';

@Module({
  imports: [
    HttpModule.register({ timeout: 12000, maxRedirects: 0 }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Alert.name, schema: AlertSchema },
      { name: RiskScore.name, schema: RiskScoreSchema },
    ]),
  ],
  controllers: [MonitoringController],
  providers: [MonitoringService, AiMonitorProxyService],
  exports: [MonitoringService, AiMonitorProxyService],
})
export class MonitoringModule {}
