import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Subject, SubjectDocument } from "./schemas/subject.schema";
import {
  QuizSubmission,
  QuizSubmissionDocument,
} from "./schemas/quiz-submission.schema";
import {
  QuizFileSubmission,
  QuizFileSubmissionDocument,
  QuizFileSubmissionStatus,
} from "./schemas/quiz-file-submission.schema";
import {
  StudentSubchapterEngagement,
  StudentSubchapterEngagementDocument,
} from "./schemas/student-subchapter-engagement.schema";
import {
  PrositSubmission,
  PrositSubmissionDocument,
} from "../prosits/schemas/prosit-submission.schema";
import {
  collectSubchapterContentKinds,
  collectSubchapterQuizSlots,
  computeModuleProgress,
  ModuleProgressBreakdown,
} from "./module-progress.calculator";
import { normalizePrositGradeToOutOf20 } from "../prosits/prosits.service";

@Injectable()
export class ModuleProgressService {
  constructor(
    @InjectModel(Subject.name) private subjectModel: Model<SubjectDocument>,
    @InjectModel(QuizSubmission.name)
    private quizSubmissionModel: Model<QuizSubmissionDocument>,
    @InjectModel(QuizFileSubmission.name)
    private quizFileSubmissionModel: Model<QuizFileSubmissionDocument>,
    @InjectModel(StudentSubchapterEngagement.name)
    private engagementModel: Model<StudentSubchapterEngagementDocument>,
    @InjectModel(PrositSubmission.name)
    private prositSubmissionModel: Model<PrositSubmissionDocument>,
  ) {}

