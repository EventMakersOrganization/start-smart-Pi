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
exports.StudentPerformanceSchema = exports.StudentPerformance = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let StudentPerformance = class StudentPerformance {
};
exports.StudentPerformance = StudentPerformance;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], StudentPerformance.prototype, "studentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], StudentPerformance.prototype, "exerciseId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0, max: 100 }),
    __metadata("design:type", Number)
], StudentPerformance.prototype, "score", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], StudentPerformance.prototype, "timeSpent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], StudentPerformance.prototype, "attemptDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        enum: ['quiz', 'exercise', 'brainrush', 'level-test'],
        default: 'exercise'
    }),
    __metadata("design:type", String)
], StudentPerformance.prototype, "source", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'general' }),
    __metadata("design:type", String)
], StudentPerformance.prototype, "topic", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner'
    }),
    __metadata("design:type", String)
], StudentPerformance.prototype, "difficulty", void 0);
exports.StudentPerformance = StudentPerformance = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], StudentPerformance);
exports.StudentPerformanceSchema = mongoose_1.SchemaFactory.createForClass(StudentPerformance);
//# sourceMappingURL=student-performance.schema.js.map