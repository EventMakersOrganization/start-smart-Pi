import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  PrositSubmission,
  PrositSubmissionDocument,
} from "./schemas/prosit-submission.schema";
import { CreatePrositSubmissionDto } from "./dto/create-prosit-submission.dto";
import { Subject, SubjectDocument } from "../subjects/schemas/subject.schema";

/** Toujours stocker la note sur /20 (0–20). */
export function normalizePrositGradeToOutOf20(raw: number): number {
  const g = Number(raw);
  if (!Number.isFinite(g) || g < 0) return 0;
  if (g <= 20) return Math.min(20, g);
  return Math.min(20, (g / 100) * 20);
}

@Injectable()
export class PrositsService {
  constructor(
    @InjectModel(PrositSubmission.name)
    private prositSubmissionModel: Model<PrositSubmissionDocument>,
    @InjectModel(Subject.name) private subjectModel: Model<SubjectDocument>,
  ) {}

  async createSubmission(
    dto: CreatePrositSubmissionDto,
    file?: Express.Multer.File,
  ): Promise<PrositSubmission> {
    const existing = await this.prositSubmissionModel
      .findOne({
        studentId: String(dto.studentId || "").trim(),
        prositTitle: String(dto.prositTitle || "").trim(),
        chapterTitle: String(dto.chapterTitle || "").trim(),
        subChapterTitle: String(dto.subChapterTitle || "").trim(),
      })
      .exec();

    if (existing) {
      // OVERWRITE MODE: Update existing instead of creating new
      existing.reportText = dto.reportText;
      existing.reportHtml = dto.reportHtml;
      existing.wordCount = dto.wordCount;
      existing.subjectTitle = dto.subjectTitle ? String(dto.subjectTitle).trim() : undefined;
      if (file) {
        existing.fileName = file.originalname;
        existing.filePath = `/uploads/prosits/${file.filename}`;
      }
      existing.submittedAt = new Date();
      existing.status = "submitted"; // Reset status if it was graded? Or keep it? Usually reset.
      return existing.save();
    }

    const submission = new this.prositSubmissionModel({
      ...dto,
      subjectTitle: dto.subjectTitle ? String(dto.subjectTitle).trim() : undefined,
      fileName: file?.originalname,
      filePath: file ? `/uploads/prosits/${file.filename}` : null,
      submittedAt: new Date(),
      status: "submitted",
    });

    return submission.save();
  }

  async getSubmissionsByChapter(
    chapterTitle: string,
  ): Promise<PrositSubmission[]> {
    return this.prositSubmissionModel
      .find({ chapterTitle })
      .sort({ submittedAt: -1 })
      .exec();
  }

  async getSubmissionsByStudent(
    studentId: string,
  ): Promise<PrositSubmission[]> {
    return this.prositSubmissionModel
      .find({ studentId })
      .sort({ submittedAt: -1 })
      .exec();
  }

  async getSubmissionById(id: string): Promise<PrositSubmission> {
    return this.prositSubmissionModel.findById(id).exec();
  }

  async updateGrade(
    id: string,
    grade: number,
    feedback: string,
  ): Promise<PrositSubmission> {
    const outOf20 = normalizePrositGradeToOutOf20(grade);
    return this.prositSubmissionModel
      .findByIdAndUpdate(
        id,
        {
          grade: outOf20,
          feedback,
          status: "graded",
          gradedAt: new Date(),
        },
        { new: true },
      )
      .exec();
  }

  async assertInstructorCanGrade(
    instructorId: string,
    submission: PrositSubmissionDocument,
  ): Promise<void> {
    const st = String(submission.subjectTitle || "").trim();
    if (!st) {
      throw new BadRequestException(
        "Ce rendu n'a pas de matière (subjectTitle) : impossible de vérifier l'enseignant.",
      );
    }
    const subject = await this.subjectModel
      .findOne({
        title: st,
        instructors: new Types.ObjectId(instructorId),
      })
      .exec();
    if (!subject) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à noter ce rendu pour cette matière.",
      );
    }
  }

  async gradeSubmission(
    submissionId: string,
    instructorId: string,
    grade: number,
    feedback?: string,
  ): Promise<PrositSubmission> {
    const submission = await this.prositSubmissionModel.findById(submissionId).exec();
    if (!submission) {
      throw new NotFoundException("Rendu introuvable");
    }
    await this.assertInstructorCanGrade(instructorId, submission);
    return this.updateGrade(submissionId, grade, feedback || "");
  }

  /**
   * Rendus des matières où l'utilisateur est instructeur (subjectTitle renseigné).
   */
  async getSubmissionsForInstructor(
    instructorId: string,
  ): Promise<Array<PrositSubmission & { subject?: string }>> {
    if (!Types.ObjectId.isValid(instructorId)) {
      return [];
    }
    const subjects = await this.subjectModel
      .find({ instructors: new Types.ObjectId(instructorId) })
      .select("title")
      .exec();
    const titles = subjects
      .map((s) => String(s.title || "").trim())
      .filter((t) => !!t);
    if (!titles.length) {
      return [];
    }
    const rows = await this.prositSubmissionModel
      .find({ subjectTitle: { $in: titles } })
      .sort({ submittedAt: -1 })
      .exec();
    return rows.map((r) => {
      const o = r.toObject() as PrositSubmission & { subject?: string };
      o.subject = String(r.subjectTitle || "").trim();
      return o;
    });
  }

  async getAllSubmissions(): Promise<PrositSubmission[]> {
    return this.prositSubmissionModel.find().sort({ submittedAt: -1 }).exec();
  }
}
