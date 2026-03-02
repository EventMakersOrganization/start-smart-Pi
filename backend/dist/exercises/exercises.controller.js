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
exports.ExercisesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const exercises_service_1 = require("./exercises.service");
const create_exercise_dto_1 = require("./dto/create-exercise.dto");
const update_exercise_dto_1 = require("./dto/update-exercise.dto");
const exercise_schema_1 = require("./schemas/exercise.schema");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const user_schema_1 = require("../users/schemas/user.schema");
let ExercisesController = class ExercisesController {
    constructor(exercisesService) {
        this.exercisesService = exercisesService;
    }
    create(createExerciseDto) {
        return this.exercisesService.create(createExerciseDto);
    }
    findAll(page, limit, courseId, difficulty) {
        return this.exercisesService.findAll(page, limit, courseId, difficulty);
    }
    findOne(id) {
        return this.exercisesService.findOne(id);
    }
    update(id, updateExerciseDto) {
        return this.exercisesService.update(id, updateExerciseDto);
    }
    remove(id) {
        return this.exercisesService.remove(id);
    }
};
exports.ExercisesController = ExercisesController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new exercise (instructor/admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Exercise created successfully.' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_exercise_dto_1.CreateExerciseDto]),
    __metadata("design:returntype", void 0)
], ExercisesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all exercises with optional filtering and pagination' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number, example: 1 }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, example: 10 }),
    (0, swagger_1.ApiQuery)({ name: 'courseId', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'difficulty', required: false, enum: exercise_schema_1.Difficulty }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Paginated list of exercises.' }),
    __param(0, (0, common_1.Query)('page', new common_1.DefaultValuePipe(1), common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('limit', new common_1.DefaultValuePipe(10), common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('courseId')),
    __param(3, (0, common_1.Query)('difficulty')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String, String]),
    __metadata("design:returntype", void 0)
], ExercisesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a single exercise by ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Exercise found.' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Exercise not found.' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ExercisesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Update an exercise (instructor/admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Exercise updated successfully.' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Exercise not found.' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_exercise_dto_1.UpdateExerciseDto]),
    __metadata("design:returntype", void 0)
], ExercisesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Delete an exercise (instructor/admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Exercise deleted successfully.' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Exercise not found.' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ExercisesController.prototype, "remove", null);
exports.ExercisesController = ExercisesController = __decorate([
    (0, swagger_1.ApiTags)('exercises'),
    (0, common_1.Controller)('exercises'),
    __metadata("design:paramtypes", [exercises_service_1.ExercisesService])
], ExercisesController);
//# sourceMappingURL=exercises.controller.js.map