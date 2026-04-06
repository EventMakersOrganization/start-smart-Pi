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
var SubjectsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubjectsService = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const subject_schema_1 = require("./schemas/subject.schema");
const crypto_1 = require("crypto");
const course_schema_1 = require("../courses/schemas/course.schema");
const course_upload_asset_schema_1 = require("./schemas/course-upload-asset.schema");
const exercise_schema_1 = require("../exercises/schemas/exercise.schema");
const prosit_quiz_asset_schema_1 = require("./schemas/prosit-quiz-asset.schema");
const resource_add_asset_schema_1 = require("./schemas/resource-add-asset.schema");
const video_asset_schema_1 = require("./schemas/video-asset.schema");
const quiz_submission_schema_1 = require("./schemas/quiz-submission.schema");
const quiz_file_submission_schema_1 = require("./schemas/quiz-file-submission.schema");
let SubjectsService = SubjectsService_1 = class SubjectsService {
    constructor(courseModel, exerciseModel, courseUploadAssetModel, prositQuizAssetModel, resourceAddAssetModel, videoAssetModel, subjectModel, quizSubmissionModel, quizFileSubmissionModel) {
        this.courseModel = courseModel;
        this.exerciseModel = exerciseModel;
        this.courseUploadAssetModel = courseUploadAssetModel;
        this.prositQuizAssetModel = prositQuizAssetModel;
        this.resourceAddAssetModel = resourceAddAssetModel;
        this.videoAssetModel = videoAssetModel;
        this.subjectModel = subjectModel;
        this.quizSubmissionModel = quizSubmissionModel;
        this.quizFileSubmissionModel = quizFileSubmissionModel;
        this.logger = new common_1.Logger(SubjectsService_1.name);
    }
    normalizeCode(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .replace(/_+/g, "_");
    }
    async generateUniqueSubjectCode(title) {
        const base = this.normalizeCode(title) || "SUBJECT";
        let candidate = base;
        let suffix = 2;
        while (await this.subjectModel.exists({ code: candidate })) {
            candidate = `${base}_${suffix}`;
            suffix += 1;
        }
        return candidate;
    }
    async ensureContentIds(subject) {
        let changed = false;
        for (const chapter of subject.chapters || []) {
            for (const subChapter of chapter.subChapters || []) {
                for (const content of subChapter.contents || []) {
                    if (!content.contentId) {
                        content.contentId = (0, crypto_1.randomUUID)();
                        changed = true;
                    }
                }
            }
        }
        if (changed) {
            subject.markModified("chapters");
            await subject.save();
        }
    }
    async resolveCourseLevel(subjectTitle) {
        const existingCourse = await this.courseModel
            .findOne({ subject: subjectTitle })
            .sort({ createdAt: 1 })
            .exec();
        return String(existingCourse?.level || "General").trim() || "General";
    }
    async upsertCourseChapter(subject, chapter) {
        const subjectTitle = String(subject.title || "").trim();
        const chapterTitle = String(chapter.title || "").trim();
        if (!subjectTitle || !chapterTitle) {
            return;
        }
        const level = await this.resolveCourseLevel(subjectTitle);
        await this.courseModel
            .findOneAndUpdate({
            subject: subjectTitle,
            title: chapterTitle,
            instructorId: subject.instructorId,
        }, {
            $set: {
                title: chapterTitle,
                description: String(chapter.description || "").trim() || chapterTitle,
                level,
                subject: subjectTitle,
                instructorId: subject.instructorId,
            },
            $setOnInsert: {
                modules: [],
            },
        }, { upsert: true, new: true, setDefaultsOnInsert: true })
            .exec();
    }
    async upsertCourseSubChapter(subject, chapter, subChapter) {
        const subjectTitle = String(subject.title || "").trim();
        const chapterTitle = String(chapter.title || "").trim();
        const subChapterTitle = String(subChapter.title || "").trim();
        if (!subjectTitle || !chapterTitle || !subChapterTitle) {
            return;
        }
        const level = await this.resolveCourseLevel(subjectTitle);
        const course = await this.courseModel
            .findOneAndUpdate({
            subject: subjectTitle,
            title: chapterTitle,
            instructorId: subject.instructorId,
        }, {
            $setOnInsert: {
                title: chapterTitle,
                description: String(chapter.description || "").trim() || chapterTitle,
                level,
                subject: subjectTitle,
                instructorId: subject.instructorId,
                modules: [],
            },
        }, { upsert: true, new: true, setDefaultsOnInsert: true })
            .exec();
        const modules = Array.isArray(course?.modules) ? [...course.modules] : [];
        const existingIndex = modules.findIndex((item) => Number(item.order) === Number(subChapter.order));
        const modulePayload = {
            title: subChapterTitle,
            description: String(subChapter.description || "").trim() || undefined,
            order: Number(subChapter.order) || 0,
        };
        if (existingIndex >= 0) {
            modules[existingIndex] = {
                ...modules[existingIndex],
                ...modulePayload,
            };
        }
        else {
            modules.push(modulePayload);
        }
        course.modules = modules;
        course.markModified("modules");
        await course.save();
    }
    async ensureCourseForChapter(subject, chapter) {
        const subjectTitle = String(subject.title || "").trim();
        const chapterTitle = String(chapter.title || "").trim();
        if (!subjectTitle || !chapterTitle) {
            return null;
        }
        const level = await this.resolveCourseLevel(subjectTitle);
        return this.courseModel
            .findOneAndUpdate({
            subject: subjectTitle,
            title: chapterTitle,
            instructorId: subject.instructorId,
        }, {
            $set: {
                title: chapterTitle,
                description: String(chapter.description || "").trim() || chapterTitle,
                level,
                subject: subjectTitle,
                instructorId: subject.instructorId,
            },
            $setOnInsert: {
                modules: [],
            },
        }, { upsert: true, new: true, setDefaultsOnInsert: true })
            .exec();
    }
    async persistMcqQuizInExercises(subject, chapter, quizQuestions) {
        if (!quizQuestions.length) {
            return;
        }
        const course = await this.ensureCourseForChapter(subject, chapter);
        if (!course?._id) {
            this.logger.warn("Skipping MCQ persistence: unable to resolve course");
            return;
        }
        const rows = quizQuestions
            .map((question) => {
            const options = Array.isArray(question.options) ? question.options : [];
            const idx = Number(question.correctOptionIndex);
            const answer = options[idx] || "";
            return {
                courseId: course._id,
                difficulty: exercise_schema_1.Difficulty.MEDIUM,
                content: String(question.question || "").trim(),
                correctAnswer: String(answer || "").trim(),
                type: exercise_schema_1.ExerciseType.MCQ,
            };
        })
            .filter((item) => item.content && item.correctAnswer);
        if (!rows.length) {
            return;
        }
        await this.exerciseModel.insertMany(rows);
    }
    async persistPrositOrQuizFileAsset(params) {
        const payload = {
            subjectId: params.subject._id,
            subjectTitle: String(params.subject.title || "").trim(),
            chapterOrder: Number(params.chapterOrder),
            chapterTitle: String(params.chapterTitle || "").trim(),
            subChapterOrder: Number(params.subChapterOrder),
            subChapterTitle: String(params.subChapterTitle || "").trim(),
            sourceContentId: String(params.sourceContentId || "").trim(),
            assetType: params.assetType,
            title: String(params.title || "").trim(),
            url: params.url ? String(params.url).trim() : undefined,
            fileName: params.fileName ? String(params.fileName).trim() : undefined,
            mimeType: params.mimeType ? String(params.mimeType).trim() : undefined,
            dueDate: params.dueDate,
            submissionInstructions: params.submissionInstructions
                ? String(params.submissionInstructions).trim()
                : undefined,
        };
        await this.prositQuizAssetModel.create(payload);
    }
    async persistCourseUploadAsset(params) {
        const payload = {
            subjectId: params.subject._id,
            subjectTitle: String(params.subject.title || "").trim(),
            chapterOrder: Number(params.chapterOrder),
            chapterTitle: String(params.chapterTitle || "").trim(),
            subChapterOrder: Number(params.subChapterOrder),
            subChapterTitle: String(params.subChapterTitle || "").trim(),
            sourceContentId: String(params.sourceContentId || "").trim(),
            assetType: params.assetType,
            title: String(params.title || "").trim(),
            url: params.url ? String(params.url).trim() : undefined,
            fileName: params.fileName ? String(params.fileName).trim() : undefined,
            mimeType: params.mimeType ? String(params.mimeType).trim() : undefined,
        };
        await this.courseUploadAssetModel.create(payload);
    }
    async persistVideoAsset(params) {
        const payload = {
            subjectId: params.subject._id,
            subjectTitle: String(params.subject.title || "").trim(),
            chapterOrder: Number(params.chapterOrder),
            chapterTitle: String(params.chapterTitle || "").trim(),
            subChapterOrder: Number(params.subChapterOrder),
            subChapterTitle: String(params.subChapterTitle || "").trim(),
            sourceContentId: String(params.sourceContentId || "").trim(),
            assetType: params.assetType,
            title: String(params.title || "").trim(),
            url: params.url ? String(params.url).trim() : undefined,
            fileName: params.fileName ? String(params.fileName).trim() : undefined,
            mimeType: params.mimeType ? String(params.mimeType).trim() : undefined,
        };
        await this.videoAssetModel.create(payload);
    }
    async persistResourceAddAsset(params) {
        const payload = {
            subjectId: params.subject._id,
            subjectTitle: String(params.subject.title || "").trim(),
            chapterOrder: Number(params.chapterOrder),
            chapterTitle: String(params.chapterTitle || "").trim(),
            subChapterOrder: Number(params.subChapterOrder),
            subChapterTitle: String(params.subChapterTitle || "").trim(),
            sourceContentId: String(params.sourceContentId || "").trim(),
            assetType: params.assetType,
            title: String(params.title || "").trim(),
            url: params.url ? String(params.url).trim() : undefined,
            fileName: params.fileName ? String(params.fileName).trim() : undefined,
            mimeType: params.mimeType ? String(params.mimeType).trim() : undefined,
            codeSnippet: params.codeSnippet
                ? String(params.codeSnippet).trim()
                : undefined,
        };
        await this.resourceAddAssetModel.create(payload);
    }
    validateQuizQuestions(quizQuestions) {
        quizQuestions.forEach((item, index) => {
            const question = String(item?.question || "").trim();
            const options = Array.isArray(item?.options)
                ? item.options.map((option) => String(option || "").trim())
                : [];
            const correctOptionIndex = Number(item?.correctOptionIndex);
            if (!question) {
                throw new common_2.BadRequestException(`Quiz question #${index + 1} is required`);
            }
            if (options.length < 2 || options.some((option) => !option)) {
                throw new common_2.BadRequestException(`Quiz question #${index + 1} must have at least 2 options`);
            }
            if (Number.isNaN(correctOptionIndex) ||
                correctOptionIndex < 0 ||
                correctOptionIndex >= options.length) {
                throw new common_2.BadRequestException(`Quiz question #${index + 1} has invalid correct option index`);
            }
        });
    }
    validateFolderTypeCompatibility(folder, type) {
        const allowedByFolder = {
            cours: ["file", "link"],
            exercices: ["quiz", "prosit"],
            videos: ["video", "file"],
            ressources: ["file", "link", "code"],
        };
        if (!allowedByFolder[folder]?.includes(type)) {
            throw new common_2.BadRequestException(`Type \"${type}\" is not allowed in folder \"${folder}\"`);
        }
    }
    async addChapter(subjectId, chapterDto) {
        const subject = await this.subjectModel.findById(subjectId).exec();
        if (!subject) {
            throw new common_2.NotFoundException(`Subject with ID "${subjectId}" not found`);
        }
        const chapter = {
            title: String(chapterDto.title || "").trim(),
            description: String(chapterDto.description || "").trim() || undefined,
            order: typeof chapterDto.order === "number"
                ? chapterDto.order
                : subject.chapters.length,
            subChapters: [],
        };
        if (!chapter.title) {
            throw new common_2.BadRequestException("Chapter title is required");
        }
        subject.chapters.push(chapter);
        await subject.save();
        await this.upsertCourseChapter(subject, chapter);
        return subject.populate("instructorId", "first_name last_name email");
    }
    async addSubChapter(subjectId, chapterOrder, subChapterDto) {
        const subject = await this.subjectModel.findById(subjectId).exec();
        if (!subject) {
            throw new common_2.NotFoundException(`Subject with ID "${subjectId}" not found`);
        }
        const chapter = subject.chapters.find((item) => Number(item.order) === Number(chapterOrder));
        if (!chapter) {
            throw new common_2.NotFoundException(`Chapter with order "${chapterOrder}" not found in this subject`);
        }
        const subChapter = {
            title: String(subChapterDto.title || "").trim(),
            description: String(subChapterDto.description || "").trim() || undefined,
            order: typeof subChapterDto.order === "number"
                ? subChapterDto.order
                : chapter.subChapters?.length || 0,
            contents: [],
        };
        if (!subChapter.title) {
            throw new common_2.BadRequestException("SubChapter title is required");
        }
        chapter.subChapters = chapter.subChapters || [];
        chapter.subChapters.push(subChapter);
        subject.markModified("chapters");
        await subject.save();
        await this.upsertCourseSubChapter(subject, chapter, subChapter);
        return subject.populate("instructorId", "first_name last_name email");
    }
    async deleteChapter(subjectId, chapterOrder) {
        const subject = await this.subjectModel.findById(subjectId).exec();
        if (!subject) {
            throw new common_2.NotFoundException(`Subject with ID "${subjectId}" not found`);
        }
        const chapterIndex = (subject.chapters || []).findIndex((item) => Number(item.order) === Number(chapterOrder));
        if (chapterIndex < 0) {
            throw new common_2.NotFoundException(`Chapter with order "${chapterOrder}" not found in this subject`);
        }
        const deletedChapter = subject.chapters[chapterIndex];
        const deletedChapterOrder = Number(deletedChapter?.order);
        const deletedChapterTitle = String(deletedChapter?.title || "").trim();
        subject.chapters.splice(chapterIndex, 1);
        subject.chapters = (subject.chapters || []).map((chapter, idx) => ({
            ...chapter,
            order: idx,
        }));
        subject.markModified("chapters");
        await subject.save();
        try {
            const linkedCourses = await this.courseModel
                .find({
                subject: String(subject.title || "").trim(),
                title: deletedChapterTitle,
                instructorId: subject.instructorId,
            })
                .select("_id")
                .exec();
            const courseIds = linkedCourses.map((course) => course._id);
            if (courseIds.length) {
                await this.exerciseModel
                    .deleteMany({ courseId: { $in: courseIds } })
                    .exec();
                await this.courseModel.deleteMany({ _id: { $in: courseIds } }).exec();
            }
            await this.prositQuizAssetModel
                .deleteMany({
                subjectId: subject._id,
                chapterOrder: deletedChapterOrder,
            })
                .exec();
            await this.courseUploadAssetModel
                .deleteMany({
                subjectId: subject._id,
                chapterOrder: deletedChapterOrder,
            })
                .exec();
            await this.videoAssetModel
                .deleteMany({
                subjectId: subject._id,
                chapterOrder: deletedChapterOrder,
            })
                .exec();
            await this.resourceAddAssetModel
                .deleteMany({
                subjectId: subject._id,
                chapterOrder: deletedChapterOrder,
            })
                .exec();
        }
        catch (cleanupError) {
            this.logger.warn(`Chapter cleanup warning: ${cleanupError?.message || cleanupError}`);
        }
        return subject.populate("instructorId", "first_name last_name email");
    }
    async addSubChapterContent(subjectId, chapterOrder, subChapterOrder, contentDto) {
        const subject = await this.subjectModel.findById(subjectId).exec();
        if (!subject) {
            throw new common_2.NotFoundException(`Subject with ID "${subjectId}" not found`);
        }
        const chapter = subject.chapters.find((item) => Number(item.order) === Number(chapterOrder));
        if (!chapter) {
            throw new common_2.NotFoundException(`Chapter with order "${chapterOrder}" not found in this subject`);
        }
        const subChapter = (chapter.subChapters || []).find((item) => Number(item.order) === Number(subChapterOrder));
        if (!subChapter) {
            throw new common_2.NotFoundException(`SubChapter with order "${subChapterOrder}" not found in this chapter`);
        }
        const folder = String(contentDto.folder || "cours").trim();
        const type = String(contentDto.type || "").trim();
        const title = String(contentDto.title || "").trim();
        const url = String(contentDto.url || "").trim();
        const quizText = String(contentDto.quizText || "").trim();
        const quizQuestions = Array.isArray(contentDto.quizQuestions)
            ? contentDto.quizQuestions
            : [];
        const fileName = String(contentDto.fileName || "").trim();
        const mimeType = String(contentDto.mimeType || "").trim();
        const dueDateRaw = String(contentDto.dueDate || "").trim();
        const submissionInstructions = String(contentDto.submissionInstructions || "").trim();
        const codeSnippet = String(contentDto.codeSnippet || "").trim();
        if (!title) {
            throw new common_2.BadRequestException("Content title is required");
        }
        this.validateFolderTypeCompatibility(folder, type);
        if ((type === "video" || type === "link") && !url) {
            throw new common_2.BadRequestException("URL is required for link/video content");
        }
        const hasQuizQuestions = quizQuestions.length > 0;
        const hasQuizFile = Boolean(fileName || url);
        if (type === "quiz" && !hasQuizQuestions && !hasQuizFile) {
            throw new common_2.BadRequestException("Quiz must have either inline questions or a quiz file");
        }
        if (type === "quiz" && hasQuizQuestions) {
            this.validateQuizQuestions(quizQuestions);
        }
        if (type === "file" && !fileName) {
            throw new common_2.BadRequestException("File name is required for file content");
        }
        let dueDate;
        if (type === "prosit") {
            if (!dueDateRaw) {
                throw new common_2.BadRequestException("Due date is required for prosit");
            }
            dueDate = new Date(dueDateRaw);
            if (Number.isNaN(dueDate.getTime())) {
                throw new common_2.BadRequestException("Invalid due date for prosit");
            }
            const hasInstructionFile = Boolean(fileName || url);
            if (!submissionInstructions && !hasInstructionFile) {
                throw new common_2.BadRequestException("Prosit requires either submission instructions text or an instruction file");
            }
        }
        if (type === "code" && !codeSnippet) {
            throw new common_2.BadRequestException("Code snippet is required for code content");
        }
        const normalizedQuizQuestions = type === "quiz"
            ? quizQuestions.map((item) => ({
                question: String(item.question || "").trim(),
                options: (item.options || []).map((option) => String(option || "").trim()),
                correctOptionIndex: Number(item.correctOptionIndex),
            }))
            : [];
        const contentId = (0, crypto_1.randomUUID)();
        if (folder === "exercices" && type === "quiz" && hasQuizQuestions) {
            await this.persistMcqQuizInExercises(subject, chapter, normalizedQuizQuestions);
        }
        if (folder === "exercices" &&
            (type === "prosit" ||
                (type === "quiz" && hasQuizFile && !hasQuizQuestions))) {
            await this.persistPrositOrQuizFileAsset({
                subject,
                chapterOrder,
                chapterTitle: String(chapter.title || ""),
                subChapterOrder,
                subChapterTitle: String(subChapter.title || ""),
                sourceContentId: contentId,
                assetType: type === "prosit"
                    ? prosit_quiz_asset_schema_1.PrositQuizAssetType.PROSIT
                    : prosit_quiz_asset_schema_1.PrositQuizAssetType.QUIZ_FILE,
                title,
                url: url || undefined,
                fileName: fileName || undefined,
                mimeType: mimeType || undefined,
                dueDate,
                submissionInstructions: submissionInstructions || undefined,
            });
        }
        if (folder === "cours" && type === "file") {
            await this.persistCourseUploadAsset({
                subject,
                chapterOrder,
                chapterTitle: String(chapter.title || ""),
                subChapterOrder,
                subChapterTitle: String(subChapter.title || ""),
                sourceContentId: contentId,
                assetType: course_upload_asset_schema_1.CourseUploadAssetType.COURSE_FILE,
                title,
                url: url || undefined,
                fileName: fileName || undefined,
                mimeType: mimeType || undefined,
            });
        }
        if (folder === "videos" && (type === "video" || type === "file")) {
            await this.persistVideoAsset({
                subject,
                chapterOrder,
                chapterTitle: String(chapter.title || ""),
                subChapterOrder,
                subChapterTitle: String(subChapter.title || ""),
                sourceContentId: contentId,
                assetType: type === "video"
                    ? video_asset_schema_1.VideoAssetType.VIDEO_LINK
                    : video_asset_schema_1.VideoAssetType.VIDEO_FILE,
                title,
                url: url || undefined,
                fileName: fileName || undefined,
                mimeType: mimeType || undefined,
            });
        }
        if (folder === "ressources" &&
            (type === "file" || type === "link" || type === "code")) {
            await this.persistResourceAddAsset({
                subject,
                chapterOrder,
                chapterTitle: String(chapter.title || ""),
                subChapterOrder,
                subChapterTitle: String(subChapter.title || ""),
                sourceContentId: contentId,
                assetType: type === "file"
                    ? resource_add_asset_schema_1.ResourceAddAssetType.RESOURCE_FILE
                    : type === "link"
                        ? resource_add_asset_schema_1.ResourceAddAssetType.RESOURCE_LINK
                        : resource_add_asset_schema_1.ResourceAddAssetType.RESOURCE_CODE,
                title,
                url: url || undefined,
                fileName: fileName || undefined,
                mimeType: mimeType || undefined,
                codeSnippet: codeSnippet || undefined,
            });
        }
        subChapter.contents = subChapter.contents || [];
        subChapter.contents.push({
            contentId,
            folder,
            type,
            title,
            url: url || undefined,
            quizText: quizText || undefined,
            quizQuestions: type === "quiz" ? normalizedQuizQuestions : undefined,
            fileName: fileName || undefined,
            mimeType: mimeType || undefined,
            dueDate,
            submissionInstructions: submissionInstructions || undefined,
            codeSnippet: codeSnippet || undefined,
            createdAt: new Date(),
        });
        subject.markModified("chapters");
        await subject.save();
        return subject.populate("instructorId", "first_name last_name email");
    }
    async updateSubChapterContent(subjectId, chapterOrder, subChapterOrder, contentId, dto) {
        const subject = await this.subjectModel.findById(subjectId).exec();
        if (!subject) {
            throw new common_2.NotFoundException(`Subject with ID "${subjectId}" not found`);
        }
        const chapter = subject.chapters.find((item) => Number(item.order) === Number(chapterOrder));
        if (!chapter) {
            throw new common_2.NotFoundException(`Chapter with order "${chapterOrder}" not found in this subject`);
        }
        const subChapter = (chapter.subChapters || []).find((item) => Number(item.order) === Number(subChapterOrder));
        if (!subChapter) {
            throw new common_2.NotFoundException(`SubChapter with order "${subChapterOrder}" not found in this chapter`);
        }
        const contentIndex = (subChapter.contents || []).findIndex((content) => String(content.contentId) === String(contentId));
        if (contentIndex < 0) {
            throw new common_2.NotFoundException(`Content with ID "${contentId}" not found in this subchapter`);
        }
        const content = subChapter.contents[contentIndex];
        const previousFolder = String(content.folder || "cours").trim();
        const previousType = String(content.type || "").trim();
        const folder = (dto.folder || content.folder || "cours");
        const type = (dto.type || content.type);
        const title = dto.title !== undefined ? String(dto.title || "").trim() : content.title;
        const url = dto.url !== undefined ? String(dto.url || "").trim() : content.url;
        const quizText = dto.quizText !== undefined
            ? String(dto.quizText || "").trim()
            : content.quizText;
        const quizQuestions = dto.quizQuestions !== undefined
            ? dto.quizQuestions
            : content.quizQuestions || [];
        const fileName = dto.fileName !== undefined
            ? String(dto.fileName || "").trim()
            : content.fileName;
        const mimeType = dto.mimeType !== undefined
            ? String(dto.mimeType || "").trim()
            : content.mimeType;
        const dueDateRaw = dto.dueDate !== undefined
            ? String(dto.dueDate || "").trim()
            : content.dueDate
                ? new Date(content.dueDate).toISOString()
                : "";
        const submissionInstructions = dto.submissionInstructions !== undefined
            ? String(dto.submissionInstructions || "").trim()
            : String(content.submissionInstructions || "").trim();
        const codeSnippet = dto.codeSnippet !== undefined
            ? String(dto.codeSnippet || "").trim()
            : String(content.codeSnippet || "").trim();
        if (!title) {
            throw new common_2.BadRequestException("Content title is required");
        }
        this.validateFolderTypeCompatibility(folder, type);
        if ((type === "video" || type === "link") && !url) {
            throw new common_2.BadRequestException("URL is required for link/video content");
        }
        const hasQuizQuestions = Array.isArray(quizQuestions) && quizQuestions.length > 0;
        const hasQuizFile = Boolean(fileName || url);
        if (type === "quiz" && !hasQuizQuestions && !hasQuizFile) {
            throw new common_2.BadRequestException("Quiz must have either inline questions or a quiz file");
        }
        if (type === "quiz" && hasQuizQuestions) {
            this.validateQuizQuestions(quizQuestions);
        }
        if (type === "file" && !fileName) {
            throw new common_2.BadRequestException("File name is required for file content");
        }
        let dueDate;
        if (type === "prosit") {
            if (!dueDateRaw) {
                throw new common_2.BadRequestException("Due date is required for prosit");
            }
            dueDate = new Date(dueDateRaw);
            if (Number.isNaN(dueDate.getTime())) {
                throw new common_2.BadRequestException("Invalid due date for prosit");
            }
            const hasInstructionFile = Boolean(fileName || url);
            if (!submissionInstructions && !hasInstructionFile) {
                throw new common_2.BadRequestException("Prosit requires either submission instructions text or an instruction file");
            }
        }
        if (type === "code" && !codeSnippet) {
            throw new common_2.BadRequestException("Code snippet is required for code content");
        }
        content.folder = folder;
        content.type = type;
        content.title = title;
        content.url = url || undefined;
        content.quizText = quizText || undefined;
        content.quizQuestions =
            type === "quiz"
                ? (quizQuestions || []).map((item) => ({
                    question: String(item.question || "").trim(),
                    options: (item.options || []).map((option) => String(option || "").trim()),
                    correctOptionIndex: Number(item.correctOptionIndex),
                }))
                : [];
        content.fileName = fileName || undefined;
        content.mimeType = mimeType || undefined;
        content.dueDate = dueDate;
        content.submissionInstructions = submissionInstructions || undefined;
        content.codeSnippet = codeSnippet || undefined;
        if (previousFolder === "cours" && previousType === "file") {
            await this.courseUploadAssetModel
                .deleteMany({
                subjectId: subject._id,
                sourceContentId: String(contentId),
            })
                .exec();
        }
        if (folder === "cours" && type === "file") {
            await this.persistCourseUploadAsset({
                subject,
                chapterOrder,
                chapterTitle: String(chapter.title || ""),
                subChapterOrder,
                subChapterTitle: String(subChapter.title || ""),
                sourceContentId: String(contentId),
                assetType: course_upload_asset_schema_1.CourseUploadAssetType.COURSE_FILE,
                title,
                url: url || undefined,
                fileName: fileName || undefined,
                mimeType: mimeType || undefined,
            });
        }
        subject.markModified("chapters");
        await subject.save();
        return subject.populate("instructorId", "first_name last_name email");
    }
    async deleteSubChapterContent(subjectId, chapterOrder, subChapterOrder, contentId) {
        const subject = await this.subjectModel.findById(subjectId).exec();
        if (!subject) {
            throw new common_2.NotFoundException(`Subject with ID "${subjectId}" not found`);
        }
        const chapter = subject.chapters.find((item) => Number(item.order) === Number(chapterOrder));
        if (!chapter) {
            throw new common_2.NotFoundException(`Chapter with order "${chapterOrder}" not found in this subject`);
        }
        const subChapter = (chapter.subChapters || []).find((item) => Number(item.order) === Number(subChapterOrder));
        if (!subChapter) {
            throw new common_2.NotFoundException(`SubChapter with order "${subChapterOrder}" not found in this chapter`);
        }
        const before = (subChapter.contents || []).length;
        subChapter.contents = (subChapter.contents || []).filter((content) => String(content.contentId) !== String(contentId));
        if (subChapter.contents.length === before) {
            throw new common_2.NotFoundException(`Content with ID "${contentId}" not found in this subchapter`);
        }
        await this.courseUploadAssetModel
            .deleteMany({
            subjectId: subject._id,
            sourceContentId: String(contentId),
        })
            .exec();
        subject.markModified("chapters");
        await subject.save();
        return subject.populate("instructorId", "first_name last_name email");
    }
    async addChapterContent(subjectId, chapterOrder, _contentDto) {
        throw new common_2.BadRequestException(`Chapter content is now nested under subchapters. Use POST /subjects/${subjectId}/chapters/${chapterOrder}/subchapters/:subChapterOrder/contents`);
    }
    async updateChapterContent(subjectId, chapterOrder, _contentId, _dto) {
        throw new common_2.BadRequestException(`Chapter content is now nested under subchapters. Use PUT /subjects/${subjectId}/chapters/${chapterOrder}/subchapters/:subChapterOrder/contents/:contentId`);
    }
    async deleteChapterContent(subjectId, chapterOrder, _contentId) {
        throw new common_2.BadRequestException(`Chapter content is now nested under subchapters. Use DELETE /subjects/${subjectId}/chapters/${chapterOrder}/subchapters/:subChapterOrder/contents/:contentId`);
    }
    async submitQuiz(studentId, submitQuizDto) {
        const scorePercentage = Math.round((submitQuizDto.scoreObtained / submitQuizDto.totalQuestions) * 100);
        const submission = new this.quizSubmissionModel({
            studentId: studentId,
            quizId: submitQuizDto.quizId,
            quizTitle: submitQuizDto.quizTitle,
            subjectTitle: submitQuizDto.subjectTitle,
            chapterTitle: submitQuizDto.chapterTitle,
            subChapterTitle: submitQuizDto.subChapterTitle,
            totalQuestions: submitQuizDto.totalQuestions,
            scoreObtained: submitQuizDto.scoreObtained,
            scorePercentage,
            answers: submitQuizDto.answers,
            submittedAt: new Date(),
        });
        return submission.save();
    }
    async getStudentQuizSubmissions(studentId) {
        return this.quizSubmissionModel
            .find({ studentId })
            .sort({ submittedAt: -1 })
            .exec();
    }
    async getQuizSubmission(submissionId) {
        const submission = await this.quizSubmissionModel
            .findById(submissionId)
            .exec();
        if (!submission) {
            throw new common_2.NotFoundException(`Quiz submission with ID "${submissionId}" not found`);
        }
        return submission;
    }
    async getLatestStudentQuizSubmission(studentId, quizId) {
        return this.quizSubmissionModel
            .findOne({ studentId, quizId })
            .sort({ submittedAt: -1 })
            .exec();
    }
    async submitQuizFile(studentId, dto, file) {
        const submission = new this.quizFileSubmissionModel({
            studentId,
            quizId: String(dto.quizId || "").trim(),
            quizTitle: String(dto.quizTitle || "").trim(),
            subjectTitle: String(dto.subjectTitle || "").trim(),
            chapterTitle: String(dto.chapterTitle || "").trim(),
            subChapterTitle: String(dto.subChapterTitle || "").trim(),
            responseFileUrl: String(file.fileUrl || "").trim(),
            responseFileName: String(file.fileName || "").trim(),
            responseMimeType: file.mimeType
                ? String(file.mimeType).trim()
                : undefined,
            status: quiz_file_submission_schema_1.QuizFileSubmissionStatus.PENDING,
            submittedAt: new Date(),
        });
        return submission.save();
    }
    async getStudentQuizFileSubmissions(studentId) {
        return this.quizFileSubmissionModel
            .find({ studentId })
            .sort({ submittedAt: -1 })
            .exec();
    }
    async getInstructorQuizFileSubmissions(instructorId) {
        const ownedSubjects = await this.subjectModel
            .find({ instructorId })
            .select("title")
            .exec();
        const subjectTitles = ownedSubjects
            .map((subject) => String(subject?.title || "").trim())
            .filter((title) => !!title);
        if (!subjectTitles.length) {
            return [];
        }
        return this.quizFileSubmissionModel
            .find({ subjectTitle: { $in: subjectTitles } })
            .populate("studentId", "first_name last_name email")
            .sort({ submittedAt: -1 })
            .exec();
    }
    async gradeQuizFileSubmission(submissionId, graderId, dto) {
        const submission = await this.quizFileSubmissionModel
            .findById(submissionId)
            .exec();
        if (!submission) {
            throw new common_2.NotFoundException(`Quiz file submission with ID "${submissionId}" not found`);
        }
        submission.grade = Number(dto.grade);
        submission.teacherFeedback = dto.teacherFeedback
            ? String(dto.teacherFeedback).trim()
            : undefined;
        submission.correctAnswersCount =
            typeof dto.correctAnswersCount === "number"
                ? Number(dto.correctAnswersCount)
                : undefined;
        submission.totalQuestionsCount =
            typeof dto.totalQuestionsCount === "number"
                ? Number(dto.totalQuestionsCount)
                : undefined;
        submission.status = quiz_file_submission_schema_1.QuizFileSubmissionStatus.GRADED;
        submission.gradedBy = graderId;
        submission.gradedAt = new Date();
        return submission.save();
    }
    async create(dto) {
        const instructorIds = this.normalizeIds(dto.instructorIds);
        await this.assertAllInstructorsExist(instructorIds);
        const subject = await this.subjectModel.create({
            name: dto.name,
            description: dto.description || '',
            instructors: instructorIds.map((id) => new mongoose_2.Types.ObjectId(id)),
        });
        return this.findOne(subject._id.toString());
    }
    async findAll() {
        const subjects = await this.subjectModel
            .find()
            .sort({ createdAt: -1 })
            .populate('instructors', 'first_name last_name email role')
            .exec();
        return subjects.map((subject) => this.toResponse(subject));
    }
    async findOne(id) {
        const subject = await this.subjectModel
            .findById(id)
            .populate('instructors', 'first_name last_name email role')
            .exec();
        if (!subject) {
            throw new common_2.NotFoundException('Subject not found');
        }
        return this.toResponse(subject);
    }
    async update(id, dto) {
        const subject = await this.subjectModel.findById(id);
        if (!subject) {
            throw new common_2.NotFoundException('Subject not found');
        }
        if (dto.name !== undefined) {
            subject.name = dto.name;
        }
        if (dto.description !== undefined) {
            subject.description = dto.description;
        }
        if (dto.instructorIds !== undefined) {
            const instructorIds = this.normalizeIds(dto.instructorIds);
            await this.assertAllInstructorsExist(instructorIds);
            subject.instructors = instructorIds.map((instructorId) => new mongoose_2.Types.ObjectId(instructorId));
        }
        await subject.save();
        return this.findOne(id);
    }
    async remove(id) {
        const deleted = await this.subjectModel.findByIdAndDelete(id).exec();
        if (!deleted) {
            throw new common_2.NotFoundException('Subject not found');
        }
        return { success: true };
    }
    normalizeIds(ids) {
        if (!Array.isArray(ids) || ids.length === 0) {
            throw new common_2.BadRequestException('At least one instructor is required');
        }
        return [...new Set(ids.map((id) => id?.trim()).filter(Boolean))];
    }
    async assertAllInstructorsExist(instructorIds) {
        const instructors = await this.userModel.find({
            _id: { $in: instructorIds },
            role: { $regex: /^(instructor|teacher)$/i },
        });
        if (instructors.length !== instructorIds.length) {
            throw new common_2.BadRequestException('One or more selected instructors are invalid');
        }
    }
    toResponse(subject) {
        return {
            id: subject._id,
            name: subject.name,
            description: subject.description,
            instructors: (subject.instructors || []).map((instructor) => ({
                id: instructor._id,
                first_name: instructor.first_name,
                last_name: instructor.last_name,
                email: instructor.email,
                role: instructor.role,
            })),
            createdAt: subject.createdAt,
            updatedAt: subject.updatedAt,
        };
    }
};
exports.SubjectsService = SubjectsService;
exports.SubjectsService = SubjectsService = SubjectsService_1 = __decorate([
    (0, common_2.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(course_schema_1.Course.name)),
    __param(1, (0, mongoose_1.InjectModel)(exercise_schema_1.Exercise.name)),
    __param(2, (0, mongoose_1.InjectModel)(course_upload_asset_schema_1.CourseUploadAsset.name)),
    __param(3, (0, mongoose_1.InjectModel)(prosit_quiz_asset_schema_1.PrositQuizAsset.name)),
    __param(4, (0, mongoose_1.InjectModel)(resource_add_asset_schema_1.ResourceAddAsset.name)),
    __param(5, (0, mongoose_1.InjectModel)(video_asset_schema_1.VideoAsset.name)),
    __param(6, (0, mongoose_1.InjectModel)(subject_schema_1.Subject.name)),
    __param(7, (0, mongoose_1.InjectModel)(quiz_submission_schema_1.QuizSubmission.name)),
    __param(8, (0, mongoose_1.InjectModel)(quiz_file_submission_schema_1.QuizFileSubmission.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], SubjectsService);
//# sourceMappingURL=subjects.service.js.map