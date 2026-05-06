import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { NotFoundException } from "@nestjs/common";
import { AdaptiveLearningService } from "./adaptive-learning.service";
import { StudentProfile } from "../users/schemas/student-profile.schema";
import { StudentPerformance } from "./schemas/student-performance.schema";
import { Recommendation } from "./schemas/recommendation.schema";
import { LevelTest } from "./schemas/level-test.schema";
import { PostEvaluationTest } from "./schemas/post-evaluation-test.schema";
import { Question } from "./schemas/question.schema";
import { ChatAi } from "../chat/schemas/chat-ai.schema";
import { ChatInstructor } from "../chat/schemas/chat-instructor.schema";
import { ChatRoom } from "../chat/schemas/chat-room.schema";
import { ChatMessage } from "../chat/schemas/chat-message.schema";
import { Score } from "../brainrush/schemas/score.schema";
import { PlayerSession } from "../brainrush/schemas/player-session.schema";
import { GoalSettings } from "./schemas/goal-settings.schema";
import { QuizSubmission } from "../subjects/schemas/quiz-submission.schema";
import { QuizFileSubmission } from "../subjects/schemas/quiz-file-submission.schema";
import { Subject } from "../subjects/schemas/subject.schema";
import { PrositSubmission } from "../prosits/schemas/prosit-submission.schema";
import { CreateStudentProfileDto } from "./dto/create-student-profile.dto";

function buildModelMock(overrides: Record<string, unknown> = {}) {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    findByIdAndDelete: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(),
    lean: jest.fn(),
    ...overrides,
  };
}

describe("AdaptiveLearningService", () => {
  let service: AdaptiveLearningService;
  let profileModel: ReturnType<typeof buildModelMock>;
  let performanceModel: ReturnType<typeof buildModelMock>;

  const models: Record<string, ReturnType<typeof buildModelMock>> = {};

  beforeEach(async () => {
    const names = [
      StudentProfile,
      StudentPerformance,
      Recommendation,
      LevelTest,
      PostEvaluationTest,
      Question,
      ChatAi,
      ChatInstructor,
      ChatRoom,
      ChatMessage,
      Score,
      PlayerSession,
      GoalSettings,
      QuizSubmission,
      QuizFileSubmission,
      Subject,
      PrositSubmission,
    ];
    const providers = names.map((SchemaClass) => {
      const m = buildModelMock();
      models[SchemaClass.name] = m;
      return { provide: getModelToken(SchemaClass.name), useValue: m };
    });

    profileModel = models[StudentProfile.name];
    performanceModel = models[StudentPerformance.name];

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdaptiveLearningService, ...providers],
    }).compile();

    service = module.get<AdaptiveLearningService>(AdaptiveLearningService);
    jest.clearAllMocks();
  });

  it("uses AI_SERVICE_URL env var when provided", async () => {
    process.env.AI_SERVICE_URL = "http://ai-service.start-smart.svc.cluster.local:8000";
    const names = [
      StudentProfile,
      StudentPerformance,
      Recommendation,
      LevelTest,
      PostEvaluationTest,
      Question,
      ChatAi,
      ChatInstructor,
      ChatRoom,
      ChatMessage,
      Score,
      PlayerSession,
      GoalSettings,
      QuizSubmission,
      QuizFileSubmission,
      Subject,
      PrositSubmission,
    ];
    const providers = names.map((SchemaClass) => ({
      provide: getModelToken(SchemaClass.name),
      useValue: buildModelMock(),
    }));
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdaptiveLearningService, ...providers],
    }).compile();
    const localService = module.get<AdaptiveLearningService>(AdaptiveLearningService) as any;
    expect(localService.aiServiceBaseUrl).toBe(
      "http://ai-service.start-smart.svc.cluster.local:8000",
    );
    delete process.env.AI_SERVICE_URL;
  });

  describe("createProfile", () => {
    it("returns upserted profile", async () => {
      const dto: CreateStudentProfileDto = { userId: "user-1", level: "beginner" };
      const saved = { userId: "user-1", level: "beginner" };
      profileModel.findOneAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(saved),
      });

      const result = await service.createProfile(dto);

      expect(profileModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: "user-1" },
        { $setOnInsert: dto },
        expect.objectContaining({
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }),
      );
      expect(result).toEqual(saved);
    });
  });

  describe("findProfileByUserId", () => {
    it("returns profile when found", async () => {
      const profile = { userId: "u1", level: "intermediate" };
      profileModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(profile),
      });

      await expect(service.findProfileByUserId("u1")).resolves.toEqual(profile);
      expect(profileModel.findOne).toHaveBeenCalledWith({ userId: "u1" });
    });

    it("throws NotFoundException when missing", async () => {
      profileModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findProfileByUserId("missing")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getAverageScore", () => {
    it("returns average from aggregate", async () => {
      performanceModel.aggregate = jest
        .fn()
        .mockResolvedValue([{ avg: 73.5 }]);

      await expect(service.getAverageScore("s1")).resolves.toBe(73.5);
      expect(performanceModel.aggregate).toHaveBeenCalled();
    });

    it("returns 0 when no performances", async () => {
      performanceModel.aggregate = jest.fn().mockResolvedValue([]);

      await expect(service.getAverageScore("s1")).resolves.toBe(0);
    });
  });

  describe("adaptDifficulty", () => {
    function mockPerformanceChain(rows: { score: number }[]) {
      const exec = jest.fn().mockResolvedValue(rows);
      performanceModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({ exec }),
        }),
      });
    }

    it("returns KEEP with not enough performances", async () => {
      profileModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ userId: "s1", level: "beginner" }),
      });
      mockPerformanceChain([{ score: 80 }, { score: 90 }]);

      const out = await service.adaptDifficulty("s1");

      expect(out.action).toBe("KEEP");
      expect(out.performancesAnalyzed).toBe(2);
      expect(out.reason).toContain("Not enough data");
    });

    it("promotes beginner to intermediate when average >= 80", async () => {
      profileModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ userId: "s1", level: "beginner" }),
      });
      mockPerformanceChain([
        { score: 85 },
        { score: 82 },
        { score: 88 },
      ]);
      profileModel.findOneAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const out = await service.adaptDifficulty("s1");

      expect(out.action).toBe("UP");
      expect(out.previousLevel).toBe("beginner");
      expect(out.newLevel).toBe("intermediate");
      expect(out.averageScore).toBe(85);
      expect(profileModel.findOneAndUpdate).toHaveBeenCalled();
    });

    it("demotes intermediate to beginner when average <= 40", async () => {
      profileModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ userId: "s1", level: "intermediate" }),
      });
      mockPerformanceChain([
        { score: 35 },
        { score: 38 },
        { score: 40 },
      ]);
      profileModel.findOneAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const out = await service.adaptDifficulty("s1");

      expect(out.action).toBe("DOWN");
      expect(out.newLevel).toBe("beginner");
      expect(profileModel.findOneAndUpdate).toHaveBeenCalled();
    });

    it("keeps advanced when already max and average high", async () => {
      profileModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ userId: "s1", level: "advanced" }),
      });
      mockPerformanceChain([
        { score: 90 },
        { score: 88 },
        { score: 92 },
      ]);

      const out = await service.adaptDifficulty("s1");

      expect(out.action).toBe("KEEP");
      expect(out.newLevel).toBe("advanced");
      expect(profileModel.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });
});
