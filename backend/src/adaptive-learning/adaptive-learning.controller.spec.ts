import { Test, TestingModule } from '@nestjs/testing';
import { AdaptiveLearningController } from './adaptive-learning.controller';
import { AdaptiveLearningService } from './adaptive-learning.service';

describe('AdaptiveLearningController', () => {
  let controller: AdaptiveLearningController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdaptiveLearningController],
      providers: [
        {
          provide: AdaptiveLearningService,
          useValue: {
            getRecommendations: jest.fn(),
            trackActivity: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AdaptiveLearningController>(AdaptiveLearningController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
