import { Test, TestingModule } from '@nestjs/testing';
import { BrainrushController } from './brainrush.controller';

describe('BrainrushController', () => {
  let controller: BrainrushController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrainrushController],
    }).compile();

    controller = module.get<BrainrushController>(BrainrushController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
