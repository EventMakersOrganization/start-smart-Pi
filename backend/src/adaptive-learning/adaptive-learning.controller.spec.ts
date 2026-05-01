import { Test, TestingModule } from "@nestjs/testing";
import { AdaptiveLearningController } from "./adaptive-learning.controller";
import { AdaptiveLearningService } from "./adaptive-learning.service";
import { CreateStudentProfileDto } from "./dto/create-student-profile.dto";

describe("AdaptiveLearningController", () => {
  let controller: AdaptiveLearningController;
  let service: jest.Mocked<
    Pick<
      AdaptiveLearningService,
      | "createProfile"
      | "findProfileByUserId"
      | "adaptDifficulty"
      | "generateRecommendationsV2"
    >
  >;

  beforeEach(async () => {
    service = {
      createProfile: jest.fn(),
      findProfileByUserId: jest.fn(),
      adaptDifficulty: jest.fn(),
      generateRecommendationsV2: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdaptiveLearningController],
      providers: [
        {
          provide: AdaptiveLearningService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<AdaptiveLearningController>(
      AdaptiveLearningController,
    );
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("delegation", () => {
    it("createProfile calls service with dto", async () => {
      const dto: CreateStudentProfileDto = { userId: "u1", level: "beginner" };
      const result = { userId: "u1", level: "beginner" };
      service.createProfile.mockResolvedValue(result as never);

      await expect(controller.createProfile(dto)).resolves.toEqual(result);
      expect(service.createProfile).toHaveBeenCalledWith(dto);
    });

    it("findProfile delegates to service", async () => {
      const profile = { userId: "u1", level: "intermediate" };
      service.findProfileByUserId.mockResolvedValue(profile as never);

      await expect(controller.findProfile("u1")).resolves.toEqual(profile);
      expect(service.findProfileByUserId).toHaveBeenCalledWith("u1");
    });

    it("adaptDifficulty delegates to service", async () => {
      const out = {
        previousLevel: "beginner",
        newLevel: "intermediate",
        reason: "up",
        averageScore: 85,
        performancesAnalyzed: 3,
        action: "UP" as const,
      };
      service.adaptDifficulty.mockResolvedValue(out);

      await expect(controller.adaptDifficulty("s1")).resolves.toEqual(out);
      expect(service.adaptDifficulty).toHaveBeenCalledWith("s1");
    });

    it("generateRecommendationsV2 delegates to service", async () => {
      const payload = { items: [] };
      service.generateRecommendationsV2.mockResolvedValue(payload as never);

      await expect(controller.generateRecommendationsV2("s1")).resolves.toEqual(
        payload,
      );
      expect(service.generateRecommendationsV2).toHaveBeenCalledWith("s1");
    });

    it("propagates rejection from service", async () => {
      service.findProfileByUserId.mockRejectedValue(new Error("not found"));

      await expect(controller.findProfile("x")).rejects.toThrow("not found");
    });
  });
});
