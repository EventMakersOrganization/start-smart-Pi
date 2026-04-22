import { Logger } from "@nestjs/common";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Subject, SubjectDocument } from "./schemas/subject.schema";
import { CreateSubjectDto } from "./dto/create-subject.dto";
import { UpdateSubjectDto } from "./dto/update-subject.dto";
import { randomUUID } from "crypto";
import { FilterQuery } from "mongoose";
import { AddChapterDto } from "./dto/add-chapter.dto";
import { AddChapterContentDto } from "./dto/add-chapter-content.dto";
import { AddSubChapterDto } from "./dto/add-subchapter.dto";
import { AddSubChapterContentDto } from "./dto/add-subchapter-content.dto";
import { UpdateChapterContentDto } from "./dto/update-chapter-content.dto";
import { UpdateSubChapterContentDto } from "./dto/update-subchapter-content.dto";
import { SubmitQuizDto } from "./dto/submit-quiz.dto";
import { Course, CourseDocument } from "../courses/schemas/course.schema";
import {
  CourseUploadAsset,
  CourseUploadAssetDocument,
  CourseUploadAssetType,
} from "./schemas/course-upload-asset.schema";
import {
  Difficulty,
  Exercise,
  ExerciseDocument,
  ExerciseType,
} from "../exercises/schemas/exercise.schema";
import {
  PrositQuizAsset,
  PrositQuizAssetDocument,
  PrositQuizAssetType,
} from "./schemas/prosit-quiz-asset.schema";
import {
  ResourceAddAsset,
  ResourceAddAssetDocument,
  ResourceAddAssetType,
} from "./schemas/resource-add-asset.schema";
import {
  VideoAsset,
  VideoAssetDocument,
  VideoAssetType,
} from "./schemas/video-asset.schema";
import {
  QuizSubmission,
  QuizSubmissionDocument,
} from "./schemas/quiz-submission.schema";
import {
  QuizFileSubmission,
  QuizFileSubmissionDocument,
  QuizFileSubmissionStatus,
} from "./schemas/quiz-file-submission.schema";
import { SubmitQuizFileDto } from "./dto/submit-quiz-file.dto";
import { GradeQuizFileSubmissionDto } from "./dto/grade-quiz-file-submission.dto";
import {
  ClassEnrollment,
  ClassEnrollmentDocument,
} from "../academic/schemas/class-enrollment.schema";
import {
  ClassSubject,
  ClassSubjectDocument,
} from "../academic/schemas/class-subject.schema";
import { UserRole } from "../users/schemas/user.schema";

@Injectable()
export class SubjectsService {
  private readonly logger = new Logger(SubjectsService.name);

