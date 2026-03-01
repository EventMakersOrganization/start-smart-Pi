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
exports.LevelTestSchema = exports.LevelTest = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let LevelTest = class LevelTest {
};
exports.LevelTest = LevelTest;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], LevelTest.prototype, "studentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [{
                questionText: String,
                options: [String],
                correctAnswer: String,
                topic: String,
                difficulty: String
            }],
        default: []
    }),
    __metadata("design:type", Array)
], LevelTest.prototype, "questions", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [{
                questionIndex: Number,
                selectedAnswer: String,
                isCorrect: Boolean,
                timeSpent: Number
            }],
        default: []
    }),
    __metadata("design:type", Array)
], LevelTest.prototype, "answers", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], LevelTest.prototype, "totalScore", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner'
    }),
    __metadata("design:type", String)
], LevelTest.prototype, "resultLevel", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [{
                topic: String,
                score: Number,
                correct: Number,
                total: Number
            }],
        default: []
    }),
    __metadata("design:type", Array)
], LevelTest.prototype, "detectedStrengths", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [{
                topic: String,
                score: Number,
                correct: Number,
                total: Number
            }],
        default: []
    }),
    __metadata("design:type", Array)
], LevelTest.prototype, "detectedWeaknesses", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        enum: ['in-progress', 'completed'],
        default: 'in-progress'
    }),
    __metadata("design:type", String)
], LevelTest.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], LevelTest.prototype, "completedAt", void 0);
exports.LevelTest = LevelTest = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], LevelTest);
exports.LevelTestSchema = mongoose_1.SchemaFactory.createForClass(LevelTest);
//# sourceMappingURL=level-test.schema.js.map