  async getModuleProgressForStudent(
    subjectId: string,
    chapterOrder: number,
    subChapterOrder: number,
    studentId: string,
  ): Promise<ModuleProgressBreakdown & { breakdown: Record<string, number> }> {
    if (!Types.ObjectId.isValid(subjectId) || !Types.ObjectId.isValid(studentId)) {
      throw new NotFoundException("Invalid id");
    }

    const subject = await this.subjectModel.findById(subjectId).exec();
    if (!subject) {
      throw new NotFoundException("Subject not found");
    }

    const chapter = (subject.chapters || []).find(
      (ch) => Number(ch.order) === Number(chapterOrder),
    );
    if (!chapter) {
      throw new NotFoundException("Chapter not found");
    }

    const subChapter = (chapter.subChapters || []).find(
      (sc) => Number(sc.order) === Number(subChapterOrder),
    );
    if (!subChapter) {
      throw new NotFoundException("Subchapter not found");
    }

    const contents = Array.isArray(subChapter.contents) ? subChapter.contents : [];
    const kinds = collectSubchapterContentKinds(contents as unknown[]);
    const quizSlots = collectSubchapterQuizSlots(contents as unknown[]);
    const subjectTitle = String(subject.title || "").trim();
    const chapterTitle = String(chapter.title || "").trim();
    const subChapterTitle = String(subChapter.title || "").trim();

    const sid = new Types.ObjectId(studentId);
    const studentIdMatch = {
      $in: [sid, String(studentId)],
    };

    const exerciseScores: number[] = [];
    const exerciseGraded: boolean[] = [];

    for (const prositTitle of kinds.prositTitles) {
      const sub = await this.prositSubmissionModel
        .findOne({
          studentId,
          chapterTitle: chapter.title,
          subChapterTitle: subChapter.title,
          prositTitle,
          $or: [
            { subjectTitle: { $exists: false } },
            { subjectTitle: "" },
            { subjectTitle: subjectTitle },
          ],
        })
        .sort({ submittedAt: -1 })
        .exec();

      const graded =
        sub?.status === "graded" &&
        typeof sub.grade === "number" &&
        Number.isFinite(sub.grade);
      exerciseGraded.push(!!graded);
      exerciseScores.push(
        graded ? normalizePrositGradeToOutOf20(Number(sub!.grade)) : 0,
      );
    }

    const quizItemCount = quizSlots.length;
    const perQuizWeight = quizItemCount > 0 ? 25 / quizItemCount : 0;

    const quizContribs: number[] = [];
    let hasAnyQuizSubmission = false;

    const scopeMatch = {
      subjectTitle,
      chapterTitle,
      subChapterTitle,
    };

    for (const slot of quizSlots) {
      const ids = slot.candidateQuizIds;
      if (!ids.length) {
        quizContribs.push(0);
        continue;
      }

      /** MCQ submissions (same ids whether slot was classified as mcq or file). */
      let attempts = await this.quizSubmissionModel
        .find({
          studentId: studentIdMatch,
          quizId: { $in: ids },
          ...scopeMatch,
        })
        .sort({ submittedAt: -1 })
        .exec();
      if (!attempts.length) {
        attempts = await this.quizSubmissionModel
          .find({ studentId: studentIdMatch, quizId: { $in: ids } })
          .sort({ submittedAt: -1 })
          .exec();
      }
      if (attempts.length) {
        hasAnyQuizSubmission = true;
      }

      let bestMcq = 0;
      for (const att of attempts) {
        const pct = Number(att.scorePercentage) || 0;
        const trust = Number(att.trustScore);
        const t =
          Number.isFinite(trust) && trust >= 0.7 && trust <= 1 ? trust : 1;
        const contrib = (pct / 100) * perQuizWeight * t;
        if (contrib > bestMcq) {
          bestMcq = contrib;
        }
      }

      /** File quiz submissions (covers misclassified slots or graded file quizzes). */
      let fileSub = await this.quizFileSubmissionModel
        .findOne({
          studentId: studentIdMatch,
          quizId: { $in: ids },
          ...scopeMatch,
        })
        .sort({ submittedAt: -1 })
        .exec();
      if (!fileSub) {
        fileSub = await this.quizFileSubmissionModel
          .findOne({ studentId: studentIdMatch, quizId: { $in: ids } })
          .sort({ submittedAt: -1 })
          .exec();
      }
      if (fileSub) {
        hasAnyQuizSubmission = true;
      }

      let bestFile = 0;
      if (
        fileSub?.status === QuizFileSubmissionStatus.GRADED &&
        typeof fileSub.grade === "number"
      ) {
        const g = Math.max(0, Math.min(100, Number(fileSub.grade)));
        bestFile = (g / 100) * perQuizWeight * 1;
      }

      quizContribs.push(Math.max(bestMcq, bestFile));
    }

    const engagement = await this.engagementModel
      .findOne({
        studentId: sid,
        subjectId: new Types.ObjectId(subjectId),
        chapterOrder: Number(chapterOrder),
        subChapterOrder: Number(subChapterOrder),
      })
      .exec();

    const byId = engagement?.byContentId || {};

    const videoFracs = kinds.videoContentIds.map(
      (id) => Math.max(0, Math.min(1, Number(byId[id]?.videoWatchedFraction) || 0)),
    );
    const readingScrolls = kinds.readingContentIds.map(
      (id) =>
        Math.max(0, Math.min(1, Number(byId[id]?.readingScrollFraction) || 0)),
    );
    const readingSecs = kinds.readingContentIds.map(
      (id) => Math.max(0, Number(byId[id]?.readingActiveSeconds) || 0),
    );

    const breakdown = computeModuleProgress(
      {
        exerciseScoresOutOf20: exerciseScores,
        exerciseGraded,
        quizItemContributionsPercent: quizContribs,
        videoWatchedFractions: videoFracs,
        readingScrollFractions: readingScrolls,
        readingActiveSeconds: readingSecs,
        hasAnyQuizSubmission,
      },
      {
        expectedExerciseCount: kinds.prositTitles.length,
        quizItemCount,
        videoItemCount: kinds.videoContentIds.length,
        readingItemCount: kinds.readingContentIds.length,
      },
    );

    return {
      ...breakdown,
      breakdown: {
        exercise: breakdown.exerciseProgressPercent,
        quiz: breakdown.adjustedQuizProgressPercent,
        content: breakdown.contentProgressPercent,
      },
    };
  }

