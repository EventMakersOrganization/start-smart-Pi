import { Test, TestingModule } from '@nestjs/testing';
import { AdaptiveLearningController } from './adaptive-learning.controller';

describe('AdaptiveLearningController', () => {
  let controller: AdaptiveLearningController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdaptiveLearningController],
    }).compile();

    controller = module.get<AdaptiveLearningController>(AdaptiveLearningController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
