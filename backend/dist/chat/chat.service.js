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
let ChatService = class ChatService {
    constructor(chatAiModel, chatInstructorModel, chatRoomModel, chatMessageModel, userModel) {
        this.chatAiModel = chatAiModel;
        this.chatInstructorModel = chatInstructorModel;
        this.chatRoomModel = chatRoomModel;
        this.chatMessageModel = chatMessageModel;
        this.userModel = userModel;
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
    async createInstructorSession(studentId, instructorId) {
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
    async createRoom(name, participants) {
        const room = new this.chatRoomModel({ name, participants });
        return room.save();
    }
    async getUserSessions(userId) {
        const aiSessions = await this.chatAiModel.find({ student: userId }).sort({ updatedAt: -1 }).lean();
        const rawInstructorSessions = await this.chatInstructorModel.find({ participants: userId }).sort({ updatedAt: -1 }).lean();
        const rawRooms = await this.chatRoomModel.find({ participants: userId }).sort({ updatedAt: -1 }).lean();
        const instructorSessions = await Promise.all(rawInstructorSessions.map((s) => this.resolveParticipants(s)));
        const rooms = await Promise.all(rawRooms.map((s) => this.resolveParticipants(s)));
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
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(chat_ai_schema_1.ChatAi.name)),
    __param(1, (0, mongoose_1.InjectModel)(chat_instructor_schema_1.ChatInstructor.name)),
    __param(2, (0, mongoose_1.InjectModel)(chat_room_schema_1.ChatRoom.name)),
    __param(3, (0, mongoose_1.InjectModel)(chat_message_schema_1.ChatMessage.name)),
    __param(4, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], ChatService);
//# sourceMappingURL=chat.service.js.map