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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("./schemas/user.schema");
const student_profile_schema_1 = require("./schemas/student-profile.schema");
const activity_service_1 = require("../activity/activity.service");
const activity_schema_1 = require("../activity/schemas/activity.schema");
let UsersService = class UsersService {
    constructor(userModel, profileModel, activityService) {
        this.userModel = userModel;
        this.profileModel = profileModel;
        this.activityService = activityService;
    }
    async getProfile(userId) {
        const user = await this.userModel.findById(userId).select('-password');
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const profile = await this.profileModel.findOne({ userId }).exec();
        return {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
            },
            profile: profile ? {
                academicLevel: profile.academicLevel,
                enrolledCourse: profile.enrolledCourse,
                preferences: profile.preferences,
                averageScore: profile.averageScore,
            } : null,
        };
    }
    async updateProfile(userId, updateProfileDto) {
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (updateProfileDto.name) {
            user.name = updateProfileDto.name;
        }
        if (updateProfileDto.academicLevel || updateProfileDto.enrolledCourse || updateProfileDto.preferences) {
            let profile = await this.profileModel.findOne({ userId }).exec();
            if (!profile) {
                profile = new this.profileModel({ userId });
            }
            if (updateProfileDto.academicLevel)
                profile.academicLevel = updateProfileDto.academicLevel;
            if (updateProfileDto.enrolledCourse)
                profile.enrolledCourse = updateProfileDto.enrolledCourse;
            if (updateProfileDto.preferences)
                profile.preferences = { ...profile.preferences, ...updateProfileDto.preferences };
            await profile.save();
        }
        await user.save();
        await this.activityService.logActivity(userId, activity_schema_1.ActivityAction.PROFILE_UPDATE);
        return this.getProfile(userId);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(1, (0, mongoose_1.InjectModel)(student_profile_schema_1.StudentProfile.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        activity_service_1.ActivityService])
], UsersService);
//# sourceMappingURL=users.service.js.map