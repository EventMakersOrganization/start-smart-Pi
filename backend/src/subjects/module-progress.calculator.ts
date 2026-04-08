const WEIGHT_EXERCISE = 70;
const WEIGHT_QUIZ = 25;
const WEIGHT_CONTENT = 5;
const VIDEO_SHARE = 2.5;
const READING_SHARE = 2.5;
const MIN_READING_SECONDS = 20;
const WATCH_THRESHOLD = 0.7;
const SCROLL_THRESHOLD = 0.7;
export const TRUST_MIN = 0.7;
export const TRUST_MAX = 1;
export const MAX_QUIZ_ATTEMPTS = 2;

export interface ModuleProgressInputs {
  exerciseScoresOutOf20: number[];
  exerciseGraded: boolean[];
  /** Per quiz item in module: best adjusted contribution toward the 25% bucket (≤ 25/n each). */
  quizItemContributionsPercent: number[];
  videoWatchedFractions: number[];
  readingScrollFractions: number[];
  readingActiveSeconds: number[];
  hasAnyQuizSubmission: boolean;
}

export interface ModuleProgressBreakdown {
  exerciseProgressPercent: number;
  adjustedQuizProgressPercent: number;
  contentProgressPercent: number;
  rawSumPercent: number;
  finalProgressPercent: number;
  hasGradedExercise: boolean;
  hasQuizAttempt: boolean;
  capsApplied: { noGradedExercise: boolean; noQuizAttempt: boolean };
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function exerciseProgressFromScores(
  scores: number[],
  graded: boolean[],
): number {
  const n = scores.length;
  if (!n) return 0;
  let sumNorm = 0;
  for (let i = 0; i < n; i++) {
    if (!graded[i]) continue;
    sumNorm += Math.max(0, Math.min(20, scores[i] ?? 0)) / 20;
  }
  return (sumNorm / n) * WEIGHT_EXERCISE;
}

function contentProgressFromEngagement(
  videoFractions: number[],
  readingScrolls: number[],
  readingSeconds: number[],
  videoItemCount: number,
  readingItemCount: number,
): number {
  let videoPart = 0;
  if (videoItemCount > 0) {
    const fracs =
      videoFractions.length >= videoItemCount
        ? videoFractions.slice(0, videoItemCount)
        : videoFractions;
    const pad = Array.from(
      { length: videoItemCount },
      (_, i) => fracs[i] ?? 0,
    );
    if (mean(pad) >= WATCH_THRESHOLD) {
      videoPart = VIDEO_SHARE;
    }
  }

  let readingPart = 0;
  if (readingItemCount > 0) {
    const scrolls =
      readingScrolls.length >= readingItemCount
        ? readingScrolls.slice(0, readingItemCount)
        : readingScrolls;
    const times =
      readingSeconds.length >= readingItemCount
        ? readingSeconds.slice(0, readingItemCount)
        : readingSeconds;
    const padScroll = Array.from(
      { length: readingItemCount },
      (_, i) => scrolls[i] ?? 0,
    );
    const padTime = Array.from(
      { length: readingItemCount },
      (_, i) => times[i] ?? 0,
    );
    const ok =
      padScroll.every((s) => s >= SCROLL_THRESHOLD) &&
      padTime.every((t) => t >= MIN_READING_SECONDS);
    if (ok) {
      readingPart = READING_SHARE;
    }
  }

  return Math.min(WEIGHT_CONTENT, videoPart + readingPart);
}

/** All possible quizId values stored for a content row (submission may use any one). */
export function quizCandidateIds(content: unknown): string[] {
  const c = content as Record<string, unknown>;
  const parts = [
    String(c?.contentId ?? "").trim(),
    String(c?.fileName ?? "").trim(),
    String(c?.title ?? "").trim(),
  ].filter((s) => !!s);
  return [...new Set(parts)];
}

export type QuizWorkSlot = { kind: "mcq" | "file"; candidateQuizIds: string[] };

/**
 * Same rules as the Angular `resolveContentFolder`: quiz/prosit are shown under
 * exercices even if `folder` in MongoDB is wrong or legacy.
 */
export function effectiveContentFolder(
  c: unknown,
): "cours" | "exercices" | "videos" | "ressources" {
  const type = String((c as any)?.type || "").trim();
  if (type === "quiz" || type === "prosit") {
    return "exercices";
  }
  if (type === "video") {
    return "videos";
  }
  if (type === "code") {
    return "ressources";
  }
  const raw = String((c as any)?.folder || "")
    .trim()
    .toLowerCase();
  if (
    raw === "cours" ||
    raw === "exercices" ||
    raw === "videos" ||
    raw === "ressources"
  ) {
    return raw;
  }
  return "cours";
}

export function collectSubchapterQuizSlots(contents: unknown[]): QuizWorkSlot[] {
  const slots: QuizWorkSlot[] = [];
  for (const c of contents || []) {
    const type = String((c as any)?.type || "").trim();
    if (type !== "quiz") {
      continue;
    }
    const folder = effectiveContentFolder(c);
    if (folder !== "exercices") {
      continue;
    }
    const questions = (c as any)?.quizQuestions;
    const isMcq = Array.isArray(questions) && questions.length > 0;
    const candidateQuizIds = quizCandidateIds(c);
    if (!candidateQuizIds.length) {
      continue;
    }
    slots.push({ kind: isMcq ? "mcq" : "file", candidateQuizIds });
  }
  return slots;
}

export function collectSubchapterContentKinds(contents: unknown[]): {
  prositTitles: string[];
  mcqQuizIds: string[];
  fileQuizIds: string[];
  videoContentIds: string[];
  readingContentIds: string[];
} {
  const prositTitles: string[] = [];
  const mcqQuizIds: string[] = [];
  const fileQuizIds: string[] = [];
  const videoContentIds: string[] = [];
  const readingContentIds: string[] = [];

  for (const c of contents || []) {
    const type = String((c as any)?.type || "").trim();
    const folder = effectiveContentFolder(c);
    const title = String((c as any)?.title || "").trim();
    const contentId = String((c as any)?.contentId || "").trim();
    const idKey = contentId || String((c as any)?.fileName || title);

    if (type === "prosit" && folder === "exercices") {
      prositTitles.push(title);
      continue;
    }
    if (type === "quiz" && folder === "exercices") {
      const questions = (c as any)?.quizQuestions;
      const isMcq = Array.isArray(questions) && questions.length > 0;
      const qid = contentId || String((c as any)?.fileName || title);
      if (isMcq) mcqQuizIds.push(qid);
      else fileQuizIds.push(qid);
      continue;
    }
    if (type === "video" && folder === "videos") {
      videoContentIds.push(idKey);
      continue;
    }
    if (folder === "cours" && (type === "file" || type === "link")) {
      readingContentIds.push(idKey);
    }
  }

  return { prositTitles, mcqQuizIds, fileQuizIds, videoContentIds, readingContentIds };
}

export function computeTrustScore(params: {
  scorePercentage: number;
  totalQuestions: number;
  totalDurationMs?: number;
  tabHiddenCount?: number;
  questionTimingsMs?: number[];
}): number {
  const n = Math.max(1, params.totalQuestions);
  let trust = 1;

  const totalMs = Number(params.totalDurationMs);
  if (Number.isFinite(totalMs) && totalMs > 0) {
    const avg = totalMs / n;
    if (avg < 500) trust *= 0.82;
    else if (avg < 1500) trust *= 0.9;
    else if (avg < 2500) trust *= 0.96;
  }

  const timings = Array.isArray(params.questionTimingsMs)
    ? params.questionTimingsMs
    : [];
  if (timings.length) {
    const allCorrectFast =
      params.scorePercentage >= 99.5 &&
      timings.every((t) => Number(t) < 900);
    if (allCorrectFast) trust *= 0.88;
    const anySuspicious = timings.filter((t) => Number(t) < 400).length;
    if (anySuspicious >= Math.ceil(n * 0.6)) trust *= 0.9;
  }

  const tabs = Number(params.tabHiddenCount);
  if (Number.isFinite(tabs) && tabs > 0) {
    trust *= Math.max(0.92, 1 - Math.min(10, tabs) * 0.02);
  }

  if (params.scorePercentage >= 100 && totalMs < n * 800) {
    trust *= 0.92;
  }

  return Math.max(TRUST_MIN, Math.min(TRUST_MAX, trust));
}

export function computeModuleProgress(
  inputs: ModuleProgressInputs,
  options: {
    expectedExerciseCount: number;
    quizItemCount: number;
    videoItemCount: number;
    readingItemCount: number;
  },
): ModuleProgressBreakdown {
  const exerciseScores =
    inputs.exerciseScoresOutOf20.length >= options.expectedExerciseCount
      ? inputs.exerciseScoresOutOf20.slice(0, options.expectedExerciseCount)
      : [
          ...inputs.exerciseScoresOutOf20,
          ...Array(
            Math.max(
              0,
              options.expectedExerciseCount - inputs.exerciseScoresOutOf20.length,
            ),
          ).fill(0),
        ];

  const gradedFlags =
    inputs.exerciseGraded.length >= exerciseScores.length
      ? inputs.exerciseGraded.slice(0, exerciseScores.length)
      : [
          ...inputs.exerciseGraded,
          ...Array(
            Math.max(0, exerciseScores.length - inputs.exerciseGraded.length),
          ).fill(false),
        ];

  const exerciseProgressPercent = exerciseProgressFromScores(
    exerciseScores,
    gradedFlags,
  );

  const quizItemCount = Math.max(0, options.quizItemCount);
  const perQuizWeight = quizItemCount > 0 ? WEIGHT_QUIZ / quizItemCount : 0;
  const contribs = inputs.quizItemContributionsPercent || [];
  let adjustedQuizProgressPercent = 0;
  for (let i = 0; i < quizItemCount; i++) {
    adjustedQuizProgressPercent += Math.min(
      perQuizWeight,
      Math.max(0, contribs[i] ?? 0),
    );
  }

  const contentProgressPercent = contentProgressFromEngagement(
    inputs.videoWatchedFractions,
    inputs.readingScrollFractions,
    inputs.readingActiveSeconds,
    options.videoItemCount,
    options.readingItemCount,
  );

  const hasGradedExercise = gradedFlags.some((g) => !!g);
  const hasQuizAttempt =
    quizItemCount > 0 && !!inputs.hasAnyQuizSubmission;

  const rawSumPercent =
    exerciseProgressPercent +
    adjustedQuizProgressPercent +
    contentProgressPercent;

  let final = Math.min(100, rawSumPercent);
  const capsApplied = { noGradedExercise: false, noQuizAttempt: false };

  /** Cap 30% only when the module actually has exercise items but none graded yet. */
  if (!hasGradedExercise && options.expectedExerciseCount > 0) {
    final = Math.min(final, 30);
    capsApplied.noGradedExercise = true;
  }
  if (quizItemCount > 0 && !hasQuizAttempt) {
    final = Math.min(final, 75);
    capsApplied.noQuizAttempt = true;
  }

  return {
    exerciseProgressPercent,
    adjustedQuizProgressPercent,
    contentProgressPercent,
    rawSumPercent: Math.min(100, rawSumPercent),
    finalProgressPercent: Math.round(final * 100) / 100,
    hasGradedExercise,
    hasQuizAttempt,
    capsApplied,
  };
}
