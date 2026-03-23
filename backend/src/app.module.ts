import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ActivityModule } from './activity/activity.module';
import { AIIntegrationModule } from './ai-integration/ai-integration.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI', 'mongodb://localhost/user-management'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    ActivityModule,
    AIIntegrationModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
