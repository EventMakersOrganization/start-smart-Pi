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
exports.ExercisesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const exercise_schema_1 = require("./schemas/exercise.schema");
let ExercisesService = class ExercisesService {
    constructor(exerciseModel) {
        this.exerciseModel = exerciseModel;
    }
    async create(createExerciseDto) {
        const exercise = new this.exerciseModel(createExerciseDto);
        return exercise.save();
    }
    async findAll(page = 1, limit = 10, courseId, difficulty) {
        const filter = {};
        if (courseId)
            filter.courseId = courseId;
        if (difficulty)
            filter.difficulty = difficulty;
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.exerciseModel
                .find(filter)
                .populate('courseId', 'title level')
                .skip(skip)
                .limit(limit)
                .exec(),
            this.exerciseModel.countDocuments(filter),
        ]);
        return { data, total, page, limit };
    }
    async findOne(id) {
        const exercise = await this.exerciseModel
            .findById(id)
            .populate('courseId', 'title level')
            .exec();
        if (!exercise) {
            throw new common_1.NotFoundException(`Exercise with ID "${id}" not found`);
        }
        return exercise;
    }
    async update(id, updateExerciseDto) {
        const exercise = await this.exerciseModel
            .findByIdAndUpdate(id, updateExerciseDto, { new: true })
            .populate('courseId', 'title level')
            .exec();
        if (!exercise) {
            throw new common_1.NotFoundException(`Exercise with ID "${id}" not found`);
        }
        return exercise;
    }
    async remove(id) {
        const result = await this.exerciseModel.findByIdAndDelete(id).exec();
        if (!result) {
            throw new common_1.NotFoundException(`Exercise with ID "${id}" not found`);
        }
    }
};
exports.ExercisesService = ExercisesService;
exports.ExercisesService = ExercisesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(exercise_schema_1.Exercise.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ExercisesService);
//# sourceMappingURL=exercises.service.js.map