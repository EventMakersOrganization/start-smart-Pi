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
exports.CreateExerciseDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const exercise_schema_1 = require("../schemas/exercise.schema");
class CreateExerciseDto {
}
exports.CreateExerciseDto = CreateExerciseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID of the course this exercise belongs to' }),
    (0, class_validator_1.IsMongoId)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateExerciseDto.prototype, "courseId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: exercise_schema_1.Difficulty,
        description: 'Exercise difficulty level',
        example: exercise_schema_1.Difficulty.MEDIUM,
    }),
    (0, class_validator_1.IsEnum)(exercise_schema_1.Difficulty),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateExerciseDto.prototype, "difficulty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The exercise question or problem statement' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateExerciseDto.prototype, "content", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The correct answer to the exercise' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateExerciseDto.prototype, "correctAnswer", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: exercise_schema_1.ExerciseType,
        description: 'Type of exercise',
        example: exercise_schema_1.ExerciseType.MCQ,
    }),
    (0, class_validator_1.IsEnum)(exercise_schema_1.ExerciseType),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateExerciseDto.prototype, "type", void 0);
//# sourceMappingURL=create-exercise.dto.js.map