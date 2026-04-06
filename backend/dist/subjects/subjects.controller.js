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
exports.SubjectsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const common_2 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const user_schema_1 = require("../users/schemas/user.schema");
const subjects_service_1 = require("./subjects.service");
const create_subject_dto_1 = require("./dto/create-subject.dto");
const update_subject_dto_1 = require("./dto/update-subject.dto");
const add_chapter_dto_1 = require("./dto/add-chapter.dto");
const add_chapter_content_dto_1 = require("./dto/add-chapter-content.dto");
const add_subchapter_dto_1 = require("./dto/add-subchapter.dto");
const add_subchapter_content_dto_1 = require("./dto/add-subchapter-content.dto");
const update_subchapter_content_dto_1 = require("./dto/update-subchapter-content.dto");
const update_chapter_content_dto_1 = require("./dto/update-chapter-content.dto");
const submit_quiz_dto_1 = require("./dto/submit-quiz.dto");
const submit_quiz_file_dto_1 = require("./dto/submit-quiz-file.dto");
const grade_quiz_file_submission_dto_1 = require("./dto/grade-quiz-file-submission.dto");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
const fs_1 = require("fs");
const getUploadsDir = (...segments) => (0, path_1.resolve)(__dirname, "..", "..", "uploads", ...segments);
let SubjectsController = class SubjectsController {
    constructor(subjectsService) {
        this.subjectsService = subjectsService;
    }
    uploadCourseFile(file, req) {
        if (!file) {
            throw new common_1.BadRequestException("File is required");
        }
        const protocol = String(req?.protocol || "http");
        const host = String(req?.get?.("host") || "localhost:3000");
        const relativePath = `/uploads/subjects/cours/${file.filename}`;
        return {
            status: "success",
            fileName: file.originalname,
            mimeType: file.mimetype,
            fileUrl: `${protocol}://${host}${relativePath}`,
            path: relativePath,
        };
    }
    create(createSubjectDto) {
        return this.subjectsService.create(createSubjectDto);
    }
    findAll(instructorId) {
        return this.subjectsService.findAll(instructorId);
    }
    findOne(id) {
        return this.subjectsService.findOne(id);
    }
    addChapter(id, addChapterDto) {
        return this.subjectsService.addChapter(id, addChapterDto);
    }
    deleteChapter(id, chapterOrder) {
        return this.subjectsService.deleteChapter(id, chapterOrder);
    }
    addChapterContent(id, chapterOrder, addChapterContentDto) {
        return this.subjectsService.addChapterContent(id, chapterOrder, addChapterContentDto);
    }
    updateChapterContent(id, chapterOrder, contentId, updateChapterContentDto) {
        return this.subjectsService.updateChapterContent(id, chapterOrder, contentId, updateChapterContentDto);
    }
    deleteChapterContent(id, chapterOrder, contentId) {
        return this.subjectsService.deleteChapterContent(id, chapterOrder, contentId);
    }
    addSubChapter(id, chapterOrder, addSubChapterDto) {
        return this.subjectsService.addSubChapter(id, chapterOrder, addSubChapterDto);
    }
    addSubChapterContent(id, chapterOrder, subChapterOrder, addSubChapterContentDto) {
        return this.subjectsService.addSubChapterContent(id, chapterOrder, subChapterOrder, addSubChapterContentDto);
    }
    updateSubChapterContent(id, chapterOrder, subChapterOrder, contentId, updateSubChapterContentDto) {
        return this.subjectsService.updateSubChapterContent(id, chapterOrder, subChapterOrder, contentId, updateSubChapterContentDto);
    }
    deleteSubChapterContent(id, chapterOrder, subChapterOrder, contentId) {
        return this.subjectsService.deleteSubChapterContent(id, chapterOrder, subChapterOrder, contentId);
    }
    remove(id) {
        return this.subjectsService.remove(id);
    }
    async submitQuiz(req, submitQuizDto) {
        try {
            const studentId = req?.user?.userId || req?.user?._id || req?.user?.id;
            if (!studentId) {
                throw new common_1.BadRequestException(`Student ID not found in JWT token. User object: ${JSON.stringify(req?.user)}`);
            }
            if (!submitQuizDto) {
                throw new common_1.BadRequestException("Submit data is required");
            }
            if (!submitQuizDto.quizId) {
                throw new common_1.BadRequestException("Quiz ID is required");
            }
            return await this.subjectsService.submitQuiz(String(studentId), submitQuizDto);
        }
        catch (error) {
            console.error("Quiz submission error:", error.message);
            throw error;
        }
    }
    getStudentQuizSubmissions(req) {
        const studentId = req?.user?.id || req?.user?.userId || req?.user?._id;
        if (!studentId) {
            throw new common_1.BadRequestException("Student ID not found in request");
        }
        return this.subjectsService.getStudentQuizSubmissions(studentId);
    }
    getQuizSubmission(submissionId) {
        return this.subjectsService.getQuizSubmission(submissionId);
    }
    getLatestQuizSubmission(req, quizId) {
        const studentId = req?.user?.id || req?.user?.userId || req?.user?._id;
        if (!studentId) {
            throw new common_1.BadRequestException("Student ID not found in request");
        }
        return this.subjectsService.getLatestStudentQuizSubmission(studentId, quizId);
    }
    async submitQuizFile(req, submitQuizFileDto, file) {
        const studentId = req?.user?.id || req?.user?.userId || req?.user?._id;
        if (!studentId) {
            throw new common_1.BadRequestException("Student ID not found in request");
        }
        if (!file) {
            throw new common_1.BadRequestException("Response file is required");
        }
        const protocol = String(req?.protocol || "http");
        const host = String(req?.get?.("host") || "localhost:3000");
        const relativePath = `/uploads/subjects/quiz-submissions/${file.filename}`;
        return this.subjectsService.submitQuizFile(String(studentId), submitQuizFileDto, {
            fileUrl: `${protocol}://${host}${relativePath}`,
            fileName: String(file.originalname || file.filename || "response"),
            mimeType: String(file.mimetype || "").trim() || undefined,
        });
    }
    getStudentQuizFileSubmissions(req) {
        const studentId = req?.user?.id || req?.user?.userId || req?.user?._id;
        if (!studentId) {
            throw new common_1.BadRequestException("Student ID not found in request");
        }
        return this.subjectsService.getStudentQuizFileSubmissions(String(studentId));
    }
    getInstructorQuizFileSubmissions(req) {
        const instructorId = req?.user?.id || req?.user?.userId || req?.user?._id;
        if (!instructorId) {
            throw new common_1.BadRequestException("Instructor ID not found in request");
        }
        return this.subjectsService.getInstructorQuizFileSubmissions(String(instructorId));
    }
    gradeQuizFileSubmission(req, submissionId, gradeDto) {
        const graderId = req?.user?.id || req?.user?.userId || req?.user?._id;
        if (!graderId) {
            throw new common_1.BadRequestException("Grader ID not found in request");
        }
        return this.subjectsService.gradeQuizFileSubmission(submissionId, String(graderId), gradeDto);
    }
    update(id, dto) {
        return this.subjectsService.update(id, dto);
    }
};
exports.SubjectsController = SubjectsController;
__decorate([
    (0, common_2.Post)("upload-file"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: "Upload a cours file (pdf/doc/docx/ppt/pptx) and return public URL",
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("file", {
        storage: (0, multer_1.diskStorage)({
            destination: (_req, _file, cb) => {
                const dir = getUploadsDir("subjects", "cours");
                if (!(0, fs_1.existsSync)(dir)) {
                    (0, fs_1.mkdirSync)(dir, { recursive: true });
                }
                cb(null, dir);
            },
            filename: (_req, file, cb) => {
                const safeExt = (0, path_1.extname)(file.originalname || "").toLowerCase();
                const base = String(file.originalname || "file")
                    .replace(/\.[^/.]+$/, "")
                    .replace(/[^a-zA-Z0-9_-]/g, "_")
                    .slice(0, 80);
                cb(null, `${Date.now()}_${base}${safeExt || ""}`);
            },
        }),
        limits: { fileSize: 20 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            const ext = (0, path_1.extname)(file.originalname || "").toLowerCase();
            const allowed = [".pdf", ".doc", ".docx", ".ppt", ".pptx"];
            if (!allowed.includes(ext)) {
                cb(new common_1.BadRequestException("Only PDF, Word, or PowerPoint files are allowed"), false);
                return;
            }
            cb(null, true);
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "uploadCourseFile", null);
__decorate([
    (0, common_2.Post)(),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: "Create a subject (instructor/admin only)" }),
    __param(0, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_subject_dto_1.CreateSubjectDto]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "create", null);
__decorate([
    (0, common_2.Get)(),
    (0, swagger_1.ApiOperation)({ summary: "Get all subjects with optional instructor filter" }),
    (0, swagger_1.ApiQuery)({ name: "instructorId", required: false, type: String }),
    __param(0, (0, common_1.Query)("instructorId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "findAll", null);
__decorate([
    (0, common_2.Get)(":id"),
    (0, swagger_1.ApiOperation)({ summary: "Get a subject by ID" }),
    __param(0, (0, common_2.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "findOne", null);
__decorate([
    (0, common_2.Post)(":id/chapters"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: "Append a chapter to a subject" }),
    __param(0, (0, common_2.Param)("id")),
    __param(1, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, add_chapter_dto_1.AddChapterDto]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "addChapter", null);
__decorate([
    (0, common_2.Delete)(":id/chapters/:chapterOrder"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: "Delete a chapter from a subject" }),
    __param(0, (0, common_2.Param)("id")),
    __param(1, (0, common_2.Param)("chapterOrder", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "deleteChapter", null);
__decorate([
    (0, common_2.Post)(":id/chapters/:chapterOrder/contents"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: "Attach content to a specific chapter" }),
    __param(0, (0, common_2.Param)("id")),
    __param(1, (0, common_2.Param)("chapterOrder", common_1.ParseIntPipe)),
    __param(2, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, add_chapter_content_dto_1.AddChapterContentDto]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "addChapterContent", null);
__decorate([
    (0, common_2.Put)(":id/chapters/:chapterOrder/contents/:contentId"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: "Update content of a specific chapter" }),
    __param(0, (0, common_2.Param)("id")),
    __param(1, (0, common_2.Param)("chapterOrder", common_1.ParseIntPipe)),
    __param(2, (0, common_2.Param)("contentId")),
    __param(3, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, String, update_chapter_content_dto_1.UpdateChapterContentDto]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "updateChapterContent", null);
__decorate([
    (0, common_2.Delete)(":id/chapters/:chapterOrder/contents/:contentId"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: "Delete a content item from a chapter" }),
    __param(0, (0, common_2.Param)("id")),
    __param(1, (0, common_2.Param)("chapterOrder", common_1.ParseIntPipe)),
    __param(2, (0, common_2.Param)("contentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, String]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "deleteChapterContent", null);
__decorate([
    (0, common_2.Post)(":id/chapters/:chapterOrder/subchapters"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: "Append a subchapter to a specific chapter" }),
    __param(0, (0, common_2.Param)("id")),
    __param(1, (0, common_2.Param)("chapterOrder", common_1.ParseIntPipe)),
    __param(2, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, add_subchapter_dto_1.AddSubChapterDto]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "addSubChapter", null);
__decorate([
    (0, common_2.Post)(":id/chapters/:chapterOrder/subchapters/:subChapterOrder/contents"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: "Attach content to a specific subchapter",
    }),
    __param(0, (0, common_2.Param)("id")),
    __param(1, (0, common_2.Param)("chapterOrder", common_1.ParseIntPipe)),
    __param(2, (0, common_2.Param)("subChapterOrder", common_1.ParseIntPipe)),
    __param(3, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number, add_subchapter_content_dto_1.AddSubChapterContentDto]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "addSubChapterContent", null);
__decorate([
    (0, common_2.Put)(":id/chapters/:chapterOrder/subchapters/:subChapterOrder/contents/:contentId"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: "Update content of a specific subchapter" }),
    __param(0, (0, common_2.Param)("id")),
    __param(1, (0, common_2.Param)("chapterOrder", common_1.ParseIntPipe)),
    __param(2, (0, common_2.Param)("subChapterOrder", common_1.ParseIntPipe)),
    __param(3, (0, common_2.Param)("contentId")),
    __param(4, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number, String, update_subchapter_content_dto_1.UpdateSubChapterContentDto]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "updateSubChapterContent", null);
__decorate([
    (0, common_2.Delete)(":id/chapters/:chapterOrder/subchapters/:subChapterOrder/contents/:contentId"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: "Delete a content item from a subchapter",
    }),
    __param(0, (0, common_2.Param)("id")),
    __param(1, (0, common_2.Param)("chapterOrder", common_1.ParseIntPipe)),
    __param(2, (0, common_2.Param)("subChapterOrder", common_1.ParseIntPipe)),
    __param(3, (0, common_2.Param)("contentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number, String]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "deleteSubChapterContent", null);
__decorate([
    (0, common_2.Delete)(":id"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: "Delete a subject" }),
    __param(0, (0, common_2.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "remove", null);
__decorate([
    (0, common_2.Post)("quiz-submissions/submit"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: "Submit quiz answers and save to database",
    }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: "Quiz submission saved successfully",
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, submit_quiz_dto_1.SubmitQuizDto]),
    __metadata("design:returntype", Promise)
], SubjectsController.prototype, "submitQuiz", null);
__decorate([
    (0, common_2.Get)("quiz-submissions/student"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: "Get all quiz submissions for the current student",
    }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "getStudentQuizSubmissions", null);
__decorate([
    (0, common_2.Get)("quiz-submissions/:submissionId"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: "Get details of a specific quiz submission",
    }),
    __param(0, (0, common_2.Param)("submissionId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "getQuizSubmission", null);
__decorate([
    (0, common_2.Get)("quiz-submissions/:quizId/latest"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: "Get the latest submission for a specific quiz",
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_2.Param)("quizId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "getLatestQuizSubmission", null);
__decorate([
    (0, common_2.Post)("quiz-file-submissions/submit"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: "Submit file-based quiz response (PDF/Word). Grade is set later by instructor.",
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("file", {
        storage: (0, multer_1.diskStorage)({
            destination: (_req, _file, cb) => {
                const dir = getUploadsDir("subjects", "quiz-submissions");
                if (!(0, fs_1.existsSync)(dir)) {
                    (0, fs_1.mkdirSync)(dir, { recursive: true });
                }
                cb(null, dir);
            },
            filename: (_req, file, cb) => {
                const safeExt = (0, path_1.extname)(file.originalname || "").toLowerCase();
                const base = String(file.originalname || "file")
                    .replace(/\.[^/.]+$/, "")
                    .replace(/[^a-zA-Z0-9_-]/g, "_")
                    .slice(0, 80);
                cb(null, `${Date.now()}_${base}${safeExt || ""}`);
            },
        }),
        limits: { fileSize: 20 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            const ext = (0, path_1.extname)(file.originalname || "").toLowerCase();
            const allowed = [".pdf", ".doc", ".docx"];
            if (!allowed.includes(ext)) {
                cb(new common_1.BadRequestException("Only PDF/Word files are allowed for quiz response"), false);
                return;
            }
            cb(null, true);
        },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_2.Body)()),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, submit_quiz_file_dto_1.SubmitQuizFileDto, Object]),
    __metadata("design:returntype", Promise)
], SubjectsController.prototype, "submitQuizFile", null);
__decorate([
    (0, common_2.Get)("quiz-file-submissions/student"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: "Get current student quiz-file submissions" }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "getStudentQuizFileSubmissions", null);
__decorate([
    (0, common_2.Get)("quiz-file-submissions/instructor"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: "Get all quiz-file submissions for instructor review",
    }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "getInstructorQuizFileSubmissions", null);
__decorate([
    (0, common_2.Put)("quiz-file-submissions/:submissionId/grade"),
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.INSTRUCTOR, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: "Grade a file-based quiz submission" }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_2.Param)("submissionId")),
    __param(2, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, grade_quiz_file_submission_dto_1.GradeQuizFileSubmissionDto]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "gradeQuizFileSubmission", null);
__decorate([
    (0, common_2.Put)(':id'),
    __param(0, (0, common_2.Param)('id')),
    __param(1, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_subject_dto_1.UpdateSubjectDto]),
    __metadata("design:returntype", void 0)
], SubjectsController.prototype, "update", null);
exports.SubjectsController = SubjectsController = __decorate([
    (0, swagger_1.ApiTags)("subjects"),
    (0, common_2.Controller)("subjects"),
    __metadata("design:paramtypes", [subjects_service_1.SubjectsService])
], SubjectsController);
//# sourceMappingURL=subjects.controller.js.map