  async upsertContentEngagement(
    subjectId: string,
    chapterOrder: number,
    subChapterOrder: number,
    studentId: string,
    contentId: string,
    patch: {
      videoWatchedFraction?: number;
      readingScrollFraction?: number;
      readingActiveSeconds?: number;
    },
  ): Promise<StudentSubchapterEngagement> {
    if (!Types.ObjectId.isValid(subjectId) || !Types.ObjectId.isValid(studentId)) {
      throw new NotFoundException("Invalid id");
    }

    const sid = new Types.ObjectId(studentId);
    const subj = new Types.ObjectId(subjectId);
    const cid = String(contentId || "").trim();
    if (!cid) {
      throw new NotFoundException("contentId is required");
    }

    const existing = await this.engagementModel
      .findOne({
        studentId: sid,
        subjectId: subj,
        chapterOrder: Number(chapterOrder),
        subChapterOrder: Number(subChapterOrder),
      })
      .exec();

    const prev = existing?.byContentId?.[cid] || {};
    const next = {
      ...prev,
      ...(patch.videoWatchedFraction !== undefined
        ? {
            videoWatchedFraction: Math.max(
              0,
              Math.min(1, Number(patch.videoWatchedFraction)),
            ),
          }
        : {}),
      ...(patch.readingScrollFraction !== undefined
        ? {
            readingScrollFraction: Math.max(
              0,
              Math.min(1, Number(patch.readingScrollFraction)),
            ),
          }
        : {}),
      ...(patch.readingActiveSeconds !== undefined
        ? {
            readingActiveSeconds: Math.max(
              0,
              Number(patch.readingActiveSeconds),
            ),
          }
        : {}),
    };

    const byContentId = { ...(existing?.byContentId || {}), [cid]: next };

    const doc = await this.engagementModel
      .findOneAndUpdate(
        {
          studentId: sid,
          subjectId: subj,
          chapterOrder: Number(chapterOrder),
          subChapterOrder: Number(subChapterOrder),
        },
        {
          $set: { byContentId },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    return doc!;
  }

  async countQuizAttempts(studentId: string, quizId: string): Promise<number> {
    return this.quizSubmissionModel.countDocuments({ studentId, quizId }).exec();
  }

  /**
   * Average of per-module `finalProgressPercent` across all subchapters (70/25/5 formula).
   */
  async getSubjectAggregateProgressPercent(
    studentId: string,
    subjectId: string,
  ): Promise<{ percent: number; moduleCount: number }> {
    if (!Types.ObjectId.isValid(subjectId) || !Types.ObjectId.isValid(studentId)) {
      throw new NotFoundException("Invalid id");
    }

    const subject = await this.subjectModel.findById(subjectId).exec();
    if (!subject) {
      throw new NotFoundException("Subject not found");
    }

    const percents: number[] = [];
    for (const ch of subject.chapters || []) {
      const chapterOrder = Number(ch.order ?? 0);
      for (const sc of ch.subChapters || []) {
        const subChapterOrder = Number(sc.order ?? 0);
        try {
          const mod = await this.getModuleProgressForStudent(
            subjectId,
            chapterOrder,
            subChapterOrder,
            studentId,
          );
          const p = Number(mod?.finalProgressPercent ?? 0);
          if (Number.isFinite(p)) {
            percents.push(Math.max(0, Math.min(100, p)));
          }
        } catch {
          // skip malformed modules
        }
      }
    }

    if (percents.length === 0) {
      return { percent: 0, moduleCount: 0 };
    }
    const sum = percents.reduce((a, b) => a + b, 0);
    return {
      percent: Math.round((sum / percents.length) * 100) / 100,
      moduleCount: percents.length,
    };
  }
}
