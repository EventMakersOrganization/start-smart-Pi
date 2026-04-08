"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const chat_ai_schema_1 = require("./schemas/chat-ai.schema");
const chat_instructor_schema_1 = require("./schemas/chat-instructor.schema");
const chat_room_schema_1 = require("./schemas/chat-room.schema");
const chat_message_schema_1 = require("./schemas/chat-message.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const student_profile_schema_1 = require("../users/schemas/student-profile.schema");
const school_class_schema_1 = require("../academic/schemas/school-class.schema");
const class_subject_schema_1 = require("../academic/schemas/class-subject.schema");
const subject_schema_1 = require("../subjects/schemas/subject.schema");
let ChatService = class ChatService {
    constructor(chatAiModel, chatInstructorModel, chatRoomModel, chatMessageModel, userModel, studentProfileModel, schoolClassModel, classSubjectModel, subjectModel) {
        this.chatAiModel = chatAiModel;
        this.chatInstructorModel = chatInstructorModel;
        this.chatRoomModel = chatRoomModel;
        this.chatMessageModel = chatMessageModel;
        this.userModel = userModel;
        this.studentProfileModel = studentProfileModel;
        this.schoolClassModel = schoolClassModel;
        this.classSubjectModel = classSubjectModel;
        this.subjectModel = subjectModel;
    }
    profileLookupFilter(userId) {
        if (mongoose_2.Types.ObjectId.isValid(userId)) {
            return { $or: [{ userId }, { userId: new mongoose_2.Types.ObjectId(userId) }] };
        }
        return { userId };
    }
    async getStudentClass(userId) {
        const profile = await this.studentProfileModel.findOne(this.profileLookupFilter(userId)).lean();
        const cls = (profile?.class ?? profile?.academic_level)?.toString();
        return cls || null;
    }
    async createAiSession(studentId, title) {
        const session = new this.chatAiModel({ student: studentId, title: title || 'New AI Session' });
        return session.save();
    }
    async resolveParticipants(session) {
        if (!session.participants)
            return session;
        const populated = [];
        for (const p of session.participants) {
            const pId = p._id ? p._id.toString() : p.toString();
            try {
                const user = await this.userModel.findById(pId).select('first_name last_name email role').lean();
                if (user) {
                    populated.push(user);
                }
                else {
                    populated.push({ _id: pId, first_name: 'Unknown', last_name: 'User', email: '' });
                }
            }
            catch (e) {
                populated.push({ _id: pId, first_name: 'Unknown', last_name: 'User', email: '' });
            }
        }
        session.participants = populated;
        return session;
    }
    async createInstructorSession(studentId, instructorId, requesterRole) {
        const instructor = await this.userModel
            .findOne({
            _id: instructorId,
            role: { $regex: /^(instructor|teacher)$/i },
        })
            .select('_id')
            .lean();
        if (!instructor) {
            throw new common_1.BadRequestException('Invalid instructor.');
        }
        if ((requesterRole || '').toLowerCase() === 'student') {
            const allowedInstructorIds = await this.getAllowedInstructorIdsForStudent(studentId);
            if (!allowedInstructorIds.has(String(instructorId))) {
                throw new common_1.UnauthorizedException('You can only chat with instructors assigned to subjects of your class.');
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
    async getAllowedInstructorIdsForStudent(studentId) {
        const studentClass = await this.getStudentClass(studentId);
        if (!studentClass) {
            return new Set();
        }
        const classPattern = new RegExp(`^${studentClass.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        const schoolClasses = await this.schoolClassModel
            .find({
            $or: [{ code: classPattern }, { name: classPattern }],
        })
            .select('_id')
            .lean();
        if (!schoolClasses.length) {
            return new Set();
        }
        const schoolClassIds = schoolClasses.map((c) => c._id);
        const classSubjects = await this.classSubjectModel
            .find({ schoolClassId: { $in: schoolClassIds } })
            .select('subjectId')
            .lean();
        const subjectIds = Array.from(new Set(classSubjects.map((cs) => String(cs.subjectId)).filter(Boolean)))
            .filter((id) => mongoose_2.Types.ObjectId.isValid(id))
            .map((id) => new mongoose_2.Types.ObjectId(id));
        if (!subjectIds.length) {
            return new Set();
        }
        const subjects = await this.subjectModel
            .find({ _id: { $in: subjectIds } })
            .select('instructors')
            .lean();
        const instructorIds = Array.from(new Set(subjects
            .flatMap((subject) => Array.isArray(subject.instructors) ? subject.instructors : [])
            .map((id) => String(id))
            .filter(Boolean)));
        if (!instructorIds.length) {
            return new Set();
        }
        const validInstructorUsers = await this.userModel
            .find({
            _id: { $in: instructorIds.filter((id) => mongoose_2.Types.ObjectId.isValid(id)).map((id) => new mongoose_2.Types.ObjectId(id)) },
            role: { $regex: /^(instructor|teacher)$/i },
        })
            .select('_id')
            .lean();
        return new Set(validInstructorUsers.map((u) => String(u._id)));
    }
    async getAvailableInstructors(userId, role) {
        if ((role || '').toLowerCase() !== 'student') {
            const users = await this.userModel
                .find({ role: { $regex: /^(instructor|teacher)$/i } })
                .select('first_name last_name email phone role status createdAt updatedAt')
                .lean();
            return users.map((u) => ({
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
                    .filter((id) => mongoose_2.Types.ObjectId.isValid(id))
                    .map((id) => new mongoose_2.Types.ObjectId(id)),
            },
            role: { $regex: /^(instructor|teacher)$/i },
        })
            .select('first_name last_name email phone role status createdAt updatedAt')
            .lean();
        return instructors.map((u) => ({
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
    async createRoom(name, participants) {
        const room = new this.chatRoomModel({ name, participants });
        return room.save();
    }
    async createRoomForStudent(studentId, name, participants) {
        const roomName = (name || '').trim();
        if (!roomName) {
            throw new common_1.BadRequestException('Group name is required.');
        }
        const selected = (participants || []).map((id) => String(id));
        const uniqueIds = Array.from(new Set([studentId, ...selected]));
        if (uniqueIds.length < 2) {
            throw new common_1.BadRequestException('Select at least one classmate.');
        }
        const studentClass = await this.getStudentClass(studentId);
        if (!studentClass) {
            throw new common_1.UnauthorizedException('Your class is not set.');
        }
        const validObjectIds = uniqueIds
            .filter((id) => mongoose_2.Types.ObjectId.isValid(id))
            .map((id) => new mongoose_2.Types.ObjectId(id));
        const students = await this.userModel
            .find({ _id: { $in: validObjectIds }, role: { $regex: /^student$/i } })
            .select('_id')
            .lean();
        const studentIds = students.map((s) => String(s._id));
        const studentObjectIds = studentIds
            .filter((id) => mongoose_2.Types.ObjectId.isValid(id))
            .map((id) => new mongoose_2.Types.ObjectId(id));
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
        })
            .select('userId')
            .lean();
        const allowedIds = new Set(sameClassProfiles.map((p) => String(p.userId)));
        if (!allowedIds.has(studentId)) {
            throw new common_1.UnauthorizedException('You can only create groups within your class.');
        }
        const invalidParticipants = selected.filter((id) => !allowedIds.has(id));
        if (invalidParticipants.length > 0) {
            throw new common_1.UnauthorizedException('Some selected students are not in your class.');
        }
        const room = new this.chatRoomModel({
            name: roomName,
            participants: [studentId, ...selected],
        });
        return room.save();
    }
    async getUserSessions(userId, role) {
        const aiSessions = await this.chatAiModel.find({ student: userId }).sort({ updatedAt: -1 }).lean();
        const rawInstructorSessions = await this.chatInstructorModel.find({ participants: userId }).sort({ updatedAt: -1 }).lean();
        const instructorSessions = await Promise.all(rawInstructorSessions.map((s) => this.resolveParticipants(s)));
        let rooms = [];
        if (role === 'student' || !role) {
            const rawRooms = await this.chatRoomModel.find({ participants: userId }).sort({ updatedAt: -1 }).lean();
            rooms = await Promise.all(rawRooms.map((s) => this.resolveParticipants(s)));
        }
        return {
            ai: aiSessions,
            instructor: instructorSessions,
            rooms: rooms,
        };
    }
    async getChatHistory(sessionType, sessionId, reqUserId) {
        if (sessionType === 'ChatInstructor') {
            const session = await this.chatInstructorModel.findById(sessionId).lean();
            if (!session || !session.participants.map(p => p.toString()).includes(reqUserId)) {
                throw new common_1.UnauthorizedException('Access denied to this Instructor chat.');
            }
        }
        else if (sessionType === 'ChatRoom') {
            const room = await this.chatRoomModel.findById(sessionId).lean();
            if (!room || !room.participants.map(p => p.toString()).includes(reqUserId)) {
                throw new common_1.UnauthorizedException('Access denied to this Group chat.');
            }
        }
        else if (sessionType === 'ChatAi') {
            const aiSession = await this.chatAiModel.findById(sessionId).lean();
            if (!aiSession || aiSession.student.toString() !== reqUserId) {
                throw new common_1.UnauthorizedException('Access denied to this AI chat.');
            }
        }
        return this.chatMessageModel.find({ sessionType, sessionId }).sort({ createdAt: 1 }).lean();
    }
    async getRecentHistory(sessionId, limit = 6) {
        return this.chatMessageModel
            .find({ sessionId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean()
            .then((msgs) => msgs.reverse());
    }
    async saveMessage(data) {
        const message = new this.chatMessageModel(data);
        await message.save();
        try {
            if (data.sessionType === 'ChatAi') {
                await this.chatAiModel.findByIdAndUpdate(data.sessionId, { updatedAt: new Date() });
            }
            else if (data.sessionType === 'ChatInstructor') {
                await this.chatInstructorModel.findByIdAndUpdate(data.sessionId, { updatedAt: new Date() });
            }
            else if (data.sessionType === 'ChatRoom') {
                await this.chatRoomModel.findByIdAndUpdate(data.sessionId, { updatedAt: new Date() });
            }
        }
        catch (e) {
            console.error('Failed to update session timestamp', e);
        }
        return message;
    }
    async isParticipant(sessionType, sessionId, userId) {
        try {
            if (sessionType === 'ChatAi') {
                const session = await this.chatAiModel.findById(sessionId).lean();
                return session?.student?.toString() === userId;
            }
            else if (sessionType === 'ChatInstructor') {
                const session = await this.chatInstructorModel.findById(sessionId).lean();
                return session?.participants?.map(p => p.toString()).includes(userId);
            }
            else if (sessionType === 'ChatRoom') {
                const session = await this.chatRoomModel.findById(sessionId).lean();
                return session?.participants?.map(p => p.toString()).includes(userId);
            }
            return false;
        }
        catch (e) {
            return false;
        }
    }
    async deleteMessage(messageId, userId) {
        const message = await this.chatMessageModel.findById(messageId);
        if (!message) {
            throw new common_1.NotFoundException('Message not found');
        }
        if (message.sender.toString() !== userId) {
            throw new common_1.UnauthorizedException('You can only delete your own messages');
        }
        return this.chatMessageModel.findByIdAndDelete(messageId);
    }
    async deleteAiSession(sessionId, userId) {
        const session = await this.chatAiModel.findById(sessionId);
        if (!session) {
            throw new common_1.NotFoundException('AI Session not found');
        }
        if (session.student.toString() !== userId) {
            throw new common_1.UnauthorizedException('You can only delete your own AI sessions');
        }
        await this.chatMessageModel.deleteMany({ sessionType: 'ChatAi', sessionId });
        return this.chatAiModel.findByIdAndDelete(sessionId);
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(chat_ai_schema_1.ChatAi.name)),
    __param(1, (0, mongoose_1.InjectModel)(chat_instructor_schema_1.ChatInstructor.name)),
    __param(2, (0, mongoose_1.InjectModel)(chat_room_schema_1.ChatRoom.name)),
    __param(3, (0, mongoose_1.InjectModel)(chat_message_schema_1.ChatMessage.name)),
    __param(4, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(5, (0, mongoose_1.InjectModel)(student_profile_schema_1.StudentProfile.name)),
    __param(6, (0, mongoose_1.InjectModel)(school_class_schema_1.SchoolClass.name)),
    __param(7, (0, mongoose_1.InjectModel)(class_subject_schema_1.ClassSubject.name)),
    __param(8, (0, mongoose_1.InjectModel)(subject_schema_1.Subject.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], ChatService);
//# sourceMappingURL=chat.service.js.map