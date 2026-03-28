import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ActivityModule } from './activity/activity.module';
import { AppController } from './app.controller';
import { ChatModule } from './chat/chat.module';
import { BrainrushModule } from './brainrush/brainrush.module';

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
    ChatModule,
    BrainrushModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule { }
