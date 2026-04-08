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
import { StudentProfile, StudentProfileSchema } from '../users/schemas/student-profile.schema';
import { AuthModule } from '../auth/auth.module';
import { SchoolClass, SchoolClassSchema } from '../academic/schemas/school-class.schema';
import { ClassSubject, ClassSubjectSchema } from '../academic/schemas/class-subject.schema';
import { Subject, SubjectSchema } from '../subjects/schemas/subject.schema';

@Module({
  imports: [
    HttpModule.register({ timeout: 120_000 }),
    MongooseModule.forFeature([
      { name: ChatAi.name, schema: ChatAiSchema },
      { name: ChatInstructor.name, schema: ChatInstructorSchema },
      { name: ChatRoom.name, schema: ChatRoomSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: User.name, schema: UserSchema },
      { name: StudentProfile.name, schema: StudentProfileSchema },
      { name: SchoolClass.name, schema: SchoolClassSchema },
      { name: ClassSubject.name, schema: ClassSubjectSchema },
      { name: Subject.name, schema: SubjectSchema },
    ]),
    AuthModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, AiService],
  exports: [ChatService, AiService],
})
export class ChatModule {}

