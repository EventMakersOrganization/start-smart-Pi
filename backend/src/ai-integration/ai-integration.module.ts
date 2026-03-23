import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AIIntegrationService } from './ai-integration.service';
import { AIIntegrationController } from './ai-integration.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 120000,
      maxRedirects: 0,
    }),
  ],
  controllers: [AIIntegrationController],
  providers: [AIIntegrationService],
  exports: [AIIntegrationService],
})
export class AIIntegrationModule {}
