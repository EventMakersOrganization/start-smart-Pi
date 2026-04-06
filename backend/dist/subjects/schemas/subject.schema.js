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
exports.SubjectSchema = exports.Subject = exports.ChapterSchema = exports.Chapter = exports.SubChapterSchema = exports.SubChapter = exports.SubChapterContentSchema = exports.SubChapterContent = exports.QuizQuestionSchema = exports.QuizQuestion = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const crypto_1 = require("crypto");
const mongoose_2 = require("mongoose");
let QuizQuestion = class QuizQuestion {
};
exports.QuizQuestion = QuizQuestion;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], QuizQuestion.prototype, "question", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], QuizQuestion.prototype, "options", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], QuizQuestion.prototype, "correctOptionIndex", void 0);
exports.QuizQuestion = QuizQuestion = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], QuizQuestion);
exports.QuizQuestionSchema = mongoose_1.SchemaFactory.createForClass(QuizQuestion);
let SubChapterContent = class SubChapterContent {
};
exports.SubChapterContent = SubChapterContent;
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: () => (0, crypto_1.randomUUID)() }),
    __metadata("design:type", String)
], SubChapterContent.prototype, "contentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        required: true,
        enum: ["cours", "exercices", "videos", "ressources"],
        default: "cours",
    }),
    __metadata("design:type", String)
], SubChapterContent.prototype, "folder", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        required: true,
        enum: ["file", "quiz", "video", "link", "prosit", "code"],
    }),
    __metadata("design:type", String)
], SubChapterContent.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], SubChapterContent.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], SubChapterContent.prototype, "url", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], SubChapterContent.prototype, "quizText", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.QuizQuestionSchema], default: [] }),
    __metadata("design:type", Array)
], SubChapterContent.prototype, "quizQuestions", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], SubChapterContent.prototype, "fileName", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], SubChapterContent.prototype, "mimeType", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], SubChapterContent.prototype, "dueDate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], SubChapterContent.prototype, "submissionInstructions", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], SubChapterContent.prototype, "codeSnippet", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], SubChapterContent.prototype, "createdAt", void 0);
exports.SubChapterContent = SubChapterContent = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], SubChapterContent);
exports.SubChapterContentSchema = mongoose_1.SchemaFactory.createForClass(SubChapterContent);
let SubChapter = class SubChapter {
};
exports.SubChapter = SubChapter;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], SubChapter.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], SubChapter.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], SubChapter.prototype, "order", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.SubChapterContentSchema], default: [] }),
    __metadata("design:type", Array)
], SubChapter.prototype, "contents", void 0);
exports.SubChapter = SubChapter = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], SubChapter);
exports.SubChapterSchema = mongoose_1.SchemaFactory.createForClass(SubChapter);
let Chapter = class Chapter {
};
exports.Chapter = Chapter;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Chapter.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Chapter.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Chapter.prototype, "order", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.SubChapterSchema], default: [] }),
    __metadata("design:type", Array)
], Chapter.prototype, "subChapters", void 0);
exports.Chapter = Chapter = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], Chapter);
exports.ChapterSchema = mongoose_1.SchemaFactory.createForClass(Chapter);
let Subject = class Subject {
};
exports.Subject = Subject;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], Subject.prototype, "code", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], Subject.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Subject.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'User' }], default: [] }),
    __metadata("design:type", Array)
], Subject.prototype, "instructors", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.ChapterSchema], default: [] }),
    __metadata("design:type", Array)
], Subject.prototype, "chapters", void 0);
exports.Subject = Subject = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Subject);
exports.SubjectSchema = mongoose_1.SchemaFactory.createForClass(Subject);
//# sourceMappingURL=subject.schema.js.map