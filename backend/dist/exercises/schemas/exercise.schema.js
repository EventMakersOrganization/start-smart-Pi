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
exports.ExerciseSchema = exports.Exercise = exports.ExerciseType = exports.Difficulty = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var Difficulty;
(function (Difficulty) {
    Difficulty["EASY"] = "easy";
    Difficulty["MEDIUM"] = "medium";
    Difficulty["HARD"] = "hard";
})(Difficulty || (exports.Difficulty = Difficulty = {}));
var ExerciseType;
(function (ExerciseType) {
    ExerciseType["QUIZ"] = "quiz";
    ExerciseType["MCQ"] = "MCQ";
    ExerciseType["PROBLEM"] = "problem";
})(ExerciseType || (exports.ExerciseType = ExerciseType = {}));
let Exercise = class Exercise {
};
exports.Exercise = Exercise;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Course', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Exercise.prototype, "courseId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(Difficulty),
        required: true,
    }),
    __metadata("design:type", String)
], Exercise.prototype, "difficulty", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Exercise.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Exercise.prototype, "correctAnswer", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(ExerciseType),
        required: true,
    }),
    __metadata("design:type", String)
], Exercise.prototype, "type", void 0);
exports.Exercise = Exercise = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Exercise);
exports.ExerciseSchema = mongoose_1.SchemaFactory.createForClass(Exercise);
//# sourceMappingURL=exercise.schema.js.map