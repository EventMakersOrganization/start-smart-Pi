import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatAi, ChatAiDocument } from './schemas/chat-ai.schema';
import { ChatInstructor, ChatInstructorDocument } from './schemas/chat-instructor.schema';
import { ChatRoom, ChatRoomDocument } from './schemas/chat-room.schema';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatAi.name) private chatAiModel: Model<ChatAiDocument>,
    @InjectModel(ChatInstructor.name) private chatInstructorModel: Model<ChatInstructorDocument>,
    @InjectModel(ChatRoom.name) private chatRoomModel: Model<ChatRoomDocument>,
    @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) { }

  async createAiSession(studentId: string, title?: string) {
    const session = new this.chatAiModel({ student: studentId, title: title || 'New AI Session' });
    return session.save();
  }

  async resolveParticipants(session: any) {
    if (!session.participants) return session;
    const populated = [];
    for (const p of session.participants) {
      const pId = p._id ? p._id.toString() : p.toString();
      try {
        const user = await this.userModel.findById(pId).select('first_name last_name email role').lean();
        if (user) {
          populated.push(user);
        } else {
          populated.push({ _id: pId, first_name: 'Unknown', last_name: 'User', email: '' });
        }
      } catch (e) {
        populated.push({ _id: pId, first_name: 'Unknown', last_name: 'User', email: '' });
      }
    }
    session.participants = populated;
    return session;
  }

  async createInstructorSession(studentId: string, instructorId: string) {
    let session = await this.chatInstructorModel.findOne({
      participants: { $all: [studentId, instructorId] }
    }).lean();
    if (!session) {
      const newSession = new this.chatInstructorModel({ participants: [studentId, instructorId] });
      await newSession.save();
      session = newSession.toObject();
    }
    return this.resolveParticipants(session);
  }

  async createRoom(name: string, participants: string[]) {
    const room = new this.chatRoomModel({ name, participants });
    return room.save();
  }

  async getUserSessions(userId: string, role?: string) {
    const aiSessions = await this.chatAiModel.find({ student: userId }).sort({ updatedAt: -1 }).lean();
    const rawInstructorSessions = await this.chatInstructorModel.find({ participants: userId }).sort({ updatedAt: -1 }).lean();
    const instructorSessions = await Promise.all(rawInstructorSessions.map((s: any) => this.resolveParticipants(s)));
    let rooms = [];
    if (role === 'student' || !role) {
      const rawRooms = await this.chatRoomModel.find({ participants: userId }).sort({ updatedAt: -1 }).lean();
      rooms = await Promise.all(rawRooms.map((s: any) => this.resolveParticipants(s)));
    }

    return {
      ai: aiSessions,
      instructor: instructorSessions,
      rooms: rooms,
    };
  }

  async getChatHistory(sessionType: string, sessionId: string, reqUserId: string) {
    // Logic to check access securely
    if (sessionType === 'ChatInstructor') {
      const session = await this.chatInstructorModel.findById(sessionId).lean();
      if (!session || !session.participants.map(p => p.toString()).includes(reqUserId)) {
        throw new UnauthorizedException('Access denied to this Instructor chat.');
      }
    } else if (sessionType === 'ChatRoom') {
      const room = await this.chatRoomModel.findById(sessionId).lean();
      if (!room || !room.participants.map(p => p.toString()).includes(reqUserId)) {
        throw new UnauthorizedException('Access denied to this Group chat.');
      }
    } else if (sessionType === 'ChatAi') {
      const aiSession = await this.chatAiModel.findById(sessionId).lean();
      if (!aiSession || aiSession.student.toString() !== reqUserId) {
        throw new UnauthorizedException('Access denied to this AI chat.');
      }
    }
    return this.chatMessageModel.find({ sessionType, sessionId }).sort({ createdAt: 1 }).lean();
  }

  async saveMessage(data: { sessionType: string; sessionId: string; sender: string | 'AI'; content: string }) {
    const message = new this.chatMessageModel(data);
    await message.save();

    // Update the session's updatedAt timestamp
    try {
      if (data.sessionType === 'ChatAi') {
        await this.chatAiModel.findByIdAndUpdate(data.sessionId, { updatedAt: new Date() });
      } else if (data.sessionType === 'ChatInstructor') {
        await this.chatInstructorModel.findByIdAndUpdate(data.sessionId, { updatedAt: new Date() });
      } else if (data.sessionType === 'ChatRoom') {
        await this.chatRoomModel.findByIdAndUpdate(data.sessionId, { updatedAt: new Date() });
      }
    } catch (e) {
      console.error('Failed to update session timestamp', e);
    }

    return message;
  }

  async isParticipant(sessionType: string, sessionId: string, userId: string): Promise<boolean> {
    try {
      if (sessionType === 'ChatAi') {
        const session = await this.chatAiModel.findById(sessionId).lean();
        return session?.student?.toString() === userId;
      } else if (sessionType === 'ChatInstructor') {
        const session = await this.chatInstructorModel.findById(sessionId).lean();
        return session?.participants?.map(p => p.toString()).includes(userId);
      } else if (sessionType === 'ChatRoom') {
        const session = await this.chatRoomModel.findById(sessionId).lean();
        return session?.participants?.map(p => p.toString()).includes(userId);
      }
      return false;
    } catch (e) {
      return false;
    }
  }
}
