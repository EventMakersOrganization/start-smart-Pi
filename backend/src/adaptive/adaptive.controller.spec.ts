import { Test, TestingModule } from '@nestjs/testing';
import { AdaptiveController } from './adaptive.controller';

describe('AdaptiveController', () => {
  let controller: AdaptiveController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdaptiveController],
    }).compile();

    controller = module.get<AdaptiveController>(AdaptiveController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
