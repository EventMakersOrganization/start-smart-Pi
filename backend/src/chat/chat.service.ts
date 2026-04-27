import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatAi, ChatAiDocument } from './schemas/chat-ai.schema';
import { ChatInstructor, ChatInstructorDocument } from './schemas/chat-instructor.schema';
import { ChatRoom, ChatRoomDocument } from './schemas/chat-room.schema';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { StudentProfile, StudentProfileDocument } from '../users/schemas/student-profile.schema';
import { SchoolClass, SchoolClassDocument } from '../academic/schemas/school-class.schema';
import { ClassSubject, ClassSubjectDocument } from '../academic/schemas/class-subject.schema';
import { Subject, SubjectDocument } from '../subjects/schemas/subject.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatAi.name) private chatAiModel: Model<ChatAiDocument>,
    @InjectModel(ChatInstructor.name) private chatInstructorModel: Model<ChatInstructorDocument>,
    @InjectModel(ChatRoom.name) private chatRoomModel: Model<ChatRoomDocument>,
    @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(StudentProfile.name) private studentProfileModel: Model<StudentProfileDocument>,
    @InjectModel(SchoolClass.name) private schoolClassModel: Model<SchoolClassDocument>,
    @InjectModel(ClassSubject.name) private classSubjectModel: Model<ClassSubjectDocument>,
    @InjectModel(Subject.name) private subjectModel: Model<SubjectDocument>,
  ) { }

  private profileLookupFilter(userId: string) {
    if (Types.ObjectId.isValid(userId)) {
      return { $or: [{ userId }, { userId: new Types.ObjectId(userId) }] } as any;
    }
    return { userId } as any;
  }

  private async getStudentClass(userId: string): Promise<string | null> {
    const profile = await this.studentProfileModel.findOne(this.profileLookupFilter(userId)).lean();
    const cls = ((profile as any)?.class ?? (profile as any)?.academic_level)?.toString();
    return cls || null;
  }

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

  async createInstructorSession(studentId: string, instructorId: string, requesterRole?: string) {
    const instructor = await this.userModel
      .findOne({
        _id: instructorId,
        role: { $regex: /^(instructor|teacher)$/i },
      })
      .select('_id')
      .lean();

    if (!instructor) {
      throw new BadRequestException('Invalid instructor.');
    }

    if ((requesterRole || '').toLowerCase() === 'student') {
      const allowedInstructorIds = await this.getAllowedInstructorIdsForStudent(studentId);
      if (!allowedInstructorIds.has(String(instructorId))) {
        throw new UnauthorizedException('You can only chat with instructors assigned to subjects of your class.');
      }
    }

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

  private async getAllowedInstructorIdsForStudent(studentId: string): Promise<Set<string>> {
    const studentClass = await this.getStudentClass(studentId);
    if (!studentClass) {
      return new Set<string>();
    }

    const classPattern = new RegExp(`^${studentClass.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    const schoolClasses = await this.schoolClassModel
      .find({
        $or: [{ code: classPattern }, { name: classPattern }],
      })
      .select('_id')
      .lean();

    if (!schoolClasses.length) {
      return new Set<string>();
    }

    const schoolClassIds = schoolClasses.map((c: any) => c._id);
    const classSubjects = await this.classSubjectModel
      .find({ schoolClassId: { $in: schoolClassIds } })
      .select('subjectId')
      .lean();

    const subjectIds = Array.from(
      new Set(classSubjects.map((cs: any) => String(cs.subjectId)).filter(Boolean)),
    )
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (!subjectIds.length) {
      return new Set<string>();
    }

    const subjects = await this.subjectModel
      .find({ _id: { $in: subjectIds } })
      .select('instructors')
      .lean();

    const instructorIds = Array.from(
      new Set(
        subjects
          .flatMap((subject: any) => Array.isArray(subject.instructors) ? subject.instructors : [])
          .map((id: any) => String(id))
          .filter(Boolean),
      ),
    );

    if (!instructorIds.length) {
      return new Set<string>();
    }

    const validInstructorUsers = await this.userModel
      .find({
        _id: { $in: instructorIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id)) },
        role: { $regex: /^(instructor|teacher)$/i },
      })
      .select('_id')
      .lean();

    return new Set(validInstructorUsers.map((u: any) => String(u._id)));
  }

  async getAvailableInstructors(userId: string, role?: string) {
    if ((role || '').toLowerCase() !== 'student') {
      const users = await this.userModel
        .find({ role: { $regex: /^(instructor|teacher)$/i } })
        .select('first_name last_name email phone role status createdAt updatedAt')
        .lean();

      return users.map((u: any) => ({
        id: u._id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      }));
    }

    const allowedInstructorIds = await this.getAllowedInstructorIdsForStudent(userId);
    if (!allowedInstructorIds.size) {
      return [];
    }

    const instructors = await this.userModel
      .find({
        _id: {
          $in: Array.from(allowedInstructorIds)
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id)),
        },
        role: { $regex: /^(instructor|teacher)$/i },
      })
      .select('first_name last_name email phone role status createdAt updatedAt')
      .lean();

    return instructors.map((u: any) => ({
      id: u._id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }

  async createRoom(name: string, participants: string[]) {
    const room = new this.chatRoomModel({ name, participants });
    return room.save();
  }

  async createRoomForStudent(studentId: string, name: string, participants: string[]) {
    const roomName = (name || '').trim();
    if (!roomName) {
      throw new BadRequestException('Group name is required.');
    }

    const selected = (participants || []).map((id) => String(id));
    const uniqueIds = Array.from(new Set([studentId, ...selected]));

    if (uniqueIds.length < 2) {
      throw new BadRequestException('Select at least one classmate.');
    }

    const studentClass = await this.getStudentClass(studentId);
    if (!studentClass) {
      throw new UnauthorizedException('Your class is not set.');
    }

    const validObjectIds = uniqueIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const students = await this.userModel
      .find({ _id: { $in: validObjectIds }, role: { $regex: /^student$/i } })
      .select('_id')
      .lean();

    const studentIds = students.map((s: any) => String(s._id));
    const studentObjectIds = studentIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const sameClassProfiles = await this.studentProfileModel
      .find({
        $and: [
          {
            $or: [
              { class: studentClass },
              { academic_level: studentClass },
            ],
          },
          {
            $or: [
              { userId: { $in: studentObjectIds } },
              { userId: { $in: studentIds } },
            ],
          },
        ],
      } as any)
      .select('userId')
      .lean();

    const allowedIds = new Set(sameClassProfiles.map((p: any) => String(p.userId)));
    if (!allowedIds.has(studentId)) {
      throw new UnauthorizedException('You can only create groups within your class.');
    }

    const invalidParticipants = selected.filter((id) => !allowedIds.has(id));
    if (invalidParticipants.length > 0) {
      throw new UnauthorizedException('Some selected students are not in your class.');
    }

    const room = new this.chatRoomModel({
      name: roomName,
      participants: [studentId, ...selected],
    });
    return room.save();
  }

  async addParticipantsToRoom(studentId: string, roomId: string, participants: string[]) {
    const room = await this.chatRoomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const currentIds = room.participants.map(p => p.toString());
    if (!currentIds.includes(studentId)) {
      throw new UnauthorizedException('You are not a member of this group.');
    }

    const studentClass = await this.getStudentClass(studentId);
    if (!studentClass) {
      throw new UnauthorizedException('Your class is not set.');
    }

    const newIds = (participants || []).map(id => String(id)).filter(id => !currentIds.includes(id));
    if (newIds.length === 0) return this.resolveParticipants(room.toObject());

    const validObjectIds = newIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const students = await this.userModel
      .find({ _id: { $in: validObjectIds }, role: { $regex: /^student$/i } })
      .select('_id')
      .lean();

    const studentIds = students.map((s: any) => String(s._id));
    const studentObjectIds = studentIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const sameClassProfiles = await this.studentProfileModel
      .find({
        $and: [
          {
            $or: [
              { class: studentClass },
              { academic_level: studentClass },
            ],
          },
          {
            $or: [
              { userId: { $in: studentObjectIds } },
              { userId: { $in: studentIds } },
            ],
          },
        ],
      } as any)
      .select('userId')
      .lean();

    const allowedIds = sameClassProfiles.map((p: any) => String(p.userId));
    const invalidIds = newIds.filter(id => !allowedIds.includes(id));
    if (invalidIds.length > 0) {
      throw new UnauthorizedException('Some selected students are not in your class.');
    }

    for (const id of allowedIds) {
      room.participants.push(new Types.ObjectId(id) as any);
    }

    await room.save();
    return this.resolveParticipants(room.toObject());
  }

  async leaveRoom(userId: string, roomId: string) {
    const room = await this.chatRoomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    room.participants = room.participants.filter(p => p.toString() !== userId);
    
    if (room.participants.length === 0) {
      // Potentially delete the room if empty
      await this.chatRoomModel.findByIdAndDelete(roomId);
      return { success: true, deleted: true };
    }

    await room.save();
    return { success: true };
  }

  async renameRoom(userId: string, roomId: string, newName: string) {
    console.log('Renaming room:', { userId, roomId, newName });
    const room = await this.chatRoomModel.findById(roomId);
    if (!room) {
      console.log('Room not found:', roomId);
      throw new NotFoundException('Room not found');
    }

    const participantIds = room.participants.map(p => p.toString());
    console.log('Current participants:', participantIds);
    if (!participantIds.includes(userId)) {
      console.log('User not authorized to rename:', { userId, participants: participantIds });
      throw new UnauthorizedException('You are not a member of this group.');
    }

    room.name = newName.trim() || 'Unnamed Group';
    await room.save();
    return this.resolveParticipants(room.toObject());
  }

  async updateAvatar(userId: string, roomId: string, avatarUrl: string) {
    const room = await this.chatRoomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (!room.participants.map(p => p.toString()).includes(userId)) {
      throw new UnauthorizedException('You are not a member of this group.');
    }

    room.avatar = avatarUrl;
    await room.save();
    return this.resolveParticipants(room.toObject());
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
    return this.chatMessageModel.find({ sessionType, sessionId })
      .sort({ createdAt: 1 })
      .populate('sender', 'first_name last_name avatar')
      .lean();
  }

  async getRecentHistory(sessionId: string, limit = 6) {
    return this.chatMessageModel
      .find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .then((msgs) => msgs.reverse());
  }

  async saveMessage(data: { sessionType: string; sessionId: string; sender: string | 'AI'; content: string; attachments?: any[] }) {
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
    
    const saved = await this.chatMessageModel.findById(message._id).lean();
    if (data.sender !== 'AI') {
      return this.chatMessageModel.findById(message._id).populate('sender', 'first_name last_name avatar').lean();
    }
    return saved;
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

  async deleteMessage(messageId: string, userId: string): Promise<any> {
    const message = await this.chatMessageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const senderId = (message.sender as any)?._id?.toString() || message.sender?.toString();
    const requesterId = userId?.toString();

    console.log(`[DeleteMessage] MessageSender: ${senderId}, Requester: ${requesterId}`);

    if (senderId !== requesterId) {
      throw new UnauthorizedException('You can only delete your own messages');
    }

    return this.chatMessageModel.findByIdAndDelete(messageId);
  }

  async deleteAiSession(sessionId: string, userId: string): Promise<any> {
    const session = await this.chatAiModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException('AI Session not found');
    }

    if (session.student.toString() !== userId) {
      throw new UnauthorizedException('You can only delete your own AI sessions');
    }

    // Delete all messages associated with this session
    await this.chatMessageModel.deleteMany({ sessionType: 'ChatAi', sessionId });

    // Delete the session itself
    return this.chatAiModel.findByIdAndDelete(sessionId);
  }

  async deleteInstructorSession(sessionId: string, userId: string): Promise<any> {
    const session = await this.chatInstructorModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Instructor Session not found');
    }

    if (!session.participants.map(p => p.toString()).includes(userId)) {
      throw new UnauthorizedException('You are not a participant in this chat.');
    }

    // Delete all messages associated with this session
    await this.chatMessageModel.deleteMany({ sessionType: 'ChatInstructor', sessionId });

    // Delete the session itself
    return this.chatInstructorModel.findByIdAndDelete(sessionId);
  }

  async deleteRoom(roomId: string, userId: string): Promise<any> {
    const room = await this.chatRoomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException('Group chat not found');
    }

    if (!room.participants.map(p => p.toString()).includes(userId)) {
      throw new UnauthorizedException('You are not a member of this group.');
    }

    // Delete all messages associated with this room
    await this.chatMessageModel.deleteMany({ sessionType: 'ChatRoom', sessionId: roomId });

    // Delete the room itself
    return this.chatRoomModel.findByIdAndDelete(roomId);
  }
}
