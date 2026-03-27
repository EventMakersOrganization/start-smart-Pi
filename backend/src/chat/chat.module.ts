import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { AiService } from './ai.service';
import { ChatAi, ChatAiSchema } from './schemas/chat-ai.schema';
import { ChatInstructor, ChatInstructorSchema } from './schemas/chat-instructor.schema';
import { ChatRoom, ChatRoomSchema } from './schemas/chat-room.schema';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    HttpModule.register({ timeout: 120_000 }),
    MongooseModule.forFeature([
      { name: ChatAi.name, schema: ChatAiSchema },
      { name: ChatInstructor.name, schema: ChatInstructorSchema },
      { name: ChatRoom.name, schema: ChatRoomSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, AiService],
  exports: [ChatService, AiService],
})
export class ChatModule {}

