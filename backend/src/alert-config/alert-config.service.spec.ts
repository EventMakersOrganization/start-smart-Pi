import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { AlertConfigService } from './alert-config.service';
import { AlertConfig } from './alert-config.schema';

describe('AlertConfigService', () => {
  let service: AlertConfigService;
  let alertConfigModel: any;

  const saveMock = jest.fn();
  const alertConfigCtor: any = jest.fn().mockImplementation((dto: any) => ({
    ...dto,
    save: saveMock,
  }));

  Object.assign(alertConfigCtor, {
    findOne: jest.fn(),
  });

  beforeEach(async () => {
    saveMock.mockReset();
    alertConfigCtor.findOne.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertConfigService,
        { provide: getModelToken(AlertConfig.name), useValue: alertConfigCtor },
      ],
    }).compile();

    service = module.get(AlertConfigService);
    alertConfigModel = module.get(getModelToken(AlertConfig.name));
  });

  it('should create default config when none exists', async () => {
    const created = {
      lowThreshold: 30,
      mediumThreshold: 70,
      highThreshold: 71,
    };
    alertConfigModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    saveMock.mockResolvedValue(created);

    const result = await service.getConfig();

    expect(result.lowThreshold).toBe(30);
    expect(result.mediumThreshold).toBe(70);
    expect(result.highThreshold).toBe(71);
    expect(saveMock).toHaveBeenCalled();
  });

  it('should update and persist thresholds when input is valid', async () => {
    const existing = {
      lowThreshold: 10,
      mediumThreshold: 50,
      highThreshold: 80,
      save: jest.fn().mockResolvedValue({
        lowThreshold: 20,
        mediumThreshold: 60,
        highThreshold: 90,
      }),
    };

    alertConfigModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(existing),
    });

    const result = await service.updateConfig({
      lowThreshold: 20,
      mediumThreshold: 60,
      highThreshold: 90,
    });

    expect(existing.save).toHaveBeenCalled();
    expect(result.lowThreshold).toBe(20);
    expect(result.mediumThreshold).toBe(60);
    expect(result.highThreshold).toBe(90);
  });

  it('should reject invalid threshold ordering', async () => {
    await expect(
      service.updateConfig({
        lowThreshold: 80,
        mediumThreshold: 50,
        highThreshold: 50,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
