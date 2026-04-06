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
exports.SubjectsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../users/schemas/user.schema");
const subject_schema_1 = require("./schemas/subject.schema");
let SubjectsService = class SubjectsService {
    constructor(subjectModel, userModel) {
        this.subjectModel = subjectModel;
        this.userModel = userModel;
    }
    async create(dto) {
        const instructorIds = this.normalizeIds(dto.instructorIds);
        await this.assertAllInstructorsExist(instructorIds);
        const subject = await this.subjectModel.create({
            name: dto.name,
            description: dto.description || '',
            instructors: instructorIds.map((id) => new mongoose_2.Types.ObjectId(id)),
        });
        return this.findOne(subject._id.toString());
    }
    async findAll() {
        const subjects = await this.subjectModel
            .find()
            .sort({ createdAt: -1 })
            .populate('instructors', 'first_name last_name email role')
            .exec();
        return subjects.map((subject) => this.toResponse(subject));
    }
    async findOne(id) {
        const subject = await this.subjectModel
            .findById(id)
            .populate('instructors', 'first_name last_name email role')
            .exec();
        if (!subject) {
            throw new common_1.NotFoundException('Subject not found');
        }
        return this.toResponse(subject);
    }
    async update(id, dto) {
        const subject = await this.subjectModel.findById(id);
        if (!subject) {
            throw new common_1.NotFoundException('Subject not found');
        }
        if (dto.name !== undefined) {
            subject.name = dto.name;
        }
        if (dto.description !== undefined) {
            subject.description = dto.description;
        }
        if (dto.instructorIds !== undefined) {
            const instructorIds = this.normalizeIds(dto.instructorIds);
            await this.assertAllInstructorsExist(instructorIds);
            subject.instructors = instructorIds.map((instructorId) => new mongoose_2.Types.ObjectId(instructorId));
        }
        await subject.save();
        return this.findOne(id);
    }
    async remove(id) {
        const deleted = await this.subjectModel.findByIdAndDelete(id).exec();
        if (!deleted) {
            throw new common_1.NotFoundException('Subject not found');
        }
        return { success: true };
    }
    normalizeIds(ids) {
        if (!Array.isArray(ids) || ids.length === 0) {
            throw new common_1.BadRequestException('At least one instructor is required');
        }
        return [...new Set(ids.map((id) => id?.trim()).filter(Boolean))];
    }
    async assertAllInstructorsExist(instructorIds) {
        const instructors = await this.userModel.find({
            _id: { $in: instructorIds },
            role: { $regex: /^(instructor|teacher)$/i },
        });
        if (instructors.length !== instructorIds.length) {
            throw new common_1.BadRequestException('One or more selected instructors are invalid');
        }
    }
    toResponse(subject) {
        return {
            id: subject._id,
            name: subject.name,
            description: subject.description,
            instructors: (subject.instructors || []).map((instructor) => ({
                id: instructor._id,
                first_name: instructor.first_name,
                last_name: instructor.last_name,
                email: instructor.email,
                role: instructor.role,
            })),
            createdAt: subject.createdAt,
            updatedAt: subject.updatedAt,
        };
    }
};
exports.SubjectsService = SubjectsService;
exports.SubjectsService = SubjectsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(subject_schema_1.Subject.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], SubjectsService);
//# sourceMappingURL=subjects.service.js.map