  constructor(
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(Exercise.name)
    private exerciseModel: Model<ExerciseDocument>,
    @InjectModel(CourseUploadAsset.name)
    private courseUploadAssetModel: Model<CourseUploadAssetDocument>,
    @InjectModel(PrositQuizAsset.name)
    private prositQuizAssetModel: Model<PrositQuizAssetDocument>,
    @InjectModel(ResourceAddAsset.name)
    private resourceAddAssetModel: Model<ResourceAddAssetDocument>,
    @InjectModel(VideoAsset.name)
    private videoAssetModel: Model<VideoAssetDocument>,
    @InjectModel(Subject.name) private subjectModel: Model<SubjectDocument>,
    @InjectModel(QuizSubmission.name)
    private quizSubmissionModel: Model<QuizSubmissionDocument>,
    @InjectModel(QuizFileSubmission.name)
    private quizFileSubmissionModel: Model<QuizFileSubmissionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ClassEnrollment.name)
    private classEnrollmentModel: Model<ClassEnrollmentDocument>,
    @InjectModel(ClassSubject.name)
    private classSubjectModel: Model<ClassSubjectDocument>,
  ) {}

  private async assertStudentHasSubjectAccess(
    studentId: string,
    subjectId: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(subjectId)) {
      throw new NotFoundException("Subject not found");
    }
    const enrollment = await this.classEnrollmentModel
      .findOne({ studentId: new Types.ObjectId(studentId) })
      .exec();
    if (!enrollment) {
      throw new ForbiddenException(
        "You must be enrolled in a class to view subjects",
      );
    }
    const linked = await this.classSubjectModel
      .exists({
        schoolClassId: enrollment.schoolClassId,
        subjectId: new Types.ObjectId(subjectId),
      })
      .exec();
    if (!linked) {
      throw new ForbiddenException(
        "This subject is not assigned to your class",
      );
    }
  }

  async ensureStudentHasSubjectAccess(
    studentId: string,
    subjectId: string,
  ): Promise<void> {
    await this.assertStudentHasSubjectAccess(studentId, subjectId);
  }

  private async findAllForEnrolledStudent(studentId: string) {
    const enrollment = await this.classEnrollmentModel
      .findOne({ studentId: new Types.ObjectId(studentId) })
      .exec();
    if (!enrollment) {
      return [];
    }
    const links = await this.classSubjectModel
      .find({ schoolClassId: enrollment.schoolClassId })
      .select("subjectId")
      .lean()
      .exec();
    const ids = [
      ...new Set(
        links
          .map((l) => l.subjectId)
          .filter((id) => id != null)
          .map((id) => String(id)),
      ),
    ].filter((id) => Types.ObjectId.isValid(id));
    if (ids.length === 0) {
      return [];
    }
    const subjects = await this.subjectModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .sort({ createdAt: -1 })
      .populate("instructors", "first_name last_name email role")
      .exec();

    return subjects.map((subject) => this.toResponse(subject));
  }

  /** Course documents still use a single `instructorId`; mirror the first subject instructor. */
  private primaryCourseInstructorId(
    subject: SubjectDocument,
  ): Types.ObjectId | undefined {
    const list = subject.instructors || [];
    const raw = list[0];
    if (raw == null) {
      return undefined;
    }
    return raw instanceof Types.ObjectId
      ? raw
      : new Types.ObjectId(String(raw));
  }

  private normalizeCode(value: string): string {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_");
  }

  private async generateUniqueSubjectCode(title: string): Promise<string> {
    const base = this.normalizeCode(title) || "SUBJECT";
    let candidate = base;
    let suffix = 2;

    while (await this.subjectModel.exists({ code: candidate })) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  private async ensureContentIds(subject: SubjectDocument): Promise<void> {
    let changed = false;

    for (const chapter of subject.chapters || []) {
      // Handle 3-level hierarchy: chapter.subChapters[].contents[]
      for (const subChapter of chapter.subChapters || []) {
        for (const content of subChapter.contents || []) {
          if (!content.contentId) {
            (content as any).contentId = randomUUID();
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

  private async resolveCourseLevel(subjectTitle: string): Promise<string> {
    const existingCourse = await this.courseModel
      .findOne({ subject: subjectTitle })
      .sort({ createdAt: 1 })
      .exec();

    return String(existingCourse?.level || "General").trim() || "General";
  }

  private async upsertCourseChapter(
    subject: SubjectDocument,
    chapter: { title: string; description?: string; order: number },
  ): Promise<void> {
    const subjectTitle = String(subject.title || "").trim();
    const chapterTitle = String(chapter.title || "").trim();
    if (!subjectTitle || !chapterTitle) {
      return;
    }

    const instructorId = this.primaryCourseInstructorId(subject);
    if (!instructorId) {
      return;
    }

    const level = await this.resolveCourseLevel(subjectTitle);
    await this.courseModel
      .findOneAndUpdate(
        {
          subject: subjectTitle,
          title: chapterTitle,
          instructorId,
        },
        {
          $set: {
            title: chapterTitle,
            description:
              String(chapter.description || "").trim() || chapterTitle,
            level,
            subject: subjectTitle,
            instructorId,
          },
          $setOnInsert: {
            modules: [],
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  private async upsertCourseSubChapter(
    subject: SubjectDocument,
    chapter: { title: string; description?: string },
    subChapter: { title: string; description?: string; order: number },
  ): Promise<void> {
    const subjectTitle = String(subject.title || "").trim();
    const chapterTitle = String(chapter.title || "").trim();
    const subChapterTitle = String(subChapter.title || "").trim();
    if (!subjectTitle || !chapterTitle || !subChapterTitle) {
      return;
    }

    const instructorId = this.primaryCourseInstructorId(subject);
    if (!instructorId) {
      return;
    }

    const level = await this.resolveCourseLevel(subjectTitle);
    const course = await this.courseModel
      .findOneAndUpdate(
        {
          subject: subjectTitle,
          title: chapterTitle,
          instructorId,
        },
        {
          $setOnInsert: {
            title: chapterTitle,
            description:
              String(chapter.description || "").trim() || chapterTitle,
            level,
            subject: subjectTitle,
            instructorId,
            modules: [],
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    const modules = Array.isArray(course?.modules) ? [...course.modules] : [];
    const existingIndex = modules.findIndex(
      (item) => Number(item.order) === Number(subChapter.order),
    );

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
    } else {
      modules.push(modulePayload as any);
    }

    course.modules = modules as any;
    course.markModified("modules");
    await course.save();
  }

  private async ensureCourseForChapter(
    subject: SubjectDocument,
    chapter: { title: string; description?: string; order: number },
  ): Promise<CourseDocument | null> {
    const subjectTitle = String(subject.title || "").trim();
    const chapterTitle = String(chapter.title || "").trim();
    if (!subjectTitle || !chapterTitle) {
      return null;
    }

    const instructorId = this.primaryCourseInstructorId(subject);
    if (!instructorId) {
      return null;
    }

    const level = await this.resolveCourseLevel(subjectTitle);
    return this.courseModel
      .findOneAndUpdate(
        {
          subject: subjectTitle,
          title: chapterTitle,
          instructorId,
        },
        {
          $set: {
            title: chapterTitle,
            description:
              String(chapter.description || "").trim() || chapterTitle,
            level,
            subject: subjectTitle,
            instructorId,
          },
          $setOnInsert: {
            modules: [],
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  private async persistMcqQuizInExercises(
    subject: SubjectDocument,
    chapter: { title: string; description?: string; order: number },
    quizQuestions: Array<{
      question: string;
      options: string[];
      correctOptionIndex: number;
    }>,
  ): Promise<void> {
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
          difficulty: Difficulty.MEDIUM,
          content: String(question.question || "").trim(),
          correctAnswer: String(answer || "").trim(),
          type: ExerciseType.MCQ,
        };
      })
      .filter((item) => item.content && item.correctAnswer);

    if (!rows.length) {
      return;
    }

    await this.exerciseModel.insertMany(rows);
  }

  private async persistPrositOrQuizFileAsset(params: {
    subject: SubjectDocument;
    chapterOrder: number;
    chapterTitle: string;
    subChapterOrder: number;
    subChapterTitle: string;
    sourceContentId: string;
    assetType: PrositQuizAssetType;
    title: string;
    url?: string;
    fileName?: string;
    mimeType?: string;
    dueDate?: Date;
    submissionInstructions?: string;
  }): Promise<void> {
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

  private async persistCourseUploadAsset(params: {
    subject: SubjectDocument;
    chapterOrder: number;
    chapterTitle: string;
    subChapterOrder: number;
    subChapterTitle: string;
    sourceContentId: string;
    assetType: CourseUploadAssetType;
    title: string;
    url?: string;
    fileName?: string;
    mimeType?: string;
  }): Promise<void> {
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

  private async persistVideoAsset(params: {
    subject: SubjectDocument;
    chapterOrder: number;
    chapterTitle: string;
    subChapterOrder: number;
    subChapterTitle: string;
    sourceContentId: string;
    assetType: VideoAssetType;
    title: string;
    url?: string;
    fileName?: string;
    mimeType?: string;
  }): Promise<void> {
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

  private async persistResourceAddAsset(params: {
    subject: SubjectDocument;
    chapterOrder: number;
    chapterTitle: string;
    subChapterOrder: number;
    subChapterTitle: string;
    sourceContentId: string;
    assetType: ResourceAddAssetType;
    title: string;
    url?: string;
    fileName?: string;
    mimeType?: string;
    codeSnippet?: string;
  }): Promise<void> {
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

  private validateQuizQuestions(quizQuestions: any[]): void {
    quizQuestions.forEach((item, index) => {
      const question = String(item?.question || "").trim();
      const options = Array.isArray(item?.options)
        ? item.options.map((option) => String(option || "").trim())
        : [];
      const correctOptionIndex = Number(item?.correctOptionIndex);

      if (!question) {
        throw new BadRequestException(
          `Quiz question #${index + 1} is required`,
        );
      }

      if (options.length < 2 || options.some((option) => !option)) {
        throw new BadRequestException(
          `Quiz question #${index + 1} must have at least 2 options`,
        );
      }

      if (
        Number.isNaN(correctOptionIndex) ||
        correctOptionIndex < 0 ||
        correctOptionIndex >= options.length
      ) {
        throw new BadRequestException(
          `Quiz question #${index + 1} has invalid correct option index`,
        );
      }
    });
  }

  private validateFolderTypeCompatibility(
    folder: "cours" | "exercices" | "videos" | "ressources",
    type: "file" | "quiz" | "video" | "link" | "prosit" | "code",
  ): void {
    const allowedByFolder: Record<string, string[]> = {
      cours: ["file", "link"],
      exercices: ["quiz", "prosit"],
      videos: ["video", "file"],
      ressources: ["file", "link", "code"],
    };

    if (!allowedByFolder[folder]?.includes(type)) {
      throw new BadRequestException(
        `Type \"${type}\" is not allowed in folder \"${folder}\"`,
      );
    }
  }

  async addChapter(
    subjectId: string,
    chapterDto: AddChapterDto,
  ): Promise<Subject> {
    const subject = await this.subjectModel.findById(subjectId).exec();
    if (!subject) {
      throw new NotFoundException(`Subject with ID "${subjectId}" not found`);
    }

    const chapter = {
      title: String(chapterDto.title || "").trim(),
      description: String(chapterDto.description || "").trim() || undefined,
      order:
        typeof chapterDto.order === "number"
          ? chapterDto.order
          : subject.chapters.length,
      subChapters: [],
    };

    if (!chapter.title) {
      throw new BadRequestException("Chapter title is required");
    }

    subject.chapters.push(chapter as any);
    await subject.save();
    await this.upsertCourseChapter(subject, chapter);
    return subject.populate("instructors", "first_name last_name email");
  }

  // ==================== SubChapter Methods ====================

  async addSubChapter(
    subjectId: string,
    chapterOrder: number,
    subChapterDto: AddSubChapterDto,
  ): Promise<Subject> {
    const subject = await this.subjectModel.findById(subjectId).exec();
    if (!subject) {
      throw new NotFoundException(`Subject with ID "${subjectId}" not found`);
    }

    const chapter = subject.chapters.find(
      (item) => Number(item.order) === Number(chapterOrder),
    );
    if (!chapter) {
      throw new NotFoundException(
        `Chapter with order "${chapterOrder}" not found in this subject`,
      );
    }

    const subChapter = {
      title: String(subChapterDto.title || "").trim(),
      description: String(subChapterDto.description || "").trim() || undefined,
      order:
        typeof subChapterDto.order === "number"
          ? subChapterDto.order
          : chapter.subChapters?.length || 0,
      contents: [],
    };

    if (!subChapter.title) {
      throw new BadRequestException("SubChapter title is required");
    }

    chapter.subChapters = chapter.subChapters || [];
    chapter.subChapters.push(subChapter as any);

    subject.markModified("chapters");
    await subject.save();
    await this.upsertCourseSubChapter(subject, chapter, subChapter);
    return subject.populate("instructors", "first_name last_name email");
  }

  async deleteChapter(
    subjectId: string,
    chapterOrder: number,
  ): Promise<Subject> {
    const subject = await this.subjectModel.findById(subjectId).exec();
    if (!subject) {
      throw new NotFoundException(`Subject with ID "${subjectId}" not found`);
    }

    const chapterIndex = (subject.chapters || []).findIndex(
      (item) => Number(item.order) === Number(chapterOrder),
    );
    if (chapterIndex < 0) {
      throw new NotFoundException(
        `Chapter with order "${chapterOrder}" not found in this subject`,
      );
    }

    const deletedChapter: any = subject.chapters[chapterIndex];
    const deletedChapterOrder = Number(deletedChapter?.order);
    const deletedChapterTitle = String(deletedChapter?.title || "").trim();

    // Remove chapter from subject then normalize chapter orders to avoid duplicates.
    subject.chapters.splice(chapterIndex, 1);
    subject.chapters = (subject.chapters || []).map(
      (chapter: any, idx: number) => ({
        ...chapter,
        order: idx,
      }),
    ) as any;

    subject.markModified("chapters");
    await subject.save();

    // Best-effort cleanup in synchronized collections.
    try {
      const primaryInstructorId = this.primaryCourseInstructorId(subject);
      const courseFilter: FilterQuery<CourseDocument> = {
        subject: String(subject.title || "").trim(),
        title: deletedChapterTitle,
      };
      if (primaryInstructorId) {
        courseFilter.instructorId = primaryInstructorId;
      }
      const linkedCourses = await this.courseModel
        .find(courseFilter)
        .select("_id")
        .exec();

      const courseIds = linkedCourses.map((course: any) => course._id);
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
    } catch (cleanupError: any) {
      this.logger.warn(
        `Chapter cleanup warning: ${cleanupError?.message || cleanupError}`,
      );
    }

    return subject.populate("instructors", "first_name last_name email");
  }

  async addSubChapterContent(
    subjectId: string,
    chapterOrder: number,
    subChapterOrder: number,
    contentDto: AddSubChapterContentDto,
  ): Promise<Subject> {
    const subject = await this.subjectModel.findById(subjectId).exec();
    if (!subject) {
      throw new NotFoundException(`Subject with ID "${subjectId}" not found`);
    }

    const chapter = subject.chapters.find(
      (item) => Number(item.order) === Number(chapterOrder),
    );
    if (!chapter) {
      throw new NotFoundException(
        `Chapter with order "${chapterOrder}" not found in this subject`,
      );
    }

    const subChapter = (chapter.subChapters || []).find(
      (item: any) => Number(item.order) === Number(subChapterOrder),
    );
    if (!subChapter) {
      throw new NotFoundException(
        `SubChapter with order "${subChapterOrder}" not found in this chapter`,
      );
    }

    const folder = String(contentDto.folder || "cours").trim() as
      | "cours"
      | "exercices"
      | "videos"
      | "ressources";
    const type = String(contentDto.type || "").trim() as
      | "file"
      | "quiz"
      | "video"
      | "link"
      | "prosit"
      | "code";
    const title = String(contentDto.title || "").trim();
    const url = String(contentDto.url || "").trim();
    const quizText = String(contentDto.quizText || "").trim();
    const quizQuestions = Array.isArray(contentDto.quizQuestions)
      ? contentDto.quizQuestions
      : [];
    const fileName = String(contentDto.fileName || "").trim();
    const mimeType = String(contentDto.mimeType || "").trim();
    const dueDateRaw = String(contentDto.dueDate || "").trim();
    const submissionInstructions = String(
      contentDto.submissionInstructions || "",
    ).trim();
    const codeSnippet = String(contentDto.codeSnippet || "").trim();

    if (!title) {
      throw new BadRequestException("Content title is required");
    }

    this.validateFolderTypeCompatibility(folder, type);

    if (type === "link" && !url) {
      throw new BadRequestException("URL is required for link content");
    }
    if (type === "video" && !fileName && !url) {
      throw new BadRequestException(
        "A video file or URL is required for video content",
      );
    }

    const hasQuizQuestions = quizQuestions.length > 0;
    const hasQuizFile = Boolean(fileName || url);

    if (type === "quiz" && !hasQuizQuestions && !hasQuizFile) {
      throw new BadRequestException(
        "Quiz must have either inline questions or a quiz file",
      );
    }

    if (type === "quiz" && hasQuizQuestions) {
      this.validateQuizQuestions(quizQuestions);
    }

    if (type === "file" && !fileName) {
      throw new BadRequestException("File name is required for file content");
    }

    let dueDate: Date | undefined;
    if (type === "prosit") {
      if (!dueDateRaw) {
        throw new BadRequestException("Due date is required for prosit");
      }
      dueDate = new Date(dueDateRaw);
      if (Number.isNaN(dueDate.getTime())) {
        throw new BadRequestException("Invalid due date for prosit");
      }
      const hasInstructionFile = Boolean(fileName || url);
      if (!submissionInstructions && !hasInstructionFile) {
        throw new BadRequestException(
          "Prosit requires either submission instructions text or an instruction file",
        );
      }
    }

    if (type === "code" && !codeSnippet) {
      throw new BadRequestException(
        "Code snippet is required for code content",
      );
    }

    const normalizedQuizQuestions =
      type === "quiz"
        ? quizQuestions.map((item) => ({
            question: String(item.question || "").trim(),
            options: (item.options || []).map((option) =>
              String(option || "").trim(),
            ),
            correctOptionIndex: Number(item.correctOptionIndex),
          }))
        : [];

    const contentId = randomUUID();

    if (folder === "exercices" && type === "quiz" && hasQuizQuestions) {
      await this.persistMcqQuizInExercises(
        subject,
        chapter as any,
        normalizedQuizQuestions,
      );
    }

    if (
      folder === "exercices" &&
      (type === "prosit" ||
        (type === "quiz" && hasQuizFile && !hasQuizQuestions))
    ) {
      await this.persistPrositOrQuizFileAsset({
        subject,
        chapterOrder,
        chapterTitle: String((chapter as any).title || ""),
        subChapterOrder,
        subChapterTitle: String((subChapter as any).title || ""),
        sourceContentId: contentId,
        assetType:
          type === "prosit"
            ? PrositQuizAssetType.PROSIT
            : PrositQuizAssetType.QUIZ_FILE,
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
        chapterTitle: String((chapter as any).title || ""),
        subChapterOrder,
        subChapterTitle: String((subChapter as any).title || ""),
        sourceContentId: contentId,
        assetType: CourseUploadAssetType.COURSE_FILE,
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
        chapterTitle: String((chapter as any).title || ""),
        subChapterOrder,
        subChapterTitle: String((subChapter as any).title || ""),
        sourceContentId: contentId,
        assetType:
          type === "video"
            ? VideoAssetType.VIDEO_LINK
            : VideoAssetType.VIDEO_FILE,
        title,
        url: url || undefined,
        fileName: fileName || undefined,
        mimeType: mimeType || undefined,
      });
    }

    if (
      folder === "ressources" &&
      (type === "file" || type === "link" || type === "code")
    ) {
      await this.persistResourceAddAsset({
        subject,
        chapterOrder,
        chapterTitle: String((chapter as any).title || ""),
        subChapterOrder,
        subChapterTitle: String((subChapter as any).title || ""),
        sourceContentId: contentId,
        assetType:
          type === "file"
            ? ResourceAddAssetType.RESOURCE_FILE
            : type === "link"
              ? ResourceAddAssetType.RESOURCE_LINK
              : ResourceAddAssetType.RESOURCE_CODE,
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
    } as any);

    subject.markModified("chapters");
    await subject.save();
    return subject.populate("instructors", "first_name last_name email");
  }

  async updateSubChapterContent(
    subjectId: string,
    chapterOrder: number,
    subChapterOrder: number,
    contentId: string,
    dto: UpdateSubChapterContentDto,
  ): Promise<Subject> {
    const subject = await this.subjectModel.findById(subjectId).exec();
    if (!subject) {
      throw new NotFoundException(`Subject with ID "${subjectId}" not found`);
    }

    const chapter = subject.chapters.find(
      (item) => Number(item.order) === Number(chapterOrder),
    );
    if (!chapter) {
      throw new NotFoundException(
        `Chapter with order "${chapterOrder}" not found in this subject`,
      );
    }

    const subChapter = (chapter.subChapters || []).find(
      (item: any) => Number(item.order) === Number(subChapterOrder),
    );
    if (!subChapter) {
      throw new NotFoundException(
        `SubChapter with order "${subChapterOrder}" not found in this chapter`,
      );
    }

    const contentIndex = (subChapter.contents || []).findIndex(
      (content: any) => String(content.contentId) === String(contentId),
    );
    if (contentIndex < 0) {
      throw new NotFoundException(
        `Content with ID "${contentId}" not found in this subchapter`,
      );
    }

    const content: any = subChapter.contents[contentIndex];
    const previousFolder = String(content.folder || "cours").trim() as
      | "cours"
      | "exercices"
      | "videos"
      | "ressources";
    const previousType = String(content.type || "").trim() as
      | "file"
      | "quiz"
      | "video"
      | "link"
      | "prosit"
      | "code";
    const folder = (dto.folder || content.folder || "cours") as
      | "cours"
      | "exercices"
      | "videos"
      | "ressources";
    const type = (dto.type || content.type) as
      | "file"
      | "quiz"
      | "video"
      | "link"
      | "prosit"
      | "code";
    const title =
      dto.title !== undefined ? String(dto.title || "").trim() : content.title;
    const url =
      dto.url !== undefined ? String(dto.url || "").trim() : content.url;
    const quizText =
      dto.quizText !== undefined
        ? String(dto.quizText || "").trim()
        : content.quizText;
    const quizQuestions =
      dto.quizQuestions !== undefined
        ? dto.quizQuestions
        : content.quizQuestions || [];
    const fileName =
      dto.fileName !== undefined
        ? String(dto.fileName || "").trim()
        : content.fileName;
    const mimeType =
      dto.mimeType !== undefined
        ? String(dto.mimeType || "").trim()
        : content.mimeType;
    const dueDateRaw =
      dto.dueDate !== undefined
        ? String(dto.dueDate || "").trim()
        : content.dueDate
          ? new Date(content.dueDate).toISOString()
          : "";
    const submissionInstructions =
      dto.submissionInstructions !== undefined
        ? String(dto.submissionInstructions || "").trim()
        : String(content.submissionInstructions || "").trim();
    const codeSnippet =
      dto.codeSnippet !== undefined
        ? String(dto.codeSnippet || "").trim()
        : String(content.codeSnippet || "").trim();

    if (!title) {
      throw new BadRequestException("Content title is required");
    }

    this.validateFolderTypeCompatibility(folder, type);

    if (type === "link" && !url) {
      throw new BadRequestException("URL is required for link content");
    }
    if (type === "video" && !fileName && !url) {
      throw new BadRequestException(
        "A video file or URL is required for video content",
      );
    }

    const hasQuizQuestions =
      Array.isArray(quizQuestions) && quizQuestions.length > 0;
    const hasQuizFile = Boolean(fileName || url);

    if (type === "quiz" && !hasQuizQuestions && !hasQuizFile) {
      throw new BadRequestException(
        "Quiz must have either inline questions or a quiz file",
      );
    }

    if (type === "quiz" && hasQuizQuestions) {
      this.validateQuizQuestions(quizQuestions);
    }

    if (type === "file" && !fileName) {
      throw new BadRequestException("File name is required for file content");
    }

    let dueDate: Date | undefined;
    if (type === "prosit") {
      if (!dueDateRaw) {
        throw new BadRequestException("Due date is required for prosit");
      }
      dueDate = new Date(dueDateRaw);
      if (Number.isNaN(dueDate.getTime())) {
        throw new BadRequestException("Invalid due date for prosit");
      }
      const hasInstructionFile = Boolean(fileName || url);
      if (!submissionInstructions && !hasInstructionFile) {
        throw new BadRequestException(
          "Prosit requires either submission instructions text or an instruction file",
        );
      }
    }

    if (type === "code" && !codeSnippet) {
      throw new BadRequestException(
        "Code snippet is required for code content",
      );
    }

    content.folder = folder;
    content.type = type;
    content.title = title;
    content.url = url || undefined;
    content.quizText = quizText || undefined;
    content.quizQuestions =
      type === "quiz"
        ? (quizQuestions || []).map((item: any) => ({
            question: String(item.question || "").trim(),
            options: (item.options || []).map((option: any) =>
              String(option || "").trim(),
            ),
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
        chapterTitle: String((chapter as any).title || ""),
        subChapterOrder,
        subChapterTitle: String((subChapter as any).title || ""),
        sourceContentId: String(contentId),
        assetType: CourseUploadAssetType.COURSE_FILE,
        title,
        url: url || undefined,
        fileName: fileName || undefined,
        mimeType: mimeType || undefined,
      });
    }

    subject.markModified("chapters");
    await subject.save();
    return subject.populate("instructors", "first_name last_name email");
  }

  async deleteSubChapterContent(
    subjectId: string,
    chapterOrder: number,
    subChapterOrder: number,
    contentId: string,
  ): Promise<Subject> {
    const subject = await this.subjectModel.findById(subjectId).exec();
    if (!subject) {
      throw new NotFoundException(`Subject with ID "${subjectId}" not found`);
    }

    const chapter = subject.chapters.find(
      (item) => Number(item.order) === Number(chapterOrder),
    );
    if (!chapter) {
      throw new NotFoundException(
        `Chapter with order "${chapterOrder}" not found in this subject`,
      );
    }

    const subChapter = (chapter.subChapters || []).find(
      (item: any) => Number(item.order) === Number(subChapterOrder),
    );
    if (!subChapter) {
      throw new NotFoundException(
        `SubChapter with order "${subChapterOrder}" not found in this chapter`,
      );
    }

    const before = (subChapter.contents || []).length;
    subChapter.contents = (subChapter.contents || []).filter(
      (content: any) => String(content.contentId) !== String(contentId),
    ) as any;

    if (subChapter.contents.length === before) {
      throw new NotFoundException(
        `Content with ID "${contentId}" not found in this subchapter`,
      );
    }

    await this.courseUploadAssetModel
      .deleteMany({
        subjectId: subject._id,
        sourceContentId: String(contentId),
      })
      .exec();

    subject.markModified("chapters");
    await subject.save();
    return subject.populate("instructors", "first_name last_name email");
  }

  // Backward-compatible wrappers for chapter-content routes.
  // With the new data model, chapter content must target a subchapter.
  async addChapterContent(
    subjectId: string,
    chapterOrder: number,
    _contentDto: AddChapterContentDto,
  ): Promise<Subject> {
    throw new BadRequestException(
      `Chapter content is now nested under subchapters. Use POST /subjects/${subjectId}/chapters/${chapterOrder}/subchapters/:subChapterOrder/contents`,
    );
  }

  async updateChapterContent(
    subjectId: string,
    chapterOrder: number,
    _contentId: string,
    _dto: UpdateChapterContentDto,
  ): Promise<Subject> {
    throw new BadRequestException(
      `Chapter content is now nested under subchapters. Use PUT /subjects/${subjectId}/chapters/${chapterOrder}/subchapters/:subChapterOrder/contents/:contentId`,
    );
  }

  async deleteChapterContent(
    subjectId: string,
    chapterOrder: number,
    _contentId: string,
  ): Promise<Subject> {
    throw new BadRequestException(
      `Chapter content is now nested under subchapters. Use DELETE /subjects/${subjectId}/chapters/${chapterOrder}/subchapters/:subChapterOrder/contents/:contentId`,
    );
  }

  async submitQuiz(
    studentId: string,
    submitQuizDto: SubmitQuizDto,
  ): Promise<QuizSubmission> {
    const scorePercentage = Math.round(
      (submitQuizDto.scoreObtained / submitQuizDto.totalQuestions) * 100,
    );

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

  async getStudentQuizSubmissions(
    studentId: string,
  ): Promise<QuizSubmission[]> {
    return this.quizSubmissionModel
      .find({ studentId })
      .sort({ submittedAt: -1 })
      .exec();
  }

  async getQuizSubmission(submissionId: string): Promise<QuizSubmission> {
    const submission = await this.quizSubmissionModel
      .findById(submissionId)
      .exec();
    if (!submission) {
      throw new NotFoundException(
        `Quiz submission with ID "${submissionId}" not found`,
      );
    }
    return submission;
  }

  async getLatestStudentQuizSubmission(
    studentId: string,
    quizId: string,
  ): Promise<QuizSubmission | null> {
    return this.quizSubmissionModel
      .findOne({ studentId, quizId })
      .sort({ submittedAt: -1 })
      .exec();
  }

  async submitQuizFile(
    studentId: string,
    dto: SubmitQuizFileDto,
    file: {
      fileUrl: string;
      fileName: string;
      mimeType?: string;
    },
  ): Promise<QuizFileSubmission> {
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
      status: QuizFileSubmissionStatus.PENDING,
      submittedAt: new Date(),
    });

    return submission.save();
  }

  async getStudentQuizFileSubmissions(
    studentId: string,
  ): Promise<QuizFileSubmission[]> {
    return this.quizFileSubmissionModel
      .find({ studentId })
      .sort({ submittedAt: -1 })
      .exec();
  }

  async getInstructorQuizFileSubmissions(
    instructorId: string,
  ): Promise<QuizFileSubmission[]> {
    if (!Types.ObjectId.isValid(instructorId)) {
      return [];
    }
    const ownedSubjects = await this.subjectModel
      .find({ instructors: new Types.ObjectId(instructorId) })
      .select("title")
      .exec();
    const subjectTitles = ownedSubjects
      .map((subject: any) => String(subject?.title || "").trim())
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

  async gradeQuizFileSubmission(
    submissionId: string,
    graderId: string,
    dto: GradeQuizFileSubmissionDto,
  ): Promise<QuizFileSubmission> {
    const submission = await this.quizFileSubmissionModel
      .findById(submissionId)
      .exec();

    if (!submission) {
      throw new NotFoundException(
        `Quiz file submission with ID "${submissionId}" not found`,
      );
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
    submission.status = QuizFileSubmissionStatus.GRADED;
    submission.gradedBy = graderId as any;
    submission.gradedAt = new Date();

    return submission.save();
  }

  async create(dto: CreateSubjectDto) {
    const instructorIds = this.normalizeIds(dto.instructorIds);
    await this.assertAllInstructorsExist(instructorIds);

    const code = await this.generateUniqueSubjectCode(dto.title);
    const subject = await this.subjectModel.create({
      code,
      title: dto.title,
      description: dto.description || "",
      instructors: instructorIds.map((id) => new Types.ObjectId(id)),
    });

    return this.findOne(subject._id.toString());
  }

  async findAll(
    instructorId?: string,
    user?: { id?: string; userId?: string; role?: string },
  ) {
    const role = String(user?.role ?? "").toLowerCase();
    if (role === UserRole.STUDENT) {
      const studentId = String(user?.id || user?.userId || "").trim();
      if (!studentId) {
        return [];
      }
      return this.findAllForEnrolledStudent(studentId);
    }

    const filter: FilterQuery<SubjectDocument> = {};
    if (instructorId && Types.ObjectId.isValid(instructorId)) {
      filter.instructors = new Types.ObjectId(instructorId);
    }
    const subjects = await this.subjectModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate("instructors", "first_name last_name email role")
      .exec();

    return subjects.map((subject) => this.toResponse(subject));
  }

  async findOne(
    id: string,
    user?: { id?: string; userId?: string; role?: string },
  ) {
    const subject = await this.subjectModel
      .findById(id)
      .populate("instructors", "first_name last_name email role")
      .exec();

    if (!subject) {
      throw new NotFoundException("Subject not found");
    }

    const role = String(user?.role ?? "").toLowerCase();
    if (role === UserRole.STUDENT) {
      const studentId = String(user?.id || user?.userId || "").trim();
      if (!studentId) {
        throw new ForbiddenException("Student context required");
      }
      await this.assertStudentHasSubjectAccess(studentId, id);
    }

    return this.toResponse(subject);
  }

  async update(id: string, dto: UpdateSubjectDto) {
    const subject = await this.subjectModel.findById(id);
    if (!subject) {
      throw new NotFoundException("Subject not found");
    }

    if (dto.title !== undefined) {
      subject.title = dto.title;
    }
    if (dto.description !== undefined) {
      subject.description = dto.description;
    }
    if (dto.instructorIds !== undefined) {
      const instructorIds = this.normalizeIds(dto.instructorIds);
      await this.assertAllInstructorsExist(instructorIds);
      subject.instructors = instructorIds.map(
        (instructorId) => new Types.ObjectId(instructorId),
      );
    }

    await subject.save();

    return this.findOne(id);
  }

  async remove(id: string) {
    const deleted = await this.subjectModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException("Subject not found");
    }

    return { success: true };
  }

  private normalizeIds(ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException("At least one instructor is required");
    }

    return [...new Set(ids.map((id) => id?.trim()).filter(Boolean))];
  }

  private async assertAllInstructorsExist(instructorIds: string[]) {
    const objectIds = instructorIds.map((id) => new Types.ObjectId(id));
    const instructors = await this.userModel.find({
      _id: { $in: objectIds },
      role: { $regex: /^(instructor|teacher)$/i },
    });

    if (instructors.length !== instructorIds.length) {
      throw new BadRequestException(
        "One or more selected instructors are invalid",
      );
    }
  }

  private toResponse(subject: SubjectDocument) {
    return {
      id: (subject as any)._id,
      code: subject.code,
      title: subject.title,
      name: subject.title,
      description: subject.description,
      chapters: subject.chapters || [],
      instructors: ((subject as any).instructors || []).map(
        (instructor: any) => ({
          id: instructor._id,
          first_name: instructor.first_name,
          last_name: instructor.last_name,
          email: instructor.email,
          role: instructor.role,
        }),
      ),
      createdAt: (subject as any).createdAt,
      updatedAt: (subject as any).updatedAt,
    };
  }
}
