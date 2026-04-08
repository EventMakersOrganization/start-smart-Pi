import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlertConfigController } from './alert-config.controller';
import { AlertConfigService } from './alert-config.service';
import { AlertConfig, AlertConfigSchema } from './alert-config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AlertConfig.name, schema: AlertConfigSchema }]),
  ],
  controllers: [AlertConfigController],
  providers: [AlertConfigService],
  exports: [AlertConfigService],
})
export class AlertConfigModule {}
