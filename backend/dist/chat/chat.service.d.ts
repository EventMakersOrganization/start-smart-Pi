import { Model, Types } from 'mongoose';
import { ChatAi, ChatAiDocument } from './schemas/chat-ai.schema';
import { ChatInstructorDocument } from './schemas/chat-instructor.schema';
import { ChatRoom, ChatRoomDocument } from './schemas/chat-room.schema';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { StudentProfileDocument } from '../users/schemas/student-profile.schema';
import { SchoolClassDocument } from '../academic/schemas/school-class.schema';
import { ClassSubjectDocument } from '../academic/schemas/class-subject.schema';
import { SubjectDocument } from '../subjects/schemas/subject.schema';
export declare class ChatService {
    private chatAiModel;
    private chatInstructorModel;
    private chatRoomModel;
    private chatMessageModel;
    private userModel;
    private studentProfileModel;
    private schoolClassModel;
    private classSubjectModel;
    private subjectModel;
    constructor(chatAiModel: Model<ChatAiDocument>, chatInstructorModel: Model<ChatInstructorDocument>, chatRoomModel: Model<ChatRoomDocument>, chatMessageModel: Model<ChatMessageDocument>, userModel: Model<UserDocument>, studentProfileModel: Model<StudentProfileDocument>, schoolClassModel: Model<SchoolClassDocument>, classSubjectModel: Model<ClassSubjectDocument>, subjectModel: Model<SubjectDocument>);
    private profileLookupFilter;
    private getStudentClass;
    createAiSession(studentId: string, title?: string): Promise<ChatAi & import("mongoose").Document<any, any, any> & {
        _id: Types.ObjectId;
    }>;
    resolveParticipants(session: any): Promise<any>;
    createInstructorSession(studentId: string, instructorId: string, requesterRole?: string): Promise<any>;
    private getAllowedInstructorIdsForStudent;
    getAvailableInstructors(userId: string, role?: string): Promise<{
        id: any;
        first_name: any;
        last_name: any;
        email: any;
        phone: any;
        role: any;
        status: any;
        createdAt: any;
        updatedAt: any;
    }[]>;
    createRoom(name: string, participants: string[]): Promise<ChatRoom & import("mongoose").Document<any, any, any> & {
        _id: Types.ObjectId;
    }>;
    createRoomForStudent(studentId: string, name: string, participants: string[]): Promise<ChatRoom & import("mongoose").Document<any, any, any> & {
        _id: Types.ObjectId;
    }>;
    getUserSessions(userId: string, role?: string): Promise<{
        ai: import("mongoose").LeanDocument<ChatAi & import("mongoose").Document<any, any, any> & {
            _id: Types.ObjectId;
        }>[];
        instructor: any[];
        rooms: any[];
    }>;
    getChatHistory(sessionType: string, sessionId: string, reqUserId: string): Promise<import("mongoose").LeanDocument<ChatMessage & import("mongoose").Document<any, any, any> & {
        _id: Types.ObjectId;
    }>[]>;
    getRecentHistory(sessionId: string, limit?: number): Promise<import("mongoose").LeanDocument<ChatMessage & import("mongoose").Document<any, any, any> & {
        _id: Types.ObjectId;
    }>[]>;
    saveMessage(data: {
        sessionType: string;
        sessionId: string;
        sender: string | 'AI';
        content: string;
    }): Promise<ChatMessage & import("mongoose").Document<any, any, any> & {
        _id: Types.ObjectId;
    }>;
    isParticipant(sessionType: string, sessionId: string, userId: string): Promise<boolean>;
    deleteMessage(messageId: string, userId: string): Promise<any>;
    deleteAiSession(sessionId: string, userId: string): Promise<any>;
}
