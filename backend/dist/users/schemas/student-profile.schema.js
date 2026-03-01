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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentProfileSchema = exports.StudentProfile = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let StudentProfile = class StudentProfile {
};
exports.StudentProfile = StudentProfile;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, unique: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], StudentProfile.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], StudentProfile.prototype, "academic_level", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH'],
        default: 'LOW',
    }),
    __metadata("design:type", String)
], StudentProfile.prototype, "risk_level", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], StudentProfile.prototype, "points_gamification", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner'
    }),
    __metadata("design:type", String)
], StudentProfile.prototype, "level", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            preferredStyle: { type: String, default: 'visual' },
            preferredDifficulty: { type: String, default: 'beginner' },
            studyHoursPerDay: { type: Number, default: 1 }
        },
        default: {}
    }),
    __metadata("design:type", Object)
], StudentProfile.prototype, "learningPreferences", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, min: 0, max: 100 }),
    __metadata("design:type", Number)
], StudentProfile.prototype, "progress", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], StudentProfile.prototype, "strengths", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], StudentProfile.prototype, "weaknesses", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], StudentProfile.prototype, "levelTestCompleted", void 0);
exports.StudentProfile = StudentProfile = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], StudentProfile);
exports.StudentProfileSchema = mongoose_1.SchemaFactory.createForClass(StudentProfile);
//# sourceMappingURL=student-profile.schema.